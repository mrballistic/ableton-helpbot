#!/bin/bash

# Script to update LocalAI configuration for M3 MacBook Pro GPU acceleration
# Created on: April 29, 2025

echo "Updating LocalAI configuration for M3 MacBook Pro GPU acceleration..."

# Backup current config
if [ -f ~/.localai/configs/gpt-4o.yaml ]; then
  cp ~/.localai/configs/gpt-4o.yaml ~/.localai/configs/gpt-4o.yaml.bak
  echo "✅ Backed up existing configuration"
else
  echo "⚠️ No existing configuration found at ~/.localai/configs/gpt-4o.yaml"
  mkdir -p ~/.localai/configs
fi

# Create new config with GPU acceleration
cat > ~/.localai/configs/gpt-4o.yaml << EOL
name: gpt-4o
backend: llama-cpp
parameters:
  model: gpt-4o.gguf
  temperature: 0.2
  top_p: 0.9
  context_size: 4096
  threads: 8
  f16: true  # Enable half-precision for faster computation
  mmap: true  # Memory-mapped IO for efficiency
  gpu: true   # Enable GPU acceleration
  metal: true # Enable Metal API for Apple Silicon
  n_gpu_layers: -1 # Use all layers on GPU (-1 means all)
EOL

echo "✅ Created new GPU-optimized configuration"
echo ""
echo "To apply these changes, restart your LocalAI server with:"
echo "local-ai serve --models-path ~/.localai/models --config-path ~/.localai/configs --address 0.0.0.0:1234 --disable-grpc"
echo ""
echo "You should see Metal GPU acceleration messages in the startup logs"