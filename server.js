import express from 'express';
import cors from 'cors';
import { Worker } from 'worker_threads';
import { Ollama } from "@langchain/community/llms/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cpus } from 'os';
import { existsSync, mkdirSync } from 'fs';
import  fetch  from 'node-fetch';

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

const model = new Ollama({
  baseUrl: "http://localhost:11434",
  model: "mistral",
  fetch: fetch 
});

const embeddings = new OllamaEmbeddings({
  baseUrl: "http://localhost:11434",
  model: "mistral",
  maxConcurrency: 5,
  batchSize: 512
});

async function loadExistingVectorStore() {
  const indexPath = join(VECTOR_STORE_PATH, 'hnswlib.index');
  const docStorePath = join(VECTOR_STORE_PATH, 'docstore.json');
  
  console.log('Checking for vector store files:');
  console.log(`- Index path: ${indexPath}`);
  console.log(`- Docstore path: ${docStorePath}`);
  
  if (existsSync(indexPath) && existsSync(docStorePath)) {
    console.log('Found existing vector store files');
    try {
      console.log('Loading vector store...');
      const loadedVectorStore = await HNSWLib.load(
        VECTOR_STORE_PATH,
        embeddings
      );
      console.log('Vector store loaded successfully');
      return loadedVectorStore;
    } catch (error) {
      console.error('Error loading vector store:', error);
      return null;
    }
  } else {
    console.log('Missing vector store files:');
    if (!existsSync(indexPath)) console.log('- Missing index file');
    if (!existsSync(docStorePath)) console.log('- Missing docstore file');
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
      console.log('Using existing vector store');
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

    console.log('Creating vector store from processed documents...');
    initializationProgress = 'Generating embeddings...';

    const BATCH_SIZE = 100;
    let currentVectorStore = null;

    await processInBatches(
      processedDocs,
      BATCH_SIZE,
      async (batch) => {
        console.log(`Processing batch of ${batch.length} documents...`);
        if (!currentVectorStore) {
          currentVectorStore = await HNSWLib.fromTexts(
            batch.map(doc => doc.pageContent.trim()),
            batch.map(doc => doc.metadata),
            embeddings
          );
        } else {
          await currentVectorStore.addDocuments(
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

    vectorStore = currentVectorStore;

    console.log('Saving vector store...');
    initializationProgress = 'Saving vector store...';
    await vectorStore.save(VECTOR_STORE_PATH);

    console.log('Vector store initialized and saved successfully');
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

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received question:', message);
    
    console.log('Searching for relevant context...');
    const results = await vectorStore.similaritySearch(message, 5);
    console.log(`Found ${results.length} relevant chunks`);
    
    const context = results.map(doc => doc.pageContent.trim()).join('\n\n');
    
    console.log('Generating response with Ollama...');
    const prompt = `You are an Ableton Live expert assistant. Use the following context from the Ableton documentation to answer the user's question. Format your response using markdown with appropriate headings, lists, bold text, and code blocks where relevant. Only use information from the provided context, and if you cannot find relevant information, say so.

Context:
${context}

User Question: ${message}

Answer (use markdown formatting):`.trim();

    const response = await model.call(prompt);
    console.log('Response generated successfully');
    
    res.json({ 
      response: response.trim(),
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
