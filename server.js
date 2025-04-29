import express from 'express';
import cors from 'cors';
import { Worker } from 'worker_threads';
import { ChatOpenAI } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Embeddings } from "@langchain/core/embeddings";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cpus } from 'os';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { ChromaClient } from 'chromadb';
import axios from 'axios';
import process from 'node:process';
import fetch from 'node-fetch'; // Add this import for Node.js fetch

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a directory for storing the vector database
const VECTOR_STORE_PATH = join(__dirname, 'vector_store');
if (!existsSync(VECTOR_STORE_PATH)) {
  mkdirSync(VECTOR_STORE_PATH);
}

// Create configuration directory if it doesn't exist
const CONFIG_DIR_PATH = join(__dirname, 'configuration');
if (!existsSync(CONFIG_DIR_PATH)) {
  mkdirSync(CONFIG_DIR_PATH);
}

// Read ChromaDB configuration
let CHROMA_PORT = 8000; // Default port
const CHROMA_CONFIG_PATH = join(CONFIG_DIR_PATH, 'chroma_config.json');
if (existsSync(CHROMA_CONFIG_PATH)) {
  try {
    const config = JSON.parse(readFileSync(CHROMA_CONFIG_PATH, 'utf8'));
    if (config.port) {
      CHROMA_PORT = config.port;
      console.log(`Using ChromaDB on port ${CHROMA_PORT} from configuration`);
    }
  } catch (error) {
    console.warn(`Failed to read ChromaDB config: ${error.message}. Using default port 8000.`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
let vectorStore = null;
let isInitializing = false;
let initializationError = null;
let initializationProgress = '';

// Define LocalAI base URL
const LOCAL_AI_BASE_URL = "http://localhost:1234/v1";

// Initialize ChromaDB client for direct operations
const chromaClient = new ChromaClient({ path: `http://localhost:${CHROMA_PORT}` });

// Initialize GPT-4o Local model
const model = new ChatOpenAI({
  openAIApiKey: "dummy-key", // LocalAI doesn't validate this
  modelName: "gpt-4o",
  temperature: 0.2, // Lower temperature for more factual responses
  maxTokens: 2000, // Sufficient for detailed responses
  basePath: LOCAL_AI_BASE_URL
});

// Custom embeddings class that uses the local model
class LocalAIEmbeddings extends Embeddings {
  constructor() {
    super();
    this.dimensions = 1536; // Standard embedding dimensions
    this.batchSize = 16;    // Process texts in batches
  }

  /**
   * Get embeddings for multiple texts
   * @param {string[]} texts - Array of texts to get embeddings for
   * @returns {Promise<number[][]>} - Array of embeddings
   */
  async embedDocuments(texts) {
    console.log(`Generating embeddings for ${texts.length} texts`);
    const embeddings = [];
    
    // Process in batches to avoid overloading the API
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.embedQuery(text))
      );
      embeddings.push(...batchEmbeddings);
      console.log(`Processed batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(texts.length/this.batchSize)}`);
    }
    
    return embeddings;
  }

  /**
   * Get embedding for a single text using gpt-4o
   * @param {string} text - Text to get embedding for
   * @returns {Promise<number[]>} - Embedding vector
   */
  async embedQuery(text) {
    try {
      // Use GPT-4o to generate an embedding
      // Since we don't have a dedicated embedding model, we'll use a prompt
      // to make the LLM return a vector representation
      
      // We'll ask the model to generate a fixed-length vector
      // This is much less efficient than a real embedding model but can work for testing
      
      const prompt = `Generate a compact, normalized 1536-dimension numerical vector representation 
      of the following text, optimized for semantic similarity search. 
      The vector should be returned as a comma-separated list of numbers between -1 and 1. 
      Don't include any explanation, just return the vector.
      
      Text to embed: "${text.replace(/"/g, '\\"')}"`;
      
      const response = await axios.post(
        `${LOCAL_AI_BASE_URL}/chat/completions`, 
        {
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an embedding generation system. Your job is to convert text into numerical vectors."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer dummy-key'
          }
        }
      );
      
      // Extract the vector from the response
      // This will be very inefficient, but it's a workaround
      let vectorText = response.data.choices[0].message.content.trim();
      
      // Clean up the response (remove any non-vector text)
      vectorText = vectorText.replace(/[^\d,.\-e\s]/g, '');
      
      // Parse the vector
      const rawVector = vectorText.split(',').map(num => parseFloat(num.trim()));
      
      // Ensure we have the correct dimensions
      // If we have too few dimensions, pad with zeros
      // If we have too many, truncate
      const vector = new Array(this.dimensions).fill(0);
      for (let i = 0; i < Math.min(rawVector.length, this.dimensions); i++) {
        if (!isNaN(rawVector[i])) {
          vector[i] = rawVector[i];
        }
      }
      
      // Normalize the vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
      
    } catch (error) {
      console.error('Error generating embedding with LocalAI:', error.message);
      // Return a random vector as fallback (not ideal but prevents crashes)
      return Array(this.dimensions).fill(0).map(() => Math.random() * 2 - 1);
    }
  }
}

// Initialize our custom LocalAI embeddings
const embeddings = new LocalAIEmbeddings();

async function isChromaDBAvailable() {
  try {
    console.log(`Checking if ChromaDB is available on port ${CHROMA_PORT}...`);
    
    // Try using axios instead of fetch for the heartbeat check
    try {
      console.log(`Testing ChromaDB endpoint with axios: /api/v2/heartbeat`);
      const axiosResponse = await axios.get(`http://localhost:${CHROMA_PORT}/api/v2/heartbeat`, {
        headers: { 'Accept': 'application/json' },
        // Important: Set short timeout to avoid hanging
        timeout: 3000
      });
      
      console.log(`Axios response from /api/v2/heartbeat: status ${axiosResponse.status}`);
      
      if (axiosResponse.status >= 200 && axiosResponse.status < 300) {
        console.log(`ChromaDB is available (axios status ${axiosResponse.status})`);
        return true;
      }
    } catch (axiosErr) {
      console.log(`Axios error checking endpoint: ${axiosErr.message}`);
      // Continue to other methods if axios fails
    }
    
    // Try the direct client API approach
    try {
      console.log('Trying ChromaDB client API directly');
      const collections = await chromaClient.listCollections();
      console.log('Successfully listed ChromaDB collections:', collections.map(c => c.name));
      return true;
    } catch (clientErr) {
      console.log(`ChromaDB client API check failed: ${clientErr.message}`);
    }
    
    // Last resort: try curl-like request using Node's http module
    try {
      console.log('Attempting Node.js http module request');
      const http = await import('http');
      
      return new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port: CHROMA_PORT,
          path: '/api/v2/heartbeat',
          method: 'GET',
          timeout: 3000
        }, (res) => {
          console.log(`HTTP response status: ${res.statusCode}`);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('ChromaDB is available (http module check)');
            resolve(true);
          } else {
            console.log(`HTTP request returned non-200 status: ${res.statusCode}`);
            resolve(false);
          }
        });
        
        req.on('error', (err) => {
          console.log(`HTTP request error: ${err.message}`);
          resolve(false);
        });
        
        req.on('timeout', () => {
          console.log('HTTP request timed out');
          req.destroy();
          resolve(false);
        });
        
        req.end();
      });
    } catch (httpErr) {
      console.log(`HTTP module check failed: ${httpErr.message}`);
      return false;
    }
    
  } catch (error) {
    console.error(`Failed to connect to ChromaDB: ${error.message}`);
    return false;
  }
}

// Function to get collection statistics from ChromaDB
async function getCollectionStats() {
  const COLLECTION_NAME = "ableton_docs"; // Define collection name constant
  try {
    // First check if collection exists by listing all collections
    const collections = await chromaClient.listCollections();
    const collectionExists = collections.some(collection => collection.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      return {
        name: COLLECTION_NAME,
        exists: false,
        count: 0,
        message: "Collection does not exist"
      };
    }
    
    // If collection exists, get its details
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME
    });
    
    const count = await collection.count();
    
    return {
      name: COLLECTION_NAME,
      exists: true,
      id: collection.id || 'unknown',
      count: count || 0,
      metadata: collection.metadata || {}
    };
  } catch (error) {
    console.error('Error getting collection stats:', error);
    return {
      name: COLLECTION_NAME,
      exists: false,
      count: 'unknown',
      error: error.message
    };
  }
}

async function loadExistingVectorStore() {
  console.log('Checking for existing ChromaDB files...');
  
  try {
    // First check if ChromaDB is available
    const isAvailable = await isChromaDBAvailable();
    if (!isAvailable) {
      console.error('ChromaDB server is not available. Please start ChromaDB server first.');
      startChromaDBReconnection(); // Start reconnection attempts
      return null;
    }
    
    // Then check if our collection exists
    const stats = await getCollectionStats();
    if (!stats.exists) {
      console.log('No existing ChromaDB collection found.');
      return null;
    }
    
    console.log(`Found existing ChromaDB collection with ${stats.count} documents.`);
    console.log('Loading vector store...');
    
    const loadedVectorStore = await Chroma.load(
      "ableton_docs", // Collection name
      embeddings,
      { 
        url: `http://localhost:${CHROMA_PORT}`, // Default ChromaDB URL
        collectionName: "ableton_docs"
      }
    );
    console.log('ChromaDB vector store loaded successfully');
    return loadedVectorStore;
  } catch (error) {
    console.error('Error loading ChromaDB vector store:', error);
    return null;
  }
}

function createWorker(pdfPath, startPage, endPage) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', {
      workerData: { pdfPath, startPage, endPage }
    });

    let workerOutput = '';
    worker.on('message', (message) => {
      if (message.success) {
        resolve(message.data);
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}\nOutput: ${workerOutput}`));
      }
    });
  });
}

async function processInBatches(items, batchSize, processFunction, progressCallback) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const result = await processFunction(batches[i]);
    results.push(...result);
    progressCallback(i + 1, batches.length);
  }
  return results;
}

async function initializeVectorStore() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    // First try to load existing vector store
    console.log('Checking for existing vector store...');
    initializationProgress = 'Checking for existing vector store...';
    
    const existingStore = await loadExistingVectorStore();
    if (existingStore) {
      console.log('Using existing ChromaDB vector store');
      initializationProgress = 'Loaded existing vector store';
      vectorStore = existingStore;
      return;
    }

    // Only proceed with PDF processing if no existing store was found
    console.log('No existing vector store found, starting initialization...');
    initializationProgress = 'Starting initialization...';
    
    const pdfFiles = [
      'live12-manual-en.pdf'
    ];

    const numCPUs = cpus().length;
    const workersPerPDF = Math.max(2, Math.floor(numCPUs / pdfFiles.length));
    console.log(`Using ${workersPerPDF} workers per PDF on ${numCPUs} CPU cores`);

    const allProcessedChunks = await Promise.all(pdfFiles.map(async (pdfFile) => {
      const pdfPath = join(__dirname, 'pdf', pdfFile);
      console.log(`Processing ${pdfFile} with ${workersPerPDF} workers`);
      initializationProgress = `Processing ${pdfFile}...`;

      try {
        const { PDFLoader } = await import("langchain/document_loaders/fs/pdf");
        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();
        const totalPages = docs.length;
        
        const pagesPerWorker = Math.ceil(totalPages / workersPerPDF);
        const workerPromises = [];

        for (let i = 0; i < workersPerPDF; i++) {
          const startPage = i * pagesPerWorker + 1;
          const endPage = Math.min((i + 1) * pagesPerWorker, totalPages);
          
          if (startPage <= endPage) {
            console.log(`Creating worker for pages ${startPage}-${endPage}`);
            workerPromises.push(createWorker(pdfPath, startPage, endPage));
          }
        }

        const workerResults = await Promise.all(workerPromises);
        const flatResults = workerResults.flat();
        console.log(`Processed ${flatResults.length} chunks from ${pdfFile}`);
        return flatResults;
      } catch (error) {
        console.error(`Error processing ${pdfFile}:`, error);
        throw error;
      }
    }));

    const processedDocs = allProcessedChunks.flat();
    console.log(`Total processed chunks across all PDFs: ${processedDocs.length}`);

    if (processedDocs.length === 0) {
      throw new Error('No documents were processed successfully');
    }

    console.log('Creating ChromaDB vector store from processed documents...');
    initializationProgress = 'Generating embeddings...';

    const BATCH_SIZE = 100;
    
    await processInBatches(
      processedDocs,
      BATCH_SIZE,
      async (batch) => {
        console.log(`Processing batch of ${batch.length} documents...`);
        
        if (!vectorStore) {
          vectorStore = await Chroma.fromDocuments(
            batch.map(doc => ({
              pageContent: doc.pageContent.trim(),
              metadata: doc.metadata
            })),
            embeddings,
            {
              collectionName: "ableton_docs",
              url: `http://localhost:${CHROMA_PORT}`, // Default ChromaDB URL
              collectionMetadata: {
                "description": "Ableton Live documentation"
              }
            }
          );
        } else {
          await vectorStore.addDocuments(
            batch.map(doc => ({
              pageContent: doc.pageContent.trim(),
              metadata: doc.metadata
            }))
          );
        }
        return batch;
      },
      (batchNum, totalBatches) => {
        const progress = Math.round((batchNum / totalBatches) * 100);
        initializationProgress = `Generating embeddings: ${progress}% complete...`;
        console.log(`Embedding progress: ${progress}%`);
      }
    );

    console.log('ChromaDB vector store initialized successfully');
    initializationProgress = 'Initialization complete';
    initializationError = null;
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    initializationError = error;
    initializationProgress = 'Initialization failed';
    vectorStore = null;
  } finally {
    isInitializing = false;
  }
}

// Initialize on startup
initializeVectorStore().catch(console.error);

app.get('/api/health', (req, res) => {
  res.json({
    status: vectorStore ? 'ready' : 'initializing',
    error: initializationError ? initializationError.message : null,
    isInitializing,
    progress: initializationProgress
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!vectorStore) {
      if (isInitializing) {
        return res.status(503).json({ 
          error: 'Service is still initializing. Please try again in a moment.',
          status: 'initializing',
          progress: initializationProgress
        });
      }
      if (initializationError) {
        return res.status(500).json({ 
          error: 'Service failed to initialize. Please check the server logs.',
          details: initializationError.message
        });
      }
      await initializeVectorStore();
      if (!vectorStore) {
        return res.status(500).json({ error: 'Failed to initialize vector store' });
      }
    }

    const { message, filters = {}, k = 5 } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received question:', message);
    console.log('Using filters:', filters);
    
    console.log('Searching for relevant context...');
    
    // Advanced search with optional metadata filtering
    const searchOptions = { k: parseInt(k) };
    
    // If filters are provided, add them to the search
    if (Object.keys(filters).length > 0) {
      searchOptions.filter = filters;
    }
    
    // Perform the search with enhanced options
    let results;
    try {
      // Try metadata-filtered search if filters exist
      if (Object.keys(filters).length > 0) {
        results = await vectorStore.similaritySearch(
          message, 
          searchOptions.k,
          searchOptions.filter
        );
      } else {
        // Otherwise do a standard search
        results = await vectorStore.similaritySearch(message, searchOptions.k);
      }
      console.log(`Found ${results.length} relevant chunks`);
    } catch (error) {
      console.error('Error during vector search:', error);
      // Fallback to standard search if metadata filtering fails
      results = await vectorStore.similaritySearch(message, searchOptions.k);
      console.log(`Fallback search found ${results.length} relevant chunks`);
    }
    
    // No results found
    if (results.length === 0) {
      return res.json({ 
        response: "I couldn't find any relevant information to answer your question. Could you please rephrase or ask about another topic related to Ableton Live?",
        context: []
      });
    }
    
    const context = results.map(doc => doc.pageContent.trim()).join('\n\n');
    
    console.log('Generating response with GPT-4o Local...');
    const response = await model.invoke([
      ["system", `You are an Ableton Live expert assistant. Use the following context from the Ableton documentation to answer the user's question. Format your response using markdown with appropriate headings, lists, bold text, and code blocks where relevant. Only use information from the provided context, and if you cannot find relevant information, say so.

When referencing specific features, bold their names. When listing step-by-step instructions, use numbered lists. When explaining concepts, organize information with clear headings.

Context:
${context}`],
      ["human", message]
    ]);
    
    console.log('Response generated successfully');
    
    res.json({ 
      response: response.content,
      context: results.map(doc => ({
        content: doc.pageContent.trim(),
        metadata: doc.metadata
      }))
    });
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message
    });
  }
});

// ChromaDB management API
app.get('/api/vectorstore/stats', async (req, res) => {
  try {
    const isAvailable = await isChromaDBAvailable();
    if (!isAvailable) {
      return res.status(503).json({ 
        error: 'ChromaDB server is not available',
        status: 'unavailable'
      });
    }
    
    const stats = await getCollectionStats();
    return res.json({
      status: 'available',
      collection: stats,
      initialized: vectorStore !== null
    });
  } catch (error) {
    console.error('Error getting ChromaDB stats:', error);
    return res.status(500).json({ 
      error: 'Failed to get ChromaDB stats',
      details: error.message
    });
  }
});

// Add ability to reset the collection if needed during development
app.post('/api/vectorstore/reset', async (req, res) => {
  try {
    // Only allow in development mode for safety
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This operation is not allowed in production mode' });
    }
    
    const isAvailable = await isChromaDBAvailable();
    if (!isAvailable) {
      return res.status(503).json({ error: 'ChromaDB server is not available' });
    }
    
    const stats = await getCollectionStats();
    if (stats.exists) {
      try {
        await chromaClient.deleteCollection({ name: "ableton_docs" });
        console.log('ChromaDB collection deleted successfully');
        
        // Reset the application state
        vectorStore = null;
        isInitializing = false;
        initializationError = null;
        initializationProgress = '';
        
        return res.json({ 
          status: 'success',
          message: 'Collection reset successfully' 
        });
      } catch (error) {
        console.error('Error resetting ChromaDB collection:', error);
        return res.status(500).json({ 
          error: 'Failed to reset ChromaDB collection',
          details: error.message
        });
      }
    } else {
      return res.json({ 
        status: 'success',
        message: 'No collection to reset' 
      });
    }
  } catch (error) {
    console.error('Error processing reset request:', error);
    return res.status(500).json({ 
      error: 'Failed to process reset request',
      details: error.message 
    });
  }
});

// Enhance the ChromaDB status endpoint
app.get('/api/chromadb-status', async (req, res) => {
  try {
    // Check if ChromaDB is available
    const isAvailable = await isChromaDBAvailable();
    
    // Get collection stats if ChromaDB is available
    let collectionStats = null;
    if (isAvailable) {
      collectionStats = await getCollectionStats();
    }
    
    // Return comprehensive status information
    res.json({
      available: isAvailable,
      collection: collectionStats,
      diagnostics: {
        chromaHost: 'localhost',
        chromaPort: CHROMA_PORT,
        initialized: vectorStore !== null,
        isInitializing
      },
      troubleshooting: {
        suggestions: [
          "Make sure ChromaDB server is running",
          `Check that it's running on the expected port (${CHROMA_PORT})`,
          "Try running the start-chromadb.sh script",
          "Check logs/chromadb.log for error messages",
          "Ensure you have enough disk space and memory"
        ],
        configuration: {
          configPath: CHROMA_CONFIG_PATH
        }
      }
    });
  } catch (error) {
    console.error('Error checking ChromaDB status:', error);
    res.status(500).json({ 
      error: 'Failed to check ChromaDB status',
      details: error.message,
      available: false
    });
  }
});

const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Check ChromaDB availability on startup
  const chromaAvailable = await isChromaDBAvailable();
  if (!chromaAvailable) {
    console.error(`
=======================================================
WARNING: ChromaDB is not available on port ${CHROMA_PORT}
=======================================================

The application may not function correctly without ChromaDB.
To start ChromaDB, run:
  ./start-chromadb.sh
  
If ChromaDB is already running on a different port,
check the ./configuration/chroma_config.json file.
=======================================================
`);
  } else {
    console.log(`✅ Connected to ChromaDB on port ${CHROMA_PORT}`);
  }
});

// Perform startup diagnostics
(async () => {
  console.log('\n=== Ableton HelpBot Startup Diagnostics ===');
  
  // Check ChromaDB
  const chromaAvailable = await isChromaDBAvailable();
  if (chromaAvailable) {
    console.log(`✅ ChromaDB is available on port ${CHROMA_PORT}`);
  } else {
    console.log(`❌ ChromaDB is NOT available on port ${CHROMA_PORT}`);
    console.log(`   Try running the ChromaDB server with: ./start-chromadb.sh`);
    console.log(`   If the problem persists, check if another service is using port ${CHROMA_PORT}`);
  }
  
  // Check vector store directory
  if (existsSync(VECTOR_STORE_PATH)) {
    console.log(`✅ Vector store directory exists at ${VECTOR_STORE_PATH}`);
  } else {
    console.log(`⚠️ Vector store directory not found at ${VECTOR_STORE_PATH}`);
    console.log(`   Documents may need to be indexed before queries will work`);
  }
  
  console.log('=========================================\n');
})();

// Add a reconnection mechanism to periodically check ChromaDB
let chromaDBReconnectionInterval = null;
let chromaDBLastError = null;
let chromaDBLastCheck = null;
let chromaDBReconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 10;
const RECONNECTION_INTERVAL = 10000; // 10 seconds

function startChromaDBReconnection() {
  if (chromaDBReconnectionInterval) {
    return; // Already attempting to reconnect
  }
  
  console.log('Starting ChromaDB reconnection attempts...');
  chromaDBReconnectionAttempts = 0;
  
  chromaDBReconnectionInterval = setInterval(async () => {
    chromaDBReconnectionAttempts++;
    console.log(`ChromaDB reconnection attempt ${chromaDBReconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}`);
    
    try {
      chromaDBLastCheck = new Date();
      const isAvailable = await isChromaDBAvailable();
      
      if (isAvailable) {
        console.log('ChromaDB connection restored! Initializing vector store...');
        clearInterval(chromaDBReconnectionInterval);
        chromaDBReconnectionInterval = null;
        chromaDBLastError = null;
        
        // Re-initialize the vector store now that ChromaDB is available
        await initializeVectorStore();
      } else {
        chromaDBLastError = new Error('ChromaDB is still unavailable');
      }
    } catch (error) {
      console.error('Error during ChromaDB reconnection attempt:', error);
      chromaDBLastError = error;
    }
    
    // Stop trying after max attempts
    if (chromaDBReconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS && chromaDBReconnectionInterval) {
      console.error(`Reached maximum ChromaDB reconnection attempts (${MAX_RECONNECTION_ATTEMPTS}). Giving up.`);
      clearInterval(chromaDBReconnectionInterval);
      chromaDBReconnectionInterval = null;
    }
  }, RECONNECTION_INTERVAL);
}
