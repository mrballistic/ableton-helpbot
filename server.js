import express from 'express';
import cors from 'cors';
import { Worker } from 'worker_threads';
import { ChatOpenAI } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cpus } from 'os';
import { existsSync, mkdirSync, rmdirSync } from 'fs';
import { ChromaClient } from 'chromadb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a directory for storing the vector database
const VECTOR_STORE_PATH = join(__dirname, 'vector_store');
if (!existsSync(VECTOR_STORE_PATH)) {
  mkdirSync(VECTOR_STORE_PATH);
}

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
let vectorStore = null;
let isInitializing = false;
let initializationError = null;
let initializationProgress = '';

// Initialize GPT-4o Local model
const model = new ChatOpenAI({
  openAIApiKey: "sk-no-key-required-for-local", // Reverted to openAIApiKey
  modelName: "gpt-4o",
  temperature: 0.2, // Lower temperature for more factual responses
  maxTokens: 2000, // Sufficient for detailed responses
  basePath: "http://localhost:1234/v1" // Reverted to basePath
});

// Initialize embeddings for ChromaDB
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: "dummy-key", // Simple API key for LocalAI
  modelName: "text-embedding-ada-002", // Use a model name that LocalAI recognizes
  basePath: "http://localhost:1234/v1"
});

// Initialize ChromaDB client for direct operations
const chromaClient = new ChromaClient({ path: "http://localhost:8000" });

/**
 * Checks if ChromaDB is available and running
 * @returns {Promise<boolean>} True if ChromaDB is available, false otherwise
 */
async function isChromaDBAvailable() {
  try {
    await chromaClient.heartbeat();
    return true;
  } catch (error) {
    console.error('ChromaDB is not available:', error.message);
    return false;
  }
}

/**
 * Gets statistics about the ChromaDB collection
 * @returns {Promise<Object>} Collection statistics
 */
async function getCollectionStats() {
  try {
    const collections = await chromaClient.listCollections();
    const abletonCollection = collections.find(c => c.name === "ableton_docs");
    
    if (abletonCollection) {
      const collection = await chromaClient.getCollection({ name: "ableton_docs" });
      const count = await collection.count();
      return { 
        exists: true, 
        count,
        name: "ableton_docs"
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error getting collection stats:', error.message);
    return { error: error.message };
  }
}

async function loadExistingVectorStore() {
  console.log('Checking for existing ChromaDB files...');
  
  try {
    // First check if ChromaDB is available
    const isAvailable = await isChromaDBAvailable();
    if (!isAvailable) {
      console.error('ChromaDB server is not available. Please start ChromaDB server first.');
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
        url: "http://localhost:8000", // Default ChromaDB URL
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
              url: "http://localhost:8000", // Default ChromaDB URL
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
