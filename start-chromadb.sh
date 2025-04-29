#!/bin/bash
# ChromaDB startup script for Ableton Documentation Assistant

# Go to project directory
cd "$(dirname "$0")"

# Activate the new Python 3.10 virtual environment
source chromadb_venv/bin/activate

# Create log directory if it doesn't exist
mkdir -p ./logs

# Check if chromadb is installed
if ! pip show chromadb > /dev/null; then
  echo "Error: ChromaDB is not installed in the virtual environment."
  echo "Please install it with: pip install chromadb"
  exit 1
fi

# Create vector_store directory if it doesn't exist
if [ ! -d "./vector_store" ]; then
  mkdir -p ./vector_store
  echo "Created vector_store directory."
fi

# Start ChromaDB server with vector_store path
echo "Starting ChromaDB server on port 8000..."
echo "Press Ctrl+C to stop the server"
echo "Logging output to ./logs/chromadb.log"

# Run ChromaDB with all output (including errors) redirected to a log file
python -m chromadb.app --port 8000 --host 0.0.0.0 --path ./vector_store --log-level DEBUG > ./logs/chromadb.log 2>&1 &

# Save the PID of the ChromaDB process
CHROMA_PID=$!

# Give it a moment to start
sleep 2

# Check if the process is still running
if ps -p $CHROMA_PID > /dev/null; then
  echo "ChromaDB server started successfully with PID: $CHROMA_PID"
  echo "To stop the server: kill $CHROMA_PID"
else
  echo "Error: ChromaDB server failed to start."
  echo "Check the log file at ./logs/chromadb.log for details."
  cat ./logs/chromadb.log
  exit 1
fi