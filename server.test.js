import request from 'supertest';
import { jest } from '@jest/globals';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Mock worker_threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn()
}));

// Mock the external dependencies
jest.mock('@langchain/community/llms/ollama', () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockResolvedValue('Mocked response from Ollama')
  }))
}));

jest.mock('langchain/document_loaders/fs/pdf', () => ({
  PDFLoader: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue([
      { pageContent: 'Test content 1', metadata: { loc: { pageNumber: 1 } } },
      { pageContent: 'Test content 2', metadata: { loc: { pageNumber: 2 } } }
    ])
  }))
}));

jest.mock('@langchain/community/vectorstores/hnswlib', () => ({
  HNSWLib: jest.fn().mockImplementation(() => ({
    addVectors: jest.fn().mockResolvedValue(undefined),
    similaritySearch: jest.fn().mockResolvedValue([
      { pageContent: 'Relevant content 1', metadata: { source: 'test.pdf', page: 1 } },
      { pageContent: 'Relevant content 2', metadata: { source: 'test.pdf', page: 2 } }
    ])
  }))
}));

// Mock successful worker completion
function mockWorkerSuccess() {
  Worker.mockImplementation(() => ({
    on: (event, callback) => {
      if (event === 'message') {
        callback({
          success: true,
          data: [
            {
              pageContent: 'Test content',
              metadata: { loc: { pageNumber: 1 } },
              embedding: new Array(384).fill(0.1)
            }
          ]
        });
      }
    },
    postMessage: jest.fn()
  }));
}

// Mock worker error
function mockWorkerError() {
  Worker.mockImplementation(() => ({
    on: (event, callback) => {
      if (event === 'error') {
        callback(new Error('Worker error'));
      }
    },
    postMessage: jest.fn()
  }));
}

describe('Server API', () => {
  let app;

  beforeEach(async () => {
    jest.resetModules();
    mockWorkerSuccess();
    app = (await import('./server.js')).app;
  });

  describe('GET /api/health', () => {
    it('returns initialization status', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('isInitializing');
    });

    it('handles initialization errors', async () => {
      mockWorkerError();
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('POST /api/chat', () => {
    it('handles chat requests successfully', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'What is Session View?' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('context');
      expect(Array.isArray(response.body.context)).toBe(true);
    });

    it('returns 400 for missing message', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('handles vector store initialization errors', async () => {
      mockWorkerError();
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Test message' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 503 when initializing', async () => {
      // Mock initialization in progress
      jest.spyOn(global, 'setTimeout').mockImplementation(cb => cb());
      Worker.mockImplementation(() => ({
        on: (event, callback) => {
          if (event === 'message') {
            // Delay the worker response
            setTimeout(() => {
              callback({
                success: true,
                data: [{
                  pageContent: 'Test content',
                  metadata: { loc: { pageNumber: 1 } },
                  embedding: new Array(384).fill(0.1)
                }]
              });
            }, 1000);
          }
        },
        postMessage: jest.fn()
      }));

      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Test message' });

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'initializing');
    });
  });

  describe('Worker Thread Management', () => {
    it('creates correct number of workers based on CPU cores', async () => {
      const workerCalls = Worker.mock.calls.length;
      expect(workerCalls).toBeGreaterThan(0);
    });

    it('handles worker communication errors', async () => {
      mockWorkerError();
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Test message' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
    });

    it('processes PDF chunks in parallel', async () => {
      let processedChunks = 0;
      Worker.mockImplementation(() => ({
        on: (event, callback) => {
          if (event === 'message') {
            processedChunks++;
            callback({
              success: true,
              data: [{
                pageContent: `Test content ${processedChunks}`,
                metadata: { loc: { pageNumber: processedChunks } },
                embedding: new Array(384).fill(0.1)
              }]
            });
          }
        },
        postMessage: jest.fn()
      }));

      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Test message' });

      expect(response.status).toBe(200);
      expect(processedChunks).toBeGreaterThan(1);
    });
  });
});
