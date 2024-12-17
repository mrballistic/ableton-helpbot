import express from 'express';
import cors from 'cors';
import { Worker } from 'worker_threads';
import { Ollama } from "@langchain/community/llms/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cpus } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
let vectorStore = null;
let isInitializing = false;
let initializationError = null;
let initializationProgress = '';

const model = new Ollama({
  baseUrl: "http://localhost:11434",
  model: "mistral",
});

const embeddings = new OllamaEmbeddings({
  baseUrl: "http://localhost:11434",
  model: "mistral",
  maxConcurrency: 5,
  batchSize: 512  // Process embeddings in smaller batches
});

// Function to create a worker for processing PDF chunks
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
    console.log('Starting parallel vector store initialization...');
    initializationProgress = 'Starting initialization...';
    
    const pdfFiles = [
      'live12-manual-en.pdf'
    ];

    // Process each PDF in parallel with multiple workers per PDF
    const numCPUs = cpus().length;
    const workersPerPDF = Math.max(2, Math.floor(numCPUs / pdfFiles.length));
    console.log(`Using ${workersPerPDF} workers per PDF on ${numCPUs} CPU cores`);

    const allProcessedChunks = await Promise.all(pdfFiles.map(async (pdfFile) => {
      const pdfPath = join(__dirname, 'pdf', pdfFile);
      console.log(`Processing ${pdfFile} with ${workersPerPDF} workers`);
      initializationProgress = `Processing ${pdfFile}...`;

      try {
        // Get total pages in PDF
        const { PDFLoader } = await import("langchain/document_loaders/fs/pdf");
        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();
        const totalPages = docs.length;
        
        // Create workers for page ranges
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

        // Wait for all workers to complete and combine their results
        const workerResults = await Promise.all(workerPromises);
        const flatResults = workerResults.flat();
        console.log(`Processed ${flatResults.length} chunks from ${pdfFile}`);
        return flatResults;
      } catch (error) {
        console.error(`Error processing ${pdfFile}:`, error);
        throw error;
      }
    }));

    // Combine all processed chunks
    const processedDocs = allProcessedChunks.flat();
    console.log(`Total processed chunks across all PDFs: ${processedDocs.length}`);

    if (processedDocs.length === 0) {
      throw new Error('No documents were processed successfully');
    }

    // Create vector store from processed documents in batches
    console.log('Creating vector store from processed documents...');
    initializationProgress = 'Generating embeddings...';

    // Process in batches of 100 documents
    const BATCH_SIZE = 100;
    let currentVectorStore = null;

    await processInBatches(
      processedDocs,
      BATCH_SIZE,
      async (batch) => {
        console.log(`Processing batch of ${batch.length} documents...`);
        if (!currentVectorStore) {
          // Create initial vector store
          currentVectorStore = await HNSWLib.fromTexts(
            batch.map(doc => doc.pageContent),
            batch.map(doc => doc.metadata),
            embeddings
          );
        } else {
          // Add to existing vector store
          await currentVectorStore.addDocuments(
            batch.map(doc => ({
              pageContent: doc.pageContent,
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

    vectorStore = currentVectorStore;
    console.log('Vector store initialized successfully');
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: vectorStore ? 'ready' : 'initializing',
    error: initializationError ? initializationError.message : null,
    isInitializing,
    progress: initializationProgress
  });
});

// API endpoints
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
      // Try to initialize if not already done
      await initializeVectorStore();
      if (!vectorStore) {
        return res.status(500).json({ error: 'Failed to initialize vector store' });
      }
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received question:', message);
    
    // Get relevant context
    console.log('Searching for relevant context...');
    const results = await vectorStore.similaritySearch(message, 5);
    console.log(`Found ${results.length} relevant chunks`);
    
    const context = results.map(doc => doc.pageContent).join('\n\n');
    
    // Generate response using Ollama
    console.log('Generating response with Ollama...');
    const prompt = `You are an Ableton Live expert assistant. Use the following context from the Ableton documentation to answer the user's question. Only use information from the provided context, and if you cannot find relevant information, say so.

Context:
${context}

User Question: ${message}

Answer: `;

    const response = await model.call(prompt);
    console.log('Response generated successfully');
    
    res.json({ 
      response,
      context: results.map(doc => ({
        content: doc.pageContent,
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
