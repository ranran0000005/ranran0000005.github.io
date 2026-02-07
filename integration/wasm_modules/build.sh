#!/bin/bash
# Build script for compiling spatial analysis C++ code to WebAssembly

echo "Building spatial analysis WASM module..."

# Check if Emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found. Please install Emscripten:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p ../resources/wasm

# Compile with Emscripten
emcc point.cpp spatial_analysis.cpp wasm_bindings.cpp \
  -o ../resources/wasm/spatial_analysis.js \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="SpatialAnalysisModule" \
  -s ENVIRONMENT='web' \
  --bind \
  -O3 \
  -std=c++17

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✓ Build successful!"
    echo "  Output: ../resources/wasm/spatial_analysis.js"
    echo "  Output: ../resources/wasm/spatial_analysis.wasm"
    
    # Show file sizes
    echo ""
    echo "File sizes:"
    ls -lh ../resources/wasm/spatial_analysis.* 2>/dev/null || echo "Files created successfully"
else
    echo "✗ Build failed!"
    exit 1
fi
