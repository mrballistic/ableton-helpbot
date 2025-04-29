# 🎹 Ableton Documentation Assistant

A 🤖 RAG-based chatbot that provides answers from Ableton Live's documentation using local LLM processing.

## ✨ Features

- 🏠 Local LLM processing using LocalAI with GPT-4o
- 📄 PDF document processing with parallel workers
- 💾 Vector store persistence using ChromaDB
- 🌓 Automatic dark/light mode
- ♿ Accessibility support
- ⏱️ Real-time initialization progress
- 🧠 Memory-efficient processing
- ✍️ Markdown rendering with code highlighting
- 📚 Source context display

## 🔧 Prerequisites

- 📦 Node.js 20+ LTS
- 🐍 Python 3.10 (specifically required for ChromaDB compatibility)
- 🤖 LocalAI installed with GPT-4o model
- 🗃️ ChromaDB server running on port 8000

### 🐍 Python Dependencies
```bash
# Create a Python 3.10 virtual environment (required for ChromaDB)
python3.10 -m venv chromadb_venv
source chromadb_venv/bin/activate

# Install required packages
pip install chromadb==1.0.7 pypdf langchain-community langchain
```

### 🤖 LocalAI Setup
```bash
# Configure LocalAI with GPT-4o model
# Make sure the model is located at ~/.localai/models/gpt-4o.gguf

# For GPU acceleration (optional):
export METAL=1  # For Apple Silicon
# OR
export CUDA=1  # For NVIDIA GPUs

# Start LocalAI server
local-ai serve --models-path ~/.localai/models --config-path ~/.localai/configs --address 0.0.0.0:1234 --disable-grpc
```

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/mrballistic/ableton-helpbot.git
cd ableton-helpbot
```

2. Install dependencies:
```bash
npm install
```

3. Place Ableton PDF documentation in the `/pdf` directory:
```
pdf/
└── live12-manual-en.pdf
```

## 🏃‍♂️ Running the Application

1. Start the ChromaDB server:
```bash
./start-chromadb.sh
```

> **Important**: ChromaDB 1.0.7 requires using the dedicated `chroma run` command-line tool. If running manually, use:
> ```bash
> source chromadb_venv/bin/activate
> chroma run --host 0.0.0.0 --port 8000 --path ./vector_store
> ```
> Do NOT attempt to start ChromaDB using `python -m chromadb.app` as this won't work with version 1.0.7.

2. Start LocalAI with GPT-4o model:
```bash
# With GPU acceleration (recommended)
./update_localai_gpu.sh

# OR without GPU acceleration
local-ai serve --models-path ~/.localai/models --config-path ~/.localai/configs --address 0.0.0.0:1234 --disable-grpc
```

3. Start the application:
```bash
npm start
```

This will:
- 🌐 Start the React development server
- 🖥️ Launch the Express backend
- 📑 Process PDFs (first run only)
- 🗄️ Create and save the vector store in ChromaDB

## 🏗️ Architecture

### 🌐 Frontend
- ⚛️ React with Material-UI
- 🌓 Automatic dark/light mode detection
- ⏱️ Real-time initialization progress
- ♿ Accessibility features
- 📱 Responsive design
- ✍️ Markdown rendering with syntax highlighting

### 🖥️ Backend
- 🚂 Express server
- 🧵 PDF processing with worker threads
- 🗄️ Vector store management with ChromaDB
- 🤖 LLM integration via LocalAI
- 🚨 Error handling
- 🔄 Python bridge for PDF processing

### 📊 Vector Store
- 🔍 ChromaDB for efficient similarity search
- 💾 Persistent storage
- 📦 Batched processing
- 🧠 Memory-efficient operation
- 🏷️ Enhanced metadata filtering

### ⚙️ Processing Pipeline
1. 📄 PDF Loading
   - 🔄 Parallel processing with worker threads
   - 📑 Page-range distribution
   - 📈 Progress tracking
   - 🐍 Python-based text extraction

2. 📝 Text Processing
   - 🧩 Chunk generation
   - 📋 Metadata preservation
   - 📦 Batch processing
   - 🔤 LocalAI for embeddings

3. 🗄️ Vector Store
   - 🧮 Embedding generation via LocalAI
   - 💾 Persistent storage with ChromaDB
   - ⚡ Fast loading
   - 🔍 Enhanced similarity search

## 👨‍💻 Development

### 🧪 Running Tests
```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
npm run test:backend

# Run specific component tests
npm test ChatBubble.test.jsx
npm test ChatInterface.test.jsx
npm test InitializationModal.test.jsx
npm test VisuallyHidden.test.jsx

# Generate coverage report
npm run test:coverage
```

### 📁 Project Structure
```
├── src/                      # Frontend source
│   ├── components/           # React components
│   │   ├── ChatBubble.jsx   # Message bubble component
│   │   ├── ChatInterface.jsx # Main chat interface
│   │   └── InitializationModal.jsx # Loading modal
│   ├── helpers/             # Helper components
│   │   └── VisuallyHidden.jsx # Accessibility helper
│   ├── App.jsx             # Main React component
│   └── index.css           # Global styles
├── tests/                  # Test files
│   ├── components/         # Component tests
│   │   ├── ChatBubble.test.jsx
│   │   ├── ChatInterface.test.jsx
│   │   └── InitializationModal.test.jsx
│   ├── helpers/           # Helper tests
│   │   └── VisuallyHidden.test.jsx
│   └── App.test.jsx       # Integration tests
├── server.js              # Express backend
├── worker.js             # PDF processing worker
├── pdf/                  # PDF documentation
├── vector_store/         # Persistent vector storage
│   ├── args.json         # Vector store arguments
│   ├── chroma.sqlite3    # ChromaDB database
│   └── docstore.json     # Document metadata
├── configuration/        # Configuration files
│   └── chroma_config.json # ChromaDB configuration
├── chromadb_venv/        # Python 3.10 virtual environment for ChromaDB
├── start-chromadb.sh     # Script to start ChromaDB server
└── update_localai_gpu.sh # Script to start LocalAI with GPU acceleration
```

### 🧩 Components

#### 💬 ChatBubble
- 📝 Renders user and assistant messages
- ✍️ Markdown rendering with syntax highlighting
- 📚 Source context display
- ♿ Accessibility support

#### 💻 ChatInterface
- 🗨️ Main chat interface
- ⌨️ Message input handling
- 📜 Message history management
- ⏳ Loading states

#### 🔄 InitializationModal
- 📊 Displays initialization progress
- ⏱️ Real-time status updates
- 📈 Progress tracking

#### 👁️‍🗨️ VisuallyHidden
- ♿ Accessibility helper component
- 🔊 Screen reader support
- 🏷️ ARIA announcements

### 🧪 Testing Structure
- 🔬 Unit tests for each component
- 🔄 Integration tests for full flows
- ♿ Accessibility testing
- 🚨 Error handling coverage
- ⏳ Loading state verification
- 🤝 Component interaction tests

## ⚡ Performance

- 🔄 First run: Processes PDFs and creates vector store (~30-60 minutes)
- ⚡ Subsequent runs: Loads existing vector store (seconds)
- 🧠 Memory usage: Efficient through batched processing
- 💪 CPU usage: Parallel processing based on available cores
- 🖥️ GPU acceleration: Optional for LocalAI when hardware supports it

## 🚨 Known Issues & Troubleshooting

### ChromaDB Issues
- 🐍 Requires specifically Python 3.10 (fails silently with newer versions like 3.13)
- 🏃 Must be started using the `chroma run` command (NOT `python -m chromadb.app`)
- 💓 Heartbeat check requires using API v2 endpoint
- 🏁 Needs to be started before the application

### LocalAI Issues
- 🔑 Embedding generation requires specific model name "text-embedding-3-small" for compatibility
- 🖥️ GPU acceleration requires properly configured CUDA or Metal support
- 🏁 Needs to be running with correct models loaded before application usage

### General Issues
- ⏱️ Initial PDF processing takes significant time for large documents
- 💾 No progress persistence if initialization is interrupted
- 🔄 No automatic migration path from HNSWLib to ChromaDB vectors

## ♿ Accessibility

- 🔊 Screen reader support
- ⌨️ Keyboard navigation
- 🏷️ ARIA labels
- 📢 Progress announcements
- 🎨 Color contrast compliance
- 🔍 Focus management
- 👁️‍🗨️ Hidden helper elements

## 👥 Contributing

1. 🍴 Fork the repository
2. 🌿 Create a feature branch
3. 💾 Commit changes
4. 🚀 Push to the branch
5. 📬 Create a Pull Request

## 📜 License

See [LICENSE.md](license.md) for details.
