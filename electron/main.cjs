const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ollamaManager = require('./ollama.cjs');
const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
const { Ollama } = require('@langchain/community/llms/ollama');

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
    
    // Create embeddings instance
    mainWindow.webContents.send('status-update', 'Creating embeddings instance...');
    const embeddings = new OllamaEmbeddings({
      baseUrl: "http://localhost:11434",
      model: "mistral",
    });

    // Try multiple possible vector store locations, prioritizing resources directory
    const possiblePaths = isDev
      ? [
          path.join(app.getAppPath(), 'vector_store'),
          path.join(app.getAppPath(), '..', 'vector_store')
        ]
      : [
          path.join(process.resourcesPath, 'vector_store'),
          path.join(app.getAppPath(), 'vector_store'),
          path.join(app.getAppPath(), '..', 'vector_store'),
          path.join(app.getAppPath(), 'app.asar', 'vector_store')
        ];

    mainWindow.webContents.send('status-update', 'Checking possible vector store paths:');
    possiblePaths.forEach(p => mainWindow.webContents.send('status-update', `- ${p}`));

    const vectorStorePath = possiblePaths.find(p => fs.existsSync(p));
    
    if (!vectorStorePath) {
      const error = new Error('Vector store not found in any expected location');
      mainWindow.webContents.send('status-update', error.message);
      throw error;
    }

    mainWindow.webContents.send('status-update', `Found vector store at: ${vectorStorePath}`);

    // Load vector store
    mainWindow.webContents.send('status-update', 'Loading vector store from path...');
    try {
      vectorStore = await HNSWLib.load(vectorStorePath, embeddings);
      mainWindow.webContents.send('status-update', 'Vector store loaded successfully');
    } catch (error) {
      mainWindow.webContents.send('status-update', `Failed to load vector store: ${error.message}`);
      throw error;
    }
    
    mainWindow.webContents.send('initialization-progress', 'Vector store loaded');
    initializationError = null;
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    console.error('Error stack:', error.stack);
    mainWindow.webContents.send('status-update', `Error: ${error.message}`);
    initializationError = error;
    mainWindow.webContents.send('initialization-progress', 'Initialization failed');
    vectorStore = null;
    throw error;
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
    const rendererPath = path.join(app.getAppPath(), '.vite/renderer/main_window/index.html');
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
    // Create window first so we can send status updates
    createWindow();
    
    // Wait for window to be ready
    await new Promise((resolve) => {
      mainWindow.webContents.on('did-finish-load', resolve);
    });
    
    mainWindow.webContents.send('status-update', 'Window created successfully');
    
    // Start Ollama after window is created
    mainWindow.webContents.send('status-update', 'Starting Ollama...');
    await ollamaManager.start();
    mainWindow.webContents.send('status-update', 'Ollama started successfully');
    
    // Wait a bit for Ollama to be fully ready
    mainWindow.webContents.send('status-update', 'Waiting for Ollama to be fully ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Initialize vector store
    mainWindow.webContents.send('status-update', 'Starting vector store initialization...');
    try {
      await initializeVectorStore();
      mainWindow.webContents.send('status-update', 'Vector store initialized successfully');
    } catch (error) {
      mainWindow.webContents.send('status-update', `Failed to initialize vector store: ${error.message}`);
      throw error;
    }
  } catch (error) {
    console.error('Failed to start application:', error);
    console.error('Error stack:', error.stack);
    if (mainWindow) {
      mainWindow.webContents.send('status-update', `Error: ${error.message}`);
    }
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
  mainWindow?.webContents.send('status-update', 'All windows closed, cleaning up...');
  await ollamaManager.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  mainWindow?.webContents.send('status-update', 'Application quitting, stopping Ollama...');
  await ollamaManager.stop();
});

// Handle any uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  mainWindow?.webContents.send('status-update', `Uncaught error: ${error.message}`);
  await ollamaManager.stop();
  app.quit();
});

process.on('unhandledRejection', async (error) => {
  console.error('Unhandled rejection:', error);
  mainWindow?.webContents.send('status-update', `Unhandled rejection: ${error.message}`);
  await ollamaManager.stop();
  app.quit();
});
