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

# Check if ChromaDB is already running
if pgrep -f "chroma run" > /dev/null || pgrep -f "chromadb.app" > /dev/null; then
  echo "Warning: ChromaDB may already be running. Attempting to stop existing instances..."
  pkill -f "chroma run"
  pkill -f "chromadb.app"
  sleep 2
fi

# Try primary port first, then fall back to alternatives
PORTS=(8000 8001 8002)
CHROMA_PORT=""

for PORT in "${PORTS[@]}"; do
  if ! lsof -i:$PORT > /dev/null 2>&1; then
    CHROMA_PORT=$PORT
    break
  fi
done

if [ -z "$CHROMA_PORT" ]; then
  echo "Error: All ports (8000, 8001, 8002) are in use. Please free up one of these ports and try again."
  exit 1
fi

# Start ChromaDB server with vector_store path
echo "Starting ChromaDB server on port $CHROMA_PORT..."
echo "Press Ctrl+C to stop the server"
echo "Logging output to ./logs/chromadb.log"

# Run ChromaDB using the dedicated chroma command-line tool
# This is the proper way to run ChromaDB server for version 1.0.7
chroma run --host 0.0.0.0 --port $CHROMA_PORT --path ./vector_store > ./logs/chromadb.log 2>&1 &

# Save the PID of the ChromaDB process
CHROMA_PID=$!

# Give it a moment to start
sleep 2

# Check if the process is still running
if ps -p $CHROMA_PID > /dev/null; then
  echo "ChromaDB server started successfully with PID: $CHROMA_PID"
  echo "To stop the server: kill $CHROMA_PID"
  
  # Create a configuration file with the port information
  echo "{\"port\": $CHROMA_PORT}" > ./configuration/chroma_config.json
  echo "Configuration saved to ./configuration/chroma_config.json"
else
  echo "Error: ChromaDB server failed to start."
  echo "Check the log file at ./logs/chromadb.log for details."
  cat ./logs/chromadb.log
  exit 1
fi