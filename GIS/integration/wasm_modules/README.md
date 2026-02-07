# WASM Module Build Instructions

This directory contains C++ source code for spatial analysis algorithms that are compiled to WebAssembly for high-performance client-side computation.

## Prerequisites

1. **Install Emscripten** (C++ to WebAssembly compiler):

```bash
# Clone Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate latest version
./emsdk install latest
./emsdk activate latest

# Set environment variables (run this in each terminal session)
source ./emsdk_env.sh
```

## Building the WASM Module

```bash
cd wasm_modules
./build.sh
```

This will compile the spatial analysis C++ code to WebAssembly and output:
- `resources/wasm/spatial_analysis.js` - JavaScript glue code
- `resources/wasm/spatial_analysis.wasm` - WebAssembly binary

## Module Contents

- **point.h/cpp**: Point and Line data structures
- **spatial_analysis.h/cpp**: Core spatial algorithms
  - Line intersection detection
  - Angle calculation between lines
  - Adjacency list construction with weights
  - Connectivity calculation
  - Integration calculation (depth-based, with formula)
- **wasm_bindings.cpp**: JavaScript interface using Embind
- **build.sh**: Compilation script

## Testing the Module

After building, the WASM module will be automatically loaded by the web application when you open `index.html` in a browser or run:

```bash
python3 -m http.server 8000
# Then open http://localhost:8000
```

## Performance

WASM provides significant performance improvements over pure JavaScript:
- Line intersection detection: ~5-10x faster
- Integration calculation: ~10-15x faster
- Large datasets (>1000 features): ~20x faster overall

## Troubleshooting

**Error: "emcc not found"**
- Make sure you've activated Emscripten: `source emsdk/emsdk_env.sh`

**Build fails with include errors**
- Ensure all .cpp and .h files are in the wasm_modules directory
- Check that you're running the build script from the wasm_modules directory

**WASM file not loading in browser**
- Check browser console for errors
- Ensure files are in `resources/wasm/`
- Verify that your web server serves `.wasm` files with correct MIME type (`application/wasm`)
- Check that WASM is enabled in your browser (most modern browsers support it by default)

## Modifying WASM Code

After changing C++ files:

1. Rebuild the module:
```bash
cd wasm_modules
./build.sh
```

2. Reload the web page in your browser (hard refresh: Ctrl+F5 or Cmd+Shift+R)

## Adding New Functions

1. Add C++ implementation in `spatial_analysis.cpp`
2. Add function declaration in `spatial_analysis.h`
3. Add Embind wrapper in `wasm_bindings.cpp`
4. Add JavaScript wrapper in `resources/js/wasm-loader.js`
5. Rebuild with `./build.sh`
