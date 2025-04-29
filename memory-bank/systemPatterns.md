# System Patterns: Ableton Documentation Assistant

## System Architecture

The application follows a client-server architecture with the following components:

```mermaid
flowchart TD
    subgraph Frontend [React Frontend]
        UI[User Interface Components]
        State[Application State]
        Theme[Theme Management]
        Access[Accessibility Layer]
    end
    
    subgraph Backend [Express Server]
        API[API Endpoints]
        VStore[Vector Store Management]
        LLM[LLM Integration]
        Health[Health Monitoring]
    end
    
    subgraph Workers [Processing Workers]
        PDFProc[PDF Processing]
        Chunking[Text Chunking]
        Embed[Embedding Generation]
    end
    
    subgraph Storage [Vector Storage]
        HNSW[HNSWLib Index]
        Meta[Document Metadata]
    end
    
    PDFs[PDF Documents] --> PDFProc
    UI <--> API
    API <--> VStore
    API <--> LLM
    VStore <--> Storage
    PDFProc --> Chunking --> Embed --> Storage
    Health <--> State
```

## Key Technical Decisions

### RAG Implementation
- **Retrieval**: Uses HNSWLib for efficient similarity search
- **Augmentation**: Retrieves top relevant context from documentation
- **Generation**: Uses Ollama's Mistral model for answer generation
- **Response Format**: Returns formatted markdown with source context

### PDF Processing Strategy
- **Parallel Processing**: Uses worker threads to process PDFs
- **Batched Processing**: Handles large documents in manageable chunks
- **Page Distribution**: Divides PDF pages across multiple workers
- **Progress Tracking**: Monitors initialization process in real-time

### Vector Store Management
- **Persistence**: Saves vector store to disk for fast startup
- **Memory Efficiency**: Processes in batches to limit memory usage
- **Embedding Model**: Uses Ollama for consistent embeddings
- **Metadata Preservation**: Maintains source information for context

### Frontend Design Patterns
- **Component-Based**: Modular React components with clear responsibilities
- **Progressive Enhancement**: Core functionality works with minimal dependencies
- **Adaptive Design**: Automatic light/dark mode based on system preferences
- **Accessibility First**: Built-in screen reader support and keyboard navigation

## Component Relationships

### Frontend Component Hierarchy
```mermaid
flowchart TD
    App --> ThemeProvider
    ThemeProvider --> Container
    Container --> Header
    Container --> ChatInterface
    Container --> InitializationModal
    Container --> ErrorHandling
    ChatInterface --> ChatBubble
    ChatInterface --> MessageInput
```

### Backend Component Flow
```mermaid
flowchart LR
    HealthEndpoint --> VectorStoreStatus
    ChatEndpoint --> DocumentRetrieval
    DocumentRetrieval --> PromptGeneration
    PromptGeneration --> LLMQuery
    LLMQuery --> ResponseFormatting
```

### Initialization Flow
```mermaid
flowchart TD
    Start[Server Start] --> Check{Vector Store Exists?}
    Check -->|Yes| Load[Load Vector Store]
    Check -->|No| Process[Process PDF Documents]
    Process --> Workers[Create Worker Pool]
    Workers --> Chunks[Generate Text Chunks]
    Chunks --> Embed[Generate Embeddings]
    Embed --> Save[Save Vector Store]
    Load --> Ready[System Ready]
    Save --> Ready
```

## Event Flow

### User Query Flow
1. User enters question in UI
2. Frontend sends request to backend API
3. Backend retrieves relevant context from vector store
4. Context is combined with question in prompt template
5. Prompt is sent to Ollama LLM for processing
6. Response is formatted with markdown
7. Response and source context are returned to frontend
8. Frontend displays response with formatting and source references

### Error Handling Flow
1. Error occurs in system component
2. Error is logged with details
3. Generic error message is returned to user
4. UI displays error notification
5. System remains operational for future queries

## Design Patterns Used

- **Singleton Pattern**: Single instance of vector store and LLM
- **Factory Pattern**: Creating worker instances
- **Observer Pattern**: Progress monitoring and updates
- **Repository Pattern**: Access to vector store data
- **Facade Pattern**: Simplified API for complex backend operations
- **Strategy Pattern**: Different processing approaches based on context
- **Decorator Pattern**: Enhanced components with accessibility features