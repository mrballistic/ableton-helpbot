const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { https } = require('follow-redirects');
const { app } = require('electron');

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
    console.log('Extracting Ollama from local zip...');
    const isDev = process.env.NODE_ENV === 'development';
    const zipPath = isDev 
      ? path.join(__dirname, '../src/ollama/Ollama-darwin.zip')
      : path.join(process.resourcesPath, 'ollama/Ollama-darwin.zip');
    
    // Extract the binary from the zip
    const unzip = spawn('unzip', ['-p', zipPath, 'Ollama.app/Contents/Resources/ollama'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Write the binary to our destination
    const writeStream = fs.createWriteStream(this.binaryPath);
    unzip.stdout.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log('Ollama binary extracted successfully');
        resolve();
      });

      writeStream.on('error', (err) => {
        console.error('Error writing Ollama binary:', err);
        reject(err);
      });

      unzip.on('error', (err) => {
        console.error('Error extracting Ollama:', err);
        reject(err);
      });

      unzip.stderr.on('data', (data) => {
        console.log('Unzip output:', data.toString());
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
      const net = require('net');
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
      console.log('Starting Ollama...');
      await this.ensureOllamaInstalled();

      console.log('Checking Ollama status...');
      const isRunning = await this.checkOllamaRunning();

      if (isRunning) {
        console.log('Ollama is already running');
        this.ollamaProcess = true; // Mark as running without actual process
      } else {

      const isDev = process.env.NODE_ENV === 'development';
      const vectorStorePath = isDev
        ? path.join(__dirname, '../vector_store')
        : path.join(process.resourcesPath, 'vector_store');

      const env = {
        ...process.env,
        OLLAMA_MODELS: this.modelPath,
        OLLAMA_HOST: 'localhost:11434',
        PATH: process.env.PATH,
        VECTOR_STORE_PATH: vectorStorePath
      };

        console.log('Launching Ollama process...');
        this.ollamaProcess = spawn(this.binaryPath, ['serve'], {
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        });

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
        await new Promise((resolve) => setTimeout(resolve, 2000));
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

  stop() {
    if (this.ollamaProcess) {
      console.log('Stopping Ollama process...');
      this.ollamaProcess.kill();
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
