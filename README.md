# Ableton RAG Assistant

An AI-powered desktop application that helps you find information in Ableton Live's documentation using RAG (Retrieval-Augmented Generation) technology.

## Features

- Local AI processing using Ollama (Mistral model)
- Vector-based document search
- Dark/light mode support based on system preferences
- Native macOS application interface
- Markdown-formatted responses with syntax highlighting

## Prerequisites

- macOS 10.12 or later
- 8GB RAM minimum (16GB recommended)
- 5GB free disk space for the Mistral model

## Installation

1. Download the latest `Ableton RAG.dmg` from the releases page
2. Mount the DMG file
3. Drag `Ableton RAG.app` to your Applications folder
4. Right-click the app and select "Open" (required only for first launch)

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ableton-rag.git
cd ableton-rag

# Install dependencies
npm install
```

### Available Scripts

- `npm run dev` - Start the Vite development server
- `npm run electron:dev` - Start the app in development mode
- `npm run electron:build` - Build the app for production
- `npm test` - Run all tests
- `npm run test:frontend` - Run frontend tests only
- `npm run test:backend` - Run backend tests only

### Project Structure

```
ableton-rag/
├── electron/           # Electron main process code
│   ├── main.cjs       # Main process entry
│   ├── preload.cjs    # Preload script
│   └── ollama.cjs     # Ollama process manager
├── src/
│   ├── components/    # React components
│   ├── helpers/       # Utility functions
│   └── ollama/        # Ollama binary and resources
├── vector_store/      # Document embeddings
└── build/            # Build configuration
```

### Building from Source

1. Ensure you have Node.js 18+ installed
2. Clone and install dependencies as shown above
3. Run `npm run electron:build`
4. Find the built app in `release/mac-arm64/Ableton RAG.app`

## Technical Details

- Built with Electron and React
- Uses Vite for frontend bundling
- Integrates Ollama for local LLM inference
- Uses LangChain for RAG implementation
- Material-UI for the user interface
- Vector store powered by HNSWLib

## License

See [LICENSE.md](LICENSE.md) for details.
