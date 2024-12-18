# Ableton Documentation Assistant

A RAG-based chatbot that provides answers from Ableton Live's documentation using local LLM processing.

## Features

- Local LLM processing using Ollama
- PDF document processing with parallel workers
- Vector store persistence for fast startup
- Automatic dark/light mode
- Accessibility support
- Real-time initialization progress
- Memory-efficient processing
- Markdown rendering with code highlighting
- Source context display

## Prerequisites

- Node.js 18+
- Ollama installed (`brew install ollama` on macOS)
- The Mistral model pulled (`ollama pull mistral`)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd ableton-rag
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

## Running the Application

1. Start Ollama:
```bash
brew services start ollama
```

2. Start the application:
```bash
npm start
```

This will:
- Start the React development server
- Launch the Express backend
- Process PDFs (first run only)
- Create and save the vector store

## Architecture

### Frontend
- React with Material-UI
- Automatic dark/light mode detection
- Real-time initialization progress
- Accessibility features
- Responsive design
- Markdown rendering with syntax highlighting

### Backend
- Express server
- PDF processing with worker threads
- Vector store management
- LLM integration
- Error handling

### Vector Store
- HNSWLib for efficient similarity search
- Persistent storage
- Batched processing
- Memory-efficient operation

### Processing Pipeline
1. PDF Loading
   - Parallel processing with worker threads
   - Page-range distribution
   - Progress tracking

2. Text Processing
   - Chunk generation
   - Metadata preservation
   - Batch processing

3. Vector Store
   - Embedding generation
   - Persistent storage
   - Fast loading

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
npm run test:backend

# Generate coverage report
npm run test:coverage
```

### Project Structure
```
├── src/                      # Frontend source
│   ├── components/           # React components
│   │   ├── ChatBubble.jsx   # Message bubble component
│   │   ├── ChatInterface.jsx # Main chat interface
│   │   └── InitializationModal.jsx # Loading modal
│   ├── helpers/             # Helper components
│   │   └── VisuallyHidden.jsx # Accessibility helper
│   ├── App.jsx             # Main React component
│   ├── App.test.jsx        # Frontend tests
│   └── index.css           # Global styles
├── server.js               # Express backend
├── worker.js              # PDF processing worker
├── pdf/                   # PDF documentation
└── vector_store/          # Persistent vector storage
    ├── args.json          # Vector store arguments
    ├── docstore.json      # Document metadata
    └── hnswlib.index      # Vector index
```

### Components

#### ChatBubble
- Renders user and assistant messages
- Markdown rendering with syntax highlighting
- Source context display
- Accessibility support

#### ChatInterface
- Main chat interface
- Message input handling
- Message history management
- Loading states

#### InitializationModal
- Displays initialization progress
- Real-time status updates
- Progress tracking

#### VisuallyHidden
- Accessibility helper component
- Screen reader support
- ARIA announcements

### Environment Variables
No environment variables needed as the application runs locally.

## Performance

- First run: Processes PDFs and creates vector store (~30-60 minutes)
- Subsequent runs: Loads existing vector store (seconds)
- Memory usage: Efficient through batched processing
- CPU usage: Parallel processing based on available cores

## Accessibility

- Screen reader support
- Keyboard navigation
- ARIA labels
- Progress announcements
- Color contrast compliance
- Focus management
- Hidden helper elements

## Error Handling

- PDF processing errors
- LLM connection issues
- Vector store failures
- Network problems
- Initialization errors
- Markdown parsing errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

See [LICENSE.md](license.md) for details.
