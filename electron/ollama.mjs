import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { https } from 'follow-redirects';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const options = {
        rejectUnauthorized: true,
        headers: {
          'User-Agent': 'Ableton AI Chatbot'
        }
      };
      
      https.get(ollamaUrl, options, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          https.get(response.headers.location, options, (redirectResponse) => {
            redirectResponse.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          }).on('error', reject);
        } else {
          response.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        }
      }).on('error', reject);
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
        ? path.join(__dirname, '..', 'vector_store')
        : path.join(process.resourcesPath, 'vector_store');
      
      console.log('Vector store path:', vectorStorePath);
      if (!fs.existsSync(vectorStorePath)) {
        console.error('Vector store not found at:', vectorStorePath);
        throw new Error(`Vector store not found at: ${vectorStorePath}`);
      }

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
    if (this.ollamaProcess && typeof this.ollamaProcess !== 'boolean') {
      console.log('Stopping Ollama process...');
      this.ollamaProcess.kill();
      this.ollamaProcess = null;
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

export default new OllamaManager();
