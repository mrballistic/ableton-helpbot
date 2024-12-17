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

describe('PDF Processing Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes PDF pages within specified range', async () => {
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
            metadata: expect.objectContaining({
              loc: expect.objectContaining({
                pageNumber: expect.any(Number)
              })
            })
          })
        ])
      })
    );
  });

  it('handles PDF loading errors', async () => {
    const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
    PDFLoader.mockImplementationOnce(() => ({
      load: jest.fn().mockRejectedValue(new Error('Failed to load PDF'))
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify error handling
    expect(parentPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Failed to load PDF')
      })
    );
  });

  it('splits documents into chunks', async () => {
    const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
    PDFLoader.mockImplementationOnce(() => ({
      load: jest.fn().mockResolvedValue([
        { pageContent: 'A'.repeat(2000), metadata: { loc: { pageNumber: 1 } } }
      ])
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify chunks were created
    const message = parentPort.postMessage.mock.calls[0][0];
    expect(message.success).toBe(true);
    expect(message.data.length).toBeGreaterThan(1); // Should split into multiple chunks
  });

  it('preserves metadata in chunks', async () => {
    const testMetadata = {
      loc: { pageNumber: 1, fileName: 'test.pdf' },
      custom: 'value'
    };

    const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
    PDFLoader.mockImplementationOnce(() => ({
      load: jest.fn().mockResolvedValue([
        { pageContent: 'Test content', metadata: testMetadata }
      ])
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify metadata preservation
    const message = parentPort.postMessage.mock.calls[0][0];
    expect(message.success).toBe(true);
    expect(message.data[0].metadata).toEqual(
      expect.objectContaining(testMetadata)
    );
  });

  it('respects page range filters', async () => {
    const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
    const loadMock = jest.fn().mockResolvedValue([
      { pageContent: 'Page 1', metadata: { loc: { pageNumber: 1 } } },
      { pageContent: 'Page 2', metadata: { loc: { pageNumber: 2 } } },
      { pageContent: 'Page 3', metadata: { loc: { pageNumber: 3 } } }
    ]);

    PDFLoader.mockImplementationOnce(() => ({
      load: loadMock
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify page filtering
    expect(PDFLoader).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        splitPages: true,
        pageFilter: expect.any(Function)
      })
    );
  });

  it('handles empty documents gracefully', async () => {
    const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
    PDFLoader.mockImplementationOnce(() => ({
      load: jest.fn().mockResolvedValue([])
    }));

    // Import the worker code
    await import('./worker.js');

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify empty document handling
    const message = parentPort.postMessage.mock.calls[0][0];
    expect(message.success).toBe(true);
    expect(message.data).toEqual([]);
  });
});
