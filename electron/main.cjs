const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ollamaManager = require('./ollama.cjs');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

// Initialize services
let vectorStore = null;
let isInitializing = false;
let initializationError = null;
let initializationProgress = '';

async function initializeVectorStore() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    mainWindow.webContents.send('status-update', 'Starting vector store initialization...');
    
    // Ensure Ollama is running before initializing
    await ollamaManager.ensureRunning();
    mainWindow.webContents.send('status-update', 'Ollama is running, proceeding with vector store initialization');

    const { HNSWLib } = await import("@langchain/community/vectorstores/hnswlib");
    const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");
    
    const embeddings = new OllamaEmbeddings({
      baseUrl: "http://localhost:11434",
      model: "mistral",
    });

    mainWindow.webContents.send('initialization-progress', 'Loading vector store...');
    
    // Try multiple possible vector store locations
    const possiblePaths = [
      path.join(app.getAppPath(), 'vector_store'),
      path.join(process.resourcesPath, 'vector_store'),
      path.join(app.getAppPath(), '..', 'vector_store')
    ];

    mainWindow.webContents.send('status-update', 'Checking possible vector store paths:');
    possiblePaths.forEach(p => mainWindow.webContents.send('status-update', `- ${p}`));

    const vectorStorePath = possiblePaths.find(p => fs.existsSync(p));
    
    if (!vectorStorePath) {
      console.error('Vector store not found in any of these locations:', possiblePaths);
      throw new Error('Vector store not found in any expected location');
    }

    mainWindow.webContents.send('status-update', `Found vector store at: ${vectorStorePath}`);

    mainWindow.webContents.send('status-update', 'Loading vector store from path...');
    vectorStore = await HNSWLib.load(vectorStorePath, embeddings);
    mainWindow.webContents.send('status-update', 'Vector store loaded successfully');
    
    mainWindow.webContents.send('initialization-progress', 'Vector store loaded');
    initializationError = null;
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    console.error('Error stack:', error.stack);
    initializationError = error;
    mainWindow.webContents.send('initialization-progress', 'Initialization failed');
    vectorStore = null;
  } finally {
    isInitializing = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false,
      preload: isDev 
        ? MAIN_WINDOW_PRELOAD_VITE_ENTRY 
        : path.join(app.getAppPath(), '.vite/build/preload.cjs')
    }
  });

  // Disable security warnings
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = path.join(app.getAppPath(), '.vite/renderer/index.html');
    console.log('Loading renderer from:', rendererPath);
    mainWindow.loadFile(rendererPath);
    mainWindow.webContents.openDevTools(); // Temporarily enable DevTools in production
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

  // Initialize vector store handler
  ipcMain.handle('initialize', initializeVectorStore);
}

// Start the app
app.whenReady().then(async () => {
  try {
    console.log('Starting application...');
    // Start Ollama before creating the window
    await ollamaManager.start();
    console.log('Ollama started successfully');
    
    createWindow();
    console.log('Window created successfully');
    
    // Initialize vector store after window is created
    await initializeVectorStore();
    console.log('Vector store initialized successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    console.error('Error stack:', error.stack);
    await dialog.showErrorBox('Startup Error', 
      `Failed to start application: ${error.message}\n\nCheck the logs for more details.`
    );
    app.quit();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Cleanup handlers
app.on('window-all-closed', async function () {
  console.log('All windows closed, cleaning up...');
  await ollamaManager.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  console.log('Application quitting, stopping Ollama...');
  await ollamaManager.stop();
});

// Handle any uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await ollamaManager.stop();
  app.quit();
});

process.on('unhandledRejection', async (error) => {
  console.error('Unhandled rejection:', error);
  await ollamaManager.stop();
  app.quit();
});
