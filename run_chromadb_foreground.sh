#!/bin/bash
# Run ChromaDB in the foreground for debugging

# Activate Python 3.10 environment
source chromadb_venv/bin/activate

# Create the vector_store directory if it doesn't exist
if [ ! -d "./vector_store" ]; then
  mkdir -p ./vector_store
  echo "Created vector_store directory."
fi

echo "Starting ChromaDB server on port 8000..."

# Run the server directly with correct arguments
# Note: This uses a direct approach for ChromaDB 1.0.7
python -c "
from chromadb.app import app
from chromadb.config import Settings

settings = Settings(
    chroma_api_impl='chromadb.api.segment.SegmentAPI',
    chroma_db_impl='chromadb.db.duckdb.DuckDB',
    persist_directory='./vector_store'
)

server = app.ServerAPI(settings)
server.run(host='0.0.0.0', port=8000)
"
