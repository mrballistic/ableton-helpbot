import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import ollamaManager from './ollama.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

// Initialize services
let vectorStore = null;
let isInitializing = false;
let initializationError = null;
let initializationProgress = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev 
        ? MAIN_WINDOW_PRELOAD_VITE_ENTRY 
        : path.join(__dirname, 'preload.cjs')
    }
  });

  // Disable security warnings
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Set up IPC handlers
  setupIPCHandlers();
}

function setupIPCHandlers() {
  // Health check handler
  ipcMain.handle('health-check', async () => {
    return {
      status: vectorStore ? 'ready' : 'initializing',
      error: initializationError ? initializationError.message : null,
      isInitializing,
      progress: initializationProgress
    };
  });

  // Chat handler
  ipcMain.handle('chat', async (event, message) => {
    if (!vectorStore) {
      throw new Error('Vector store not initialized');
    }

    // Ensure Ollama is running
    await ollamaManager.ensureRunning();

    const { HNSWLib } = await import("@langchain/community/vectorstores/hnswlib");
    const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");
    const { Ollama } = await import("@langchain/community/llms/ollama");

    const model = new Ollama({
      baseUrl: "http://localhost:11434",
      model: "mistral",
    });

    const results = await vectorStore.similaritySearch(message, 5);
    const context = results.map(doc => doc.pageContent.trim()).join('\n\n');
    
    const prompt = `You are an Ableton Live expert assistant. Use the following context from the Ableton documentation to answer the user's question. Format your response using markdown with appropriate headings, lists, bold text, and code blocks where relevant. Only use information from the provided context, and if you cannot find relevant information, say so.

Context:
${context}

User Question: ${message}

Answer (use markdown formatting):`.trim();

    const response = await model.call(prompt);
    
    return {
      response: response.trim(),
      context: results.map(doc => ({
        content: doc.pageContent.trim(),
        metadata: doc.metadata
      }))
    };
  });

  // Initialize vector store
  ipcMain.handle('initialize', async () => {
    if (isInitializing) return;
    isInitializing = true;

    try {
      // Ensure Ollama is running before initializing
      await ollamaManager.ensureRunning();

      const { HNSWLib } = await import("@langchain/community/vectorstores/hnswlib");
      const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");
      
      const embeddings = new OllamaEmbeddings({
        baseUrl: "http://localhost:11434",
        model: "mistral",
      });

      mainWindow.webContents.send('initialization-progress', 'Loading vector store...');
      
      vectorStore = await HNSWLib.load(
        process.env.VECTOR_STORE_PATH || path.join(__dirname, '../vector_store'),
        embeddings
      );
      
      mainWindow.webContents.send('initialization-progress', 'Vector store loaded');
      initializationError = null;
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      initializationError = error;
      mainWindow.webContents.send('initialization-progress', 'Initialization failed');
      vectorStore = null;
    } finally {
      isInitializing = false;
    }
  });
}

// Start the app
app.whenReady().then(async () => {
  try {
    // Start Ollama before creating the window
    await ollamaManager.start();
    createWindow();
  } catch (error) {
    console.error('Failed to start Ollama:', error);
    await dialog.showErrorBox('Startup Error', 
      `Failed to start application: ${error.message}\n\nCheck the logs for more details.`
    );
    app.quit();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Cleanup
app.on('window-all-closed', function () {
  ollamaManager.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  ollamaManager.stop();
});
