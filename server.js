import express from 'express';
import cors from 'cors';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Ollama } from "@langchain/community/llms/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
let vectorStore = null;
let isInitializing = false;
let initializationError = null;

const model = new Ollama({
  baseUrl: "http://localhost:11434",
  model: "mistral",
});

const embeddings = new OllamaEmbeddings({
  baseUrl: "http://localhost:11434",
  model: "mistral",
  maxConcurrency: 5
});

async function initializeVectorStore() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    console.log('Starting vector store initialization...');
    const pdfFiles = [
      'live12-manual-en.pdf'
    ];

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    let allDocs = [];
    for (const pdfFile of pdfFiles) {
      try {
        const pdfPath = join(__dirname, 'pdf', pdfFile);
        console.log(`Loading ${pdfFile}...`);
        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();
        console.log(`Splitting ${pdfFile} into chunks...`);
        const chunks = await splitter.splitDocuments(docs);
        allDocs = [...allDocs, ...chunks];
        console.log(`Processed ${pdfFile} - ${chunks.length} chunks created`);
      } catch (error) {
        console.error(`Error processing ${pdfFile}:`, error);
        throw error;
      }
    }

    console.log('Creating embeddings and vector store...');
    vectorStore = await HNSWLib.fromDocuments(allDocs, embeddings);
    console.log('Vector store initialized successfully');
    initializationError = null;
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    initializationError = error;
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
    isInitializing
  });
});

// API endpoints
app.post('/api/chat', async (req, res) => {
  try {
    if (!vectorStore) {
      if (isInitializing) {
        return res.status(503).json({ 
          error: 'Service is still initializing. Please try again in a moment.',
          status: 'initializing'
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
