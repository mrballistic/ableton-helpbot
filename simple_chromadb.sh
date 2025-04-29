#!/bin/bash
# Simple ChromaDB startup script using direct module execution

# Activate Python 3.10 environment
source chromadb_venv/bin/activate

# Create vector_store directory if it doesn't exist
mkdir -p ./vector_store

echo "Starting ChromaDB server on port 8000..."

# Run ChromaDB using the direct module command without trying to import internal components
python -m chromadb.app --host 0.0.0.0 --port 8000 --path ./vector_store