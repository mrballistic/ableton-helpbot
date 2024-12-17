import request from 'supertest';
import { jest } from '@jest/globals';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  ...jest.requireActual('fs')
}));

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
  HNSWLib: {
    fromTexts: jest.fn().mockResolvedValue({
      save: jest.fn().mockResolvedValue(undefined),
      similaritySearch: jest.fn().mockResolvedValue([
        { pageContent: 'Relevant content 1', metadata: { source: 'test.pdf', page: 1 } },
        { pageContent: 'Relevant content 2', metadata: { source: 'test.pdf', page: 2 } }
      ]),
      addDocuments: jest.fn().mockResolvedValue(undefined)
    }),
    load: jest.fn().mockResolvedValue({
      similaritySearch: jest.fn().mockResolvedValue([
        { pageContent: 'Loaded content 1', metadata: { source: 'test.pdf', page: 1 } },
        { pageContent: 'Loaded content 2', metadata: { source: 'test.pdf', page: 2 } }
      ])
    })
  }
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
              metadata: { loc: { pageNumber: 1 } }
            }
          ]
        });
      }
    },
    postMessage: jest.fn()
  }));
}

describe('Server API', () => {
  let app;
  const HNSWLib = require('@langchain/community/vectorstores/hnswlib').HNSWLib;

  beforeEach(async () => {
    jest.resetModules();
    mockWorkerSuccess();
    fs.existsSync.mockImplementation(() => false);
    app = (await import('./server.js')).app;
  });

  describe('Vector Store Management', () => {
    it('creates new vector store when none exists', async () => {
      fs.existsSync.mockImplementation(() => false);
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(HNSWLib.fromTexts).toHaveBeenCalled();
    });

    it('loads existing vector store when available', async () => {
      fs.existsSync.mockImplementation(() => true);
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(HNSWLib.load).toHaveBeenCalled();
    });

    it('handles vector store save errors', async () => {
      fs.existsSync.mockImplementation(() => false);
      HNSWLib.fromTexts.mockRejectedValueOnce(new Error('Save failed'));
      
      const response = await request(app).get('/api/health');
      expect(response.body.error).toBeTruthy();
    });

    it('handles vector store load errors', async () => {
      fs.existsSync.mockImplementation(() => true);
      HNSWLib.load.mockRejectedValueOnce(new Error('Load failed'));
      
      const response = await request(app).get('/api/health');
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Worker Thread Management', () => {
    it('creates correct number of workers based on CPU cores', async () => {
      const response = await request(app).get('/api/health');
      expect(Worker).toHaveBeenCalled();
      expect(Worker.mock.calls.length).toBeGreaterThan(0);
    });

    it('handles worker errors gracefully', async () => {
      Worker.mockImplementation(() => ({
        on: (event, callback) => {
          if (event === 'error') {
            callback(new Error('Worker error'));
          }
        },
        postMessage: jest.fn()
      }));

      const response = await request(app).get('/api/health');
      expect(response.body.error).toBeTruthy();
    });

    it('processes chunks in parallel', async () => {
      let processedChunks = 0;
      Worker.mockImplementation(() => ({
        on: (event, callback) => {
          if (event === 'message') {
            processedChunks++;
            callback({
              success: true,
              data: [{
                pageContent: `Test content ${processedChunks}`,
                metadata: { loc: { pageNumber: processedChunks } }
              }]
            });
          }
        },
        postMessage: jest.fn()
      }));

      const response = await request(app).post('/api/chat').send({ message: 'test' });
      expect(processedChunks).toBeGreaterThan(1);
    });
  });

  describe('API Endpoints', () => {
    it('returns initialization status and progress', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('isInitializing');
      expect(response.body).toHaveProperty('progress');
    });

    it('handles chat requests with loaded vector store', async () => {
      fs.existsSync.mockImplementation(() => true);
      
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'What is Session View?' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('context');
    });

    it('returns 503 when initializing', async () => {
      fs.existsSync.mockImplementation(() => false);
      HNSWLib.fromTexts.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'test' });

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'initializing');
    });
  });

  describe('Error Handling', () => {
    it('handles missing vector store directory', async () => {
      fs.existsSync.mockImplementation(() => false);
      fs.mkdirSync.mockImplementationOnce(() => { throw new Error('Permission denied'); });

      const response = await request(app).get('/api/health');
      expect(response.body.error).toBeTruthy();
    });

    it('handles PDF processing errors', async () => {
      const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
      PDFLoader.mockImplementationOnce(() => ({
        load: jest.fn().mockRejectedValue(new Error('PDF Error'))
      }));

      const response = await request(app).get('/api/health');
      expect(response.body.error).toBeTruthy();
    });

    it('handles embedding generation errors', async () => {
      HNSWLib.fromTexts.mockRejectedValueOnce(new Error('Embedding Error'));

      const response = await request(app).get('/api/health');
      expect(response.body.error).toBeTruthy();
    });
  });
});
