# Project Brief: Ableton Documentation Assistant

## Project Overview
The Ableton Documentation Assistant is a chatbot application that allows users to ask questions about Ableton Live software and receive accurate answers sourced directly from Ableton's documentation. The application processes PDF documentation locally and uses a Retrieval-Augmented Generation (RAG) architecture to provide relevant, context-aware answers.

## Core Requirements

### Functional Requirements
- Process and index Ableton Live PDF documentation
- Provide a conversational interface for querying documentation
- Return accurate answers with source context from the documentation
- Run entirely locally without relying on external cloud services
- Support dark/light mode and accessibility features
- Allow users to see the source context for answers

### Technical Requirements
- Use local LLM processing via LocalAI with GPT-4o model
- Implement RAG architecture for accurate responses
- Process PDFs effectively and efficiently
- Create and maintain a vector store for embeddings using ChromaDB
- Provide a responsive React-based UI
- Show real-time initialization progress
- Support markdown rendering with code highlighting

## Project Goals
1. Create a helpful assistant for Ableton Live users to quickly find information
2. Ensure complete privacy by processing all data locally
3. Provide a fast, memory-efficient system
4. Support accessibility standards
5. Create a codebase that's maintainable and extensible

## Project Boundaries
- Limited to the documentation provided in the `/pdf` directory
- Focused on Ableton Live documentation only
- Will not generate creative content outside documentation scope
- Will not modify or create Ableton Live projects

## Success Criteria
- Accurately answers questions from Ableton documentation
- Provides source references with responses
- Processes documentation efficiently
- Delivers a responsive, accessible user interface
- Runs completely locally with minimal resource usage