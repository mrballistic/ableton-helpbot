import { jest } from '@jest/globals';
import { Worker, parentPort, workerData } from 'worker_threads';

// Mock the worker threads module
jest.mock('worker_threads', () => ({
  parentPort: {
    postMessage: jest.fn()
  },
  workerData: {
    pdfPath: 'test.pdf',
    startPage: 1,
    endPage: 5
  }
}));

// Mock the langchain modules
jest.mock('langchain/document_loaders/fs/pdf', () => ({
  PDFLoader: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue([
      { pageContent: 'Test content 1', metadata: { loc: { pageNumber: 1 } } },
      { pageContent: 'Test content 2', metadata: { loc: { pageNumber: 2 } } }
    ])
  }))
}));

jest.mock('@langchain/community/embeddings/ollama', () => ({
  OllamaEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockImplementation(texts => 
      Promise.resolve(texts.map(() => new Array(384).fill(0.1)))
    )
  }))
}));

describe('PDF Processing Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes PDF chunks and generates embeddings', async () => {
    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify the worker posted a message with the processed data
    expect(parentPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            pageContent: expect.any(String),
            metadata: expect.any(Object),
            embedding: expect.any(Array)
          })
        ])
      })
    );
  });

  it('handles PDF loading errors', async () => {
    // Mock PDF loader to throw an error
    jest.mock('langchain/document_loaders/fs/pdf', () => ({
      PDFLoader: jest.fn().mockImplementation(() => ({
        load: jest.fn().mockRejectedValue(new Error('Failed to load PDF'))
      }))
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify error handling
    expect(parentPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.any(String)
      })
    );
  });

  it('handles embedding generation errors', async () => {
    // Mock embeddings to throw an error
    jest.mock('@langchain/community/embeddings/ollama', () => ({
      OllamaEmbeddings: jest.fn().mockImplementation(() => ({
        embedDocuments: jest.fn().mockRejectedValue(new Error('Embedding failed'))
      }))
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify error handling
    expect(parentPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.any(String)
      })
    );
  });

  it('processes documents in batches', async () => {
    // Mock PDF loader to return more documents
    jest.mock('langchain/document_loaders/fs/pdf', () => ({
      PDFLoader: jest.fn().mockImplementation(() => ({
        load: jest.fn().mockResolvedValue(
          Array(10).fill().map((_, i) => ({
            pageContent: `Test content ${i + 1}`,
            metadata: { loc: { pageNumber: i + 1 } }
          }))
        )
      }))
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify batched processing
    const message = parentPort.postMessage.mock.calls[0][0];
    expect(message.success).toBe(true);
    expect(message.data.length).toBeGreaterThan(0);
    expect(message.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageContent: expect.any(String),
          metadata: expect.any(Object),
          embedding: expect.any(Array)
        })
      ])
    );
  });
});
