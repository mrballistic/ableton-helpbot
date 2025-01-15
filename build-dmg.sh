#!/bin/bash

# Exit on error
set -e

echo "cleaning the build"
rm -rf node_modules .vite/build && npm install

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

dmg_files=("$TEMP_DIR/out/make/"*.dmg)

if [ -e "${dmg_files[0]}" ]; then
    echo -e "\033[0;32mBuild successful! Copying DMG back to project directory...\033[0m"
    mkdir -p "out"
    cp -R "$TEMP_DIR/out/make/"*.dmg "./out/"
    echo -e "\033[0;32mBuild complete! Check the out directory for your DMG file.\033[0m"
else
    echo -e "\033[0;31mBuild failed! Check build.log for details\033[0m"
    cp "$TEMP_DIR/build.log" "./build.log"
    exit 1
fi
