const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app, BrowserWindow } = require('electron');
const net = require('net');

class OllamaManager {
  constructor() {
    this.ollamaProcess = null;
    this.isStarting = false;
    this.ollamaPath = path.join(app.getPath('userData'), '.ollama');
    this.binaryPath = path.join(this.ollamaPath, 'ollama');
    this.modelPath = path.join(this.ollamaPath, 'models');
  }

  async ensureOllamaInstalled() {
    if (!fs.existsSync(this.ollamaPath)) {
      fs.mkdirSync(this.ollamaPath, { recursive: true });
    }
    if (!fs.existsSync(this.modelPath)) {
      fs.mkdirSync(this.modelPath, { recursive: true });
    }

    if (!fs.existsSync(this.binaryPath)) {
      await this.downloadOllama();
      fs.chmodSync(this.binaryPath, 0o755);
    }
  }

  async downloadOllama() {
    console.log('Downloading Ollama...');
    const ollamaUrl = 'https://github.com/ollama/ollama/releases/latest/download/ollama-darwin';
    
    // Download the binary directly
    const writeStream = fs.createWriteStream(this.binaryPath);
    
    await new Promise((resolve, reject) => {
      const request = https.get(ollamaUrl, {
        headers: {
          'User-Agent': 'Ableton AI Chatbot'
        }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          console.log('Following redirect to:', response.headers.location);
          https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', (err) => {
              console.error('Write stream error:', err);
              reject(err);
            });
          }).on('error', (err) => {
            console.error('Redirect request error:', err);
            reject(err);
          });
        } else {
          response.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', (err) => {
            console.error('Write stream error:', err);
            reject(err);
          });
        }
      });

      request.on('error', (err) => {
        console.error('Initial request error:', err);
        console.error('Error details:', err.stack);
        reject(err);
      });
    });

    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log('Ollama binary downloaded successfully');
        resolve();
      });

      writeStream.on('error', (err) => {
        console.error('Error writing Ollama binary:', err);
        reject(err);
      });
    });
  }

  async pullModel() {
    return new Promise((resolve, reject) => {
      console.log('Starting model pull...');
      const pull = spawn(this.binaryPath, ['pull', 'mistral']);

      pull.stdout.on('data', (data) => {
        console.log(`Pull progress: ${data}`);
      });

      pull.stderr.on('data', (data) => {
        console.log(`Pull info: ${data}`);
      });

      pull.on('error', (err) => {
        console.error('Pull error:', err);
        reject(err);
      });

      pull.on('close', (code) => {
        if (code === 0) {
          console.log('Model pull completed successfully');
          resolve();
        } else {
          reject(new Error(`Pull failed with code ${code}`));
        }
      });
    });
  }

  async checkOllamaRunning() {
    return new Promise((resolve) => {
      const client = new net.Socket();
      
      client.on('connect', () => {
        client.end();
        resolve(true);
      });
      
      client.on('error', () => {
        resolve(false);
      });
      
      client.connect(11434, '127.0.0.1');
    });
  }

  async start() {
    if (this.ollamaProcess || this.isStarting) {
      console.log('Ollama is already starting or running');
      return;
    }

    this.isStarting = true;

    try {
      BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', 'Starting Ollama...');
      await this.ensureOllamaInstalled();

      BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', 'Checking Ollama status...');
      const isRunning = await this.checkOllamaRunning();

      if (isRunning) {
        console.log('Ollama is already running');
        this.ollamaProcess = true; // Mark as running without actual process
      } else {

      const isDev = process.env.NODE_ENV === 'development';
      // Try multiple possible vector store locations
      const possiblePaths = [
        path.join(app.getAppPath(), 'vector_store'),
        path.join(process.resourcesPath, 'vector_store'),
        path.join(app.getAppPath(), '..', 'vector_store')
      ];

      BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', 'Checking possible vector store paths for Ollama:');
      possiblePaths.forEach(p => BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', `- ${p}`));

      const vectorStorePath = possiblePaths.find(p => fs.existsSync(p));
      
      if (!vectorStorePath) {
        console.error('Vector store not found in any of these locations:', possiblePaths);
        throw new Error('Vector store not found in any expected location');
      }

      BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', `Found vector store at: ${vectorStorePath}`);

      const env = {
        ...process.env,
        OLLAMA_MODELS: this.modelPath,
        OLLAMA_HOST: 'localhost:11434',
        PATH: process.env.PATH,
        VECTOR_STORE_PATH: vectorStorePath,
        OLLAMA_ORIGINS: '*'  // Allow all origins for API access
      };

        console.log('Launching Ollama process with binary:', this.binaryPath);
        try {
          this.ollamaProcess = spawn(this.binaryPath, ['serve'], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true // Run in a new process group
          });
          BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', `Ollama process spawned with PID: ${this.ollamaProcess.pid}`);
        } catch (err) {
          console.error('Failed to spawn Ollama process:', err);
          throw err;
        }

        this.ollamaProcess.stdout.on('data', (data) => {
          console.log(`Ollama stdout: ${data}`);
        });

        this.ollamaProcess.stderr.on('data', (data) => {
          console.error(`Ollama stderr: ${data}`);
        });

        this.ollamaProcess.on('error', (err) => {
          console.error('Failed to start Ollama:', err);
          this.ollamaProcess = null;
        });

        this.ollamaProcess.on('exit', (code) => {
          console.log(`Ollama process exited with code ${code}`);
          this.ollamaProcess = null;
        });

        console.log('Waiting for Ollama to initialize...');
        // Wait for Ollama to be ready
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          const isRunning = await this.checkOllamaRunning();
          if (isRunning) {
            BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', 'Ollama server is ready');
            break;
          }
          BrowserWindow.getAllWindows()[0]?.webContents.send('status-update', 'Waiting for Ollama server to be ready...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        if (attempts === maxAttempts) {
          throw new Error('Ollama server failed to start after multiple attempts');
        }
      }

      // Only pull model if we started the process or if it's the first time
      if (!isRunning) {
        console.log('Pulling Mistral model...');
        await this.pullModel();
        console.log('Mistral model ready');
      }

    } catch (error) {
      console.error('Error starting Ollama:', error);
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  async stop() {
    if (this.ollamaProcess && typeof this.ollamaProcess !== 'boolean') {
      console.log('Stopping Ollama process...');
      try {
        // Try graceful shutdown first
        this.ollamaProcess.kill('SIGTERM');
        
        // Wait for process to exit
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('Force killing Ollama process...');
            this.ollamaProcess.kill('SIGKILL');
            resolve();
          }, 5000);

          this.ollamaProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        console.log('Ollama process stopped successfully');
      } catch (error) {
        console.error('Error stopping Ollama process:', error);
      } finally {
        this.ollamaProcess = null;
      }
    } else {
      console.log('No Ollama process to stop (externally managed)');
      this.ollamaProcess = null;
    }
  }

  async ensureRunning() {
    if (!this.ollamaProcess && !this.isStarting) {
      await this.start();
    }
  }
}

module.exports = new OllamaManager();
