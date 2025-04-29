# ChromaDB Setup for Ableton Documentation Assistant

## Overview

This document details the configuration and optimization of ChromaDB for the Ableton Documentation Assistant project. ChromaDB serves as the vector database, replacing the previous HNSWLib implementation to provide more efficient storage, better metadata filtering capabilities, and improved scalability.

## Installation

### Prerequisites

- Python 3.10 (specifically required for ChromaDB compatibility)
- Node.js 20+ LTS (for the main application)

### Installation Steps

1. Create a Python 3.10 virtual environment (required):
```bash
# Check if Python 3.10 is available
which python3.10

# If not available, install it using your package manager
# For macOS with Homebrew: brew install python@3.10

# Create the virtual environment with Python 3.10
python3.10 -m venv chromadb_venv
source chromadb_venv/bin/activate
```

2. Install ChromaDB via pip:
```bash
pip install chromadb==1.0.7
```

3. Install other Python dependencies:
```bash
pip install pypdf langchain-community langchain
```

4. Install the Node.js ChromaDB client:
```bash
npm install chromadb
```

## Running ChromaDB Server

ChromaDB 1.0.7 provides a dedicated command-line tool called `chroma` that should be used to start the server. Use the provided start-chromadb.sh script which activates the correct Python 3.10 environment:

```bash
./start-chromadb.sh
```

If you need to run ChromaDB manually, ensure you're using the Python 3.10 environment and the `chroma` command:

```bash
source chromadb_venv/bin/activate
chroma run --host 0.0.0.0 --port 8000 --path ./vector_store
```

Key parameters:
- `--host`: Sets the listening address (0.0.0.0 listens on all interfaces)
- `--port`: Sets the server port (8000 by default)
- `--path`: Specifies the directory for persistent storage

> **Important**: ChromaDB 1.0.7 is compatible with Python 3.10 but may not work properly with newer Python versions like 3.13. Additionally, do NOT attempt to start the server using `python -m chromadb.app` as this approach doesn't work with version 1.0.7. Instead, always use the `chroma run` command.

For the Ableton Documentation Assistant, use:
```bash
python -m chromadb.app --port 8000 --host 0.0.0.0 --path /Users/todd.greco/Documents/manual/ableton-helpbot/vector_store
```

## Integration with the Application

### Client Configuration

In your Node.js application, ChromaDB is integrated through LangChain using the `Chroma` class from `@langchain/community/vectorstores/chroma`:

```javascript
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

// Initialize embeddings for ChromaDB
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: "sk-no-key-required-for-local", // Placeholder for local deployment
  modelName: "text-embedding-3-small", // Compatible with LocalAI
  basePath: "http://localhost:1234/v1",
});

// Load existing vector store
const vectorStore = await Chroma.load(
  VECTOR_STORE_PATH,
  embeddings,
  { 
    collectionName: "ableton_docs",
    url: "http://localhost:8000" // Default ChromaDB URL
  }
);
```

### Creating a New Collection

When initializing from documents:

```javascript
const vectorStore = await Chroma.fromDocuments(
  documents,
  embeddings,
  {
    collectionName: "ableton_docs",
    url: "http://localhost:8000",
    collectionMetadata: {
      "description": "Ableton Live documentation"
    }
  }
);
```

### Adding Documents

To add additional documents to an existing collection:

```javascript
await vectorStore.addDocuments(documents);
```

## Optimizing ChromaDB

### Collection Settings

ChromaDB collections can be optimized with the following settings:

```javascript
const collectionOptions = {
  collectionName: "ableton_docs",
  url: "http://localhost:8000",
  collectionMetadata: {
    "description": "Ableton Live documentation"
  },
  embeddingFunction: embeddings // Your custom embedding function
};
```

### Recommended Optimization Parameters

For Ableton documentation, the following parameters are recommended for optimal performance:

1. **Chunk Size for Documents**: 1000-1500 tokens per chunk with 200 token overlap
2. **Distance Metric**: Cosine similarity (default in ChromaDB)
3. **Top-K Results**: 5-7 documents for most queries
4. **Metadata Filtering**: Enhance relevance with document section metadata

### Batch Processing

To optimize memory usage and performance during large document processing:

```javascript
const BATCH_SIZE = 100;

await processInBatches(
  processedDocs,
  BATCH_SIZE,
  async (batch) => {
    console.log(`Processing batch of ${batch.length} documents...`);
    
    if (!vectorStore) {
      vectorStore = await Chroma.fromDocuments(
        batch,
        embeddings,
        collectionOptions
      );
    } else {
      await vectorStore.addDocuments(batch);
    }
    return batch;
  }
);
```

## Query Optimization

### Basic Query

```javascript
const results = await vectorStore.similaritySearch(query, 5);
```

### Advanced Query with Metadata Filtering

```javascript
const results = await vectorStore.similaritySearch(
  query, 
  5, 
  { section: "Instruments" } // Filter by metadata
);
```

### Hybrid Search

For better relevance, consider implementing hybrid search combining vector similarity with keyword matching:

```javascript
const results = await vectorStore.similaritySearch(
  query, 
  10 // Get more results initially
);

// Then apply custom reranking based on your criteria
const rerankedResults = customReranker(results, query);
```

## Data Persistence

ChromaDB stores its data on disk by default. The persistence directory can be specified when starting the server:

```bash
python -m chromadb.server --port 8000 --host 0.0.0.0 --path /path/to/storage
```

For the Ableton Documentation Assistant, we're using the application's `vector_store` directory.

## Migration from HNSWLib

Migration steps from HNSWLib to ChromaDB:

1. Export documents and metadata from HNSWLib
2. Initialize ChromaDB collection
3. Import documents with their embeddings and metadata

Note: In some cases, it may be more efficient to reprocess PDFs directly into ChromaDB rather than migrating from HNSWLib.

## Monitoring and Maintenance

### Collection Statistics

```javascript
const client = new ChromaClient({ path: "http://localhost:8000" });
const collection = await client.getCollection("ableton_docs");
const stats = await collection.count();
console.log(`Total documents in collection: ${stats}`);
```

### Reset Collection

If you need to reset the ChromaDB collection:

```javascript
const client = new ChromaClient({ path: "http://localhost:8000" });
await client.deleteCollection("ableton_docs");
```

## Startup Sequence

1. Start ChromaDB server
2. Verify ChromaDB is running and accessible
3. Start LocalAI (for embeddings generation)
4. Start the Ableton Documentation Assistant application

## Troubleshooting

### ChromaDB Server Not Responding

If the ChromaDB server is not responding:
1. Check if the server is running with `ps aux | grep chromadb`
2. Verify the port is correct and not in use by another service
3. Check logs for any Python dependency issues
4. Restart the ChromaDB server

### Slow Query Performance

If queries are slow:
1. Consider increasing batch size for processing
2. Optimize chunk sizes of documents
3. Add more relevant metadata for filtering
4. Consider adding indices on frequently queried metadata fields

### Memory Issues

If encountering memory problems:
1. Reduce batch processing size
2. Implement smarter chunking of documents
3. Monitor memory usage during processing

## Future Enhancements

- **Metadata Enhancement**: Add more structured metadata to improve filtering
- **Incremental Updates**: Implement efficient document additions without full reprocessing
- **Custom Embeddings**: Experiment with domain-specific embedding models for music production
- **Document Pre-filtering**: Add system to pre-filter documents before embedding
- **Result Caching**: Implement caching for frequent queries
- **Collection Backups**: Add automatic backup procedures for the vector database