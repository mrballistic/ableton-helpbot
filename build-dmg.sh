#!/bin/bash

# Exit on error
set -e

# Create temp directory in a non-cloud location
TEMP_DIR="/tmp/ableton-rag-build"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Clean up any previous build artifacts
rm -rf .vite out dist release build/electron

# Copy project files to temporary location
echo "Copying project files to temporary location..."
cp -R . "$TEMP_DIR/"

# Navigate to temp directory and run forge make with detailed error output
echo "Building the project..."
cd "$TEMP_DIR" && ELECTRON_ENABLE_LOGGING=1 npm run make 2>&1 | tee build.log

# Check if the build succeeded
if [ -f "$TEMP_DIR/out/"*.dmg ]; then
    echo "Build successful! Copying DMG back to project directory..."
    mkdir -p "out"
    cp -R "$TEMP_DIR/out/"*.dmg "./out/"
    echo "Build complete! Check the out directory for your DMG file."
else
    echo "Build failed! Check build.log for details"
    cp "$TEMP_DIR/build.log" "./build.log"
    exit 1
fi
