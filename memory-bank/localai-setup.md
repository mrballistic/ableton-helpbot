# LocalAI Setup for Ableton Documentation Assistant

## Overview

This document details the successful configuration of LocalAI with GPT-4o for the Ableton Documentation Assistant project. The setup provides a local, private LLM solution that powers both the chat completions and embeddings generation for the RAG architecture.

## Directory Structure

```
~/.localai/
├── models/
│   └── gpt-4o.gguf      # The main model file (~4.3GB)
└── configs/
    └── gpt-4o.yaml      # Configuration for the model
```

## Model Configuration

### Model File

The model file is located at:
```
/Users/todd.greco/.localai/models/gpt-4o.gguf
```

This is a GGUF format model file compatible with LocalAI's llama-cpp backend.

### Configuration File

The configuration file at `~/.localai/configs/gpt-4o.yaml` contains:

```yaml
name: gpt-4o
backend: llama-cpp
parameters:
  model: gpt-4o.gguf
  temperature: 0.2
  top_p: 0.9
  context_size: 4096
  threads: 8
```

## Launch Command

To start LocalAI with the correct configuration:

```bash
local-ai serve --models-path ~/.localai/models --config-path ~/.localai/configs --address 0.0.0.0:1234 --disable-grpc
```

Key parameters:
- `--models-path`: Points to the directory containing the model files
- `--config-path`: Points to the directory containing the configuration files
- `--address`: Sets the host and port for the API server

## GPU Acceleration

LocalAI can use GPU acceleration to improve performance. For Mac systems with Apple Silicon chips, Metal API support can be enabled. The `update_localai_gpu.sh` script configures this:

```bash
#!/bin/bash
export METAL=1
export DISABLE_GRPC=1

local-ai serve \
  --models-path ~/.localai/models \
  --config-path ~/.localai/configs \
  --address 0.0.0.0:1234 \
  --threads=8
```

Key settings:
- `METAL=1`: Enables Metal API acceleration for Apple Silicon
- `DISABLE_GRPC=1`: Disables gRPC which can cause conflicts with GPU acceleration
- `--threads=8`: Optimizes thread count for performance

To run this script:
```bash
bash update_localai_gpu.sh
```

## Integration with Application

### Model Integration

In `server.js`, LocalAI is configured as follows:

```javascript
const model = new ChatLocalAI({
  baseUrl: "http://localhost:1234/v1", // Default LocalAI endpoint
  modelName: "gpt-4o",
  temperature: 0.2, // Lower temperature for more factual responses
  maxTokens: 2000, // Sufficient for detailed responses
});
```

### Embeddings Integration

For embeddings generation using LocalAI:

```javascript
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: "sk-no-key-required-for-local", // Placeholder for local deployment
  modelName: "text-embedding-3-small", // Compatible with LocalAI
  basePath: "http://localhost:1234/v1",
});
```

## Common Issues and Solutions

### Model Path Issues

**Problem**: LocalAI may look for a model file without the .gguf extension.

**Solution**: Create a symbolic link or ensure your configuration explicitly points to the .gguf file.

```bash
# Create a symbolic link if needed
ln -sf ~/.localai/models/gpt-4o.gguf ~/.localai/models/gpt-4o
```

### Missing Dependencies

**Problem**: Errors about missing libraries like libgrpc or libonnxruntime.

**Solution**: Install required dependencies:

```bash
brew install grpc onnxruntime
```

### gRPC Connection Issues

**Problem**: gRPC can conflict with GPU acceleration, particularly on Mac systems.

**Solution**: Disable gRPC with the `DISABLE_GRPC=1` environment variable or `--disable-grpc` flag.

## Performance Considerations

- The GPT-4o model requires approximately 4GB of RAM
- Metal acceleration is configured for optimal performance on Apple Silicon (M1/M2/M3)
- GPU acceleration parameters:
  - `f16: true` - Enables half-precision for faster computation
  - `metal: true` - Enables Metal API acceleration for Apple Silicon
  - `gpu: true` - Activates GPU acceleration
  - `n_gpu_layers: -1` - Offloads all layers to the GPU
- Setting appropriate thread count based on your CPU helps optimize performance
- Additional context window size may require more RAM

## Startup Sequence

1. Start ChromaDB server
2. Start LocalAI server
3. Start the Ableton Documentation Assistant application

## Verification

To verify LocalAI is working properly:

1. Check the LocalAI server logs for any errors
2. Test the API endpoint directly:

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello, are you working?"}]
  }'
```

3. Monitor the application logs when processing requests

## Migration from Ollama

The current setup successfully replaces the previous Ollama configuration with LocalAI, providing better response quality and more control over the model parameters. The integration with LangChain has been updated to use the ChatLocalAI class instead of ChatOllama.

## Future Enhancements

- Implement a fallback mechanism if GPT-4o Local is unavailable
- Configure system for automatic startup of dependent services
- Add support for switching between different models
- Optimize context window and batch settings for better performance