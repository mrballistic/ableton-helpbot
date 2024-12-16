import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    fromDocuments: jest.fn().mockResolvedValue({
      similaritySearch: jest.fn().mockResolvedValue([
        { pageContent: 'Relevant content 1', metadata: { source: 'test.pdf', page: 1 } },
        { pageContent: 'Relevant content 2', metadata: { source: 'test.pdf', page: 2 } }
      ])
    })
  }
}));

jest.mock('@langchain/community/embeddings/ollama', () => ({
  OllamaEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
  }))
}));

// Import the server app
const { app } = await import('./server.js');

describe('Server API', () => {
  describe('GET /api/health', () => {
    it('returns initialization status', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('isInitializing');
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

    it('handles errors gracefully', async () => {
      // Mock a failure in the vector store
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs
      const vectorStore = await import('@langchain/community/vectorstores/hnswlib');
      vectorStore.HNSWLib.fromDocuments.mockRejectedValueOnce(new Error('Test error'));

      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Test message' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid JSON', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('handles missing content type', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send('raw body');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Initialization', () => {
    it('initializes vector store on startup', async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app).get('/api/health');
      expect(response.body.isInitializing).toBe(false);
    });

    it('handles initialization errors', async () => {
      // Mock a failure in PDF loading
      const pdfLoader = await import('langchain/document_loaders/fs/pdf');
      pdfLoader.PDFLoader.mockImplementationOnce(() => ({
        load: jest.fn().mockRejectedValue(new Error('Failed to load PDF'))
      }));

      // Trigger reinitialization
      await request(app).get('/api/health');

      const response = await request(app).get('/api/health');
      expect(response.body).toHaveProperty('error');
    });
  });
});
