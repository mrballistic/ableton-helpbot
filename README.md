# Ableton Documentation Assistant

A local chatbot that helps you find information from Ableton's documentation using a RAG (Retrieval Augmented Generation) architecture.

## Prerequisites

1. **Install Ollama**
   ```bash
   # On macOS using Homebrew
   brew install ollama

   # After installation, start Ollama
   ollama serve

   # In a new terminal, pull the Mistral model
   ollama pull mistral
   ```
   For other platforms, visit [ollama.ai](https://ollama.ai) for installation instructions.

2. **Python Environment**
   ```bash
   # Create and activate a Python virtual environment
   python -m venv venv
   source venv/bin/activate  # On Unix/macOS
   # OR
   .\venv\Scripts\activate  # On Windows

   # Install ChromaDB
   pip install chromadb
   ```

## Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Start both the frontend and backend servers:
   ```bash
   npm start
   ```

   This will start:
   - Frontend development server at [http://localhost:5173](http://localhost:5173)
   - Backend server at [http://localhost:3000](http://localhost:3000)

## Usage

1. Ensure all services are running:
   - Ollama service with Mistral model
   - Backend Express server
   - Frontend development server

2. Open [http://localhost:5173](http://localhost:5173) in your browser
3. Wait for the backend to initialize (it will load and process the PDF documents on first run)
4. Start asking questions about Ableton in the chat interface

## Features

- Real-time chat interface built with React and Material-UI
- RAG (Retrieval Augmented Generation) architecture:
  - PDF document processing and chunking
  - Vector storage in ChromaDB
  - Semantic search for relevant context
  - Response generation using Ollama (Mistral model)
- Error handling and loading states
- Responsive design

## Architecture

This application uses a RAG (Retrieval Augmented Generation) architecture:

1. **Backend (Express.js)**
   - Handles PDF document processing and storage
   - Manages ChromaDB interactions
   - Coordinates with Ollama for response generation
   - Provides RESTful API endpoints

2. **Frontend (React + MUI)**
   - Modern, responsive chat interface
   - Real-time interaction with backend
   - Error handling and loading states

3. **Document Processing**
   - PDFs are loaded and split into chunks
   - Chunks are stored in ChromaDB with embeddings
   - Semantic search finds relevant context for queries

4. **Response Generation**
   - Relevant document chunks are retrieved
   - Context is combined with user query
   - Mistral model generates contextual responses

## Troubleshooting

1. **Ollama Issues**
   - Install Ollama if not installed: `brew install ollama` (macOS)
   - Start Ollama service: `ollama serve`
   - Pull Mistral model: `ollama pull mistral`
   - Verify installation: `ollama list`

2. **ChromaDB Issues**
   - Check Python virtual environment is activated
   - Verify ChromaDB installation: `pip list | grep chromadb`
   - Check file permissions for the database directory

3. **Backend Server Issues**
   - Check if server is running on port 3000
   - Look for initialization errors in console
   - Verify PDF files are accessible

4. **Frontend Issues**
   - Clear browser cache
   - Check browser console for errors
   - Verify connection to backend server
