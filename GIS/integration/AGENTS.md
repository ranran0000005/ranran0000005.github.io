# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

This is a WebGIS application that provides interactive mapping functionality with WebAssembly-accelerated spatial analysis capabilities. It's a single-page application (SPA) that supports **fully client-side shapefile processing and spatial analysis**, designed to run on lightweight servers with all computation offloaded to client browsers.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES5/ES6), HTML5, CSS3
- **Mapping**: OpenLayers 7.4.0 (via CDN)
- **Coordinate Systems**: Proj4js for transformations, primarily BD-09 (Baidu) and EPSG:4326 (WGS84)
- **High-Performance Computing**: C++ compiled to WebAssembly via Emscripten (client-side computation)
- **Client-side Data Processing**: 
  - shapefile.js 0.6.6 for shapefile parsing
  - JSZip 3.10.1 for ZIP file extraction
- **Backend**: PHP 7.x/8.x (lightweight, only for proxies and marker storage - NO DATA PROCESSING)
- **Database**: MySQL (database: `gis_markers`, user: `map_user`) - only for user markers
- **GIS Server**: GeoServer (hosted at `gis.kjjfpt.top`) - optional, can work without it
- **Base Map**: Baidu Maps tiles

## Architecture

### Core Components

The application follows a modular JavaScript architecture with files loaded in dependency order in `index.html:57-81`:

1. **Configuration Layer** (`config.js`): Global variables, map/layer/marker state management
2. **Core Map** (`map-core.js`): OpenLayers initialization, BD-09 projection setup, base layer creation
3. **Utility Layer**:
   - `utils.js`: General utilities and popup management
   - `coordinate-utils.js`: Coordinate transformations between BD-09, WGS84, and Web Mercator
4. **Feature Layers**:
   - `wms-layers.js`: WMS layer management for GeoServer integration (optional)
   - `geoserver.js`: GeoServer capabilities parsing and layer discovery (optional)
   - `markers.js`: User-generated point markers with CRUD operations
5. **User Interaction**:
   - `search.js`: Baidu Geocoding API integration for place search
   - `settings.js`: UI for layer visibility and map configuration
6. **Local Data Processing** (NEW - fully client-side):
   - `shapefile-loader.js`: Client-side shapefile parsing using shapefile.js and JSZip
   - `local-analysis.js`: Spatial analysis on locally loaded data without server dependency
7. **Spatial Analysis** (WASM-accelerated):
   - `wasm-loader.js`: WASM module initialization and JavaScript bindings
   - `wasm-integration.js`: WASM-based integration calculation wrapper
   - `integration.js`: Graph-based integration algorithms (JavaScript fallback)
   - `connection.js`: Connectivity analysis for vector features (JavaScript fallback)
   - `spacial_analyse.js`: Main spatial syntax analysis orchestration with automatic WASM/JS fallback
8. **Entry Point** (`main.js`): DOMContentLoaded initialization, WASM initialization

### WASM Acceleration Module

Located in `/wasm_modules/` with output to `/resources/wasm/`:

- **point.h/cpp**: Point and Line data structures
- **spatial_analysis.h/cpp**: Core algorithms (line intersection, adjacency list, connectivity, integration)
- **wasm_bindings.cpp**: Emscripten bindings for JavaScript interop
- **wasm-integration-worker.js**: Web Worker for multi-threaded WASM integration calculation
- **build.sh**: Compilation script using Emscripten
- **README.md**: Build instructions and troubleshooting

**Performance improvements with WASM:**
- Line intersection detection: ~5-10x faster
- Integration calculation: ~10-15x faster (single-threaded)
- Multi-threaded integration: ~3-8x faster depending on CPU cores
- Large datasets (>1000 features): ~20x faster overall

**Multi-threading:** Integration calculation uses Web Workers for parallel computation:
- Default thread count: CPU core count (auto-detected via `navigator.hardwareConcurrency`)
- Configurable: 1-16 threads via UI in spatial analysis dialog
- Stored in localStorage for persistence across sessions
- Each worker loads its own WASM instance for true parallel execution
- Automatic fallback to single-threaded WASM if workers fail

**Fallback behavior:** If WASM fails to load or compile, the application automatically falls back to pure JavaScript implementations in `integration.js` and `connection.js`.

### Backend APIs

Located in `/api/` (lightweight, no heavy computation):

1. **markers.php**: RESTful API for marker CRUD operations
   - GET `?action=list`: Returns all markers
   - GET `?action=get&id=N`: Returns single marker
   - POST: Create new marker (requires `name`, `longitude`, `latitude`)
   - PUT: Update marker (requires `id` + fields to update)
   - DELETE `?id=N`: Delete marker

2. **geoserver_proxy.php**: Proxies WMS GetCapabilities requests to avoid CORS
   - GET `?workspace=X`: Returns GeoServer capabilities XML
   - Tries multiple URL patterns to accommodate different GeoServer configurations

3. **baidu_proxy.php**: Proxies Baidu API requests (for geocoding/search)

**Note:** The PHP backend does NOT perform spatial analysis computation. All spatial analysis is performed client-side using WASM for maximum performance and minimal server load.

### Local Shapefile Processing (Client-Side)

**Key feature**: Fully client-side shapefile loading and analysis without any server processing.

**Workflow**:
1. User uploads shapefile (ZIP or individual .shp/.dbf files) via browser file input
2. `shapefile-loader.js` parses shapefile using shapefile.js library (in browser)
3. Parsed GeoJSON features are cached in `spatialFeaturesCache`
4. `local-analysis.js` performs spatial analysis using WASM or JavaScript
5. Results visualized on map with color-coded lines

**Supported formats**:
- ZIP file containing .shp, .dbf, and other shapefile components
- Individual .shp file (required) + .dbf file (optional)

**Data privacy**: All shapefile data stays in browser memory, never sent to server.

**UI entry points**:
- Top toolbar: "上传 SHP" button → `showShapefileUploadDialog()`
- Bottom actions: "上传 Shapefile" button → `showShapefileUploadDialog()`
- After upload: Spatial analysis dialog automatically appears

**Coordinate system**: Shapefiles should use WGS84 (EPSG:4326), automatically converted to BD-09 for display.

### Database Schema

Database: `gis_markers`
Table: `markers`
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name` (VARCHAR)
- `description` (TEXT, nullable)
- `longitude` (DECIMAL)
- `latitude` (DECIMAL)
- `created_at` (TIMESTAMP)

## Development Workflows

### Local Development

No JavaScript build step required for the application itself. To preview locally:

```bash
# From repository root
python3 -m http.server 8000
# Then open http://localhost:8000
```

Or with Node.js:

```bash
npx serve .
```

### Building WASM Module

When modifying C++ spatial analysis code:

```bash
# First-time setup: Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Build WASM module
cd wasm_modules
./build.sh
```

Output files:
- `resources/wasm/spatial_analysis.js` - JavaScript glue code
- `resources/wasm/spatial_analysis.wasm` - WebAssembly binary

See `wasm_modules/README.md` for detailed build instructions and troubleshooting.

### Deployment

Files are served directly from `/var/www/website/GIS`. Deployment involves copying modified files to the web server document root.

**Deployment checklist:**
1. If C++ code changed: Build WASM module and include `resources/wasm/*` files
2. Copy all modified files to server
3. Ensure web server serves `.wasm` files with MIME type `application/wasm`
4. Test WASM loading in browser console

Confirm deployment method with maintainer before automating.

### Testing

No automated test suite exists. Test manually by:
1. Starting local server
2. Opening in browser and checking console for "WASM 加速已启用" or fallback message
3. Testing map initialization, marker CRUD, search, GeoServer layers
4. Testing spatial analysis (connectivity and integration) with and without WASM
5. Verify performance improvement with WASM vs JavaScript fallback

### Web Server Configuration

Ensure your web server serves WASM files correctly:

**Nginx:**
```nginx
location ~* \.wasm$ {
    types { application/wasm wasm; }
    add_header Cache-Control "public, max-age=31536000";
}
```

**Apache (.htaccess):**
```apache
AddType application/wasm .wasm
<FilesMatch "\.wasm$">
    Header set Cache-Control "public, max-age=31536000"
</FilesMatch>
```

### Database Setup

If database doesn't exist:

```sql
CREATE DATABASE gis_markers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'map_user'@'localhost' IDENTIFIED BY 'mapdata87h7';
GRANT ALL PRIVILEGES ON gis_markers.* TO 'map_user'@'localhost';

USE gis_markers;
CREATE TABLE markers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    longitude DECIMAL(10, 7) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Key Conventions

### Coordinate System Handling

- **BD-09** (Baidu Mercator): Primary display projection for OpenLayers map
- **EPSG:4326** (WGS84): Used for GeoServer WFS/WMS and database storage
- **Web Mercator (EPSG:3857)**: Sometimes used as intermediate projection

Coordinate transformations are centralized in `coordinate-utils.js`. Always use these utilities instead of direct Proj4 calls.

### GeoServer Integration

- Default workspace: `WebGIS`
- Layers are fetched via WFS (GeoJSON) for analysis and WMS for display
- Use `geoserver_proxy.php` to avoid CORS issues
- Fallback layers are defined in `config.js:24-27`

### Popup Management

All popups use centralized management via `utils.js`:
- `currentPopup`: Tracks active popup
- `popupTimer`: Auto-close timer
- Use `closeCurrentPopup()` before creating new popups to prevent duplicates

### Spatial Analysis

- **Connectivity**: Calculates how many other features directly connect to each feature
- **Integration**: Computes graph-theoretic integration (global or local) with topological or angular weighting
- **Computation strategy**: 
  - Primary: WASM-accelerated C++ algorithms for maximum performance
  - Fallback: Pure JavaScript implementation if WASM unavailable
  - Automatic detection and graceful degradation
- Results are visualized with color gradients on the map
- Progress updates are shown during computation

**WASM Integration Points:**
- `buildAdjacencyListWasm()`: Builds weighted adjacency graph in C++
- `calculateConnectivityWasm()`: Computes connectivity values in C++
- `calculateIntegrationForRootWasm()`: Computes integration for single node in C++
- `calculateIntegrationWasm()`: Orchestrates integration calculation with progress updates

**Fallback mechanism:** The variable `useWasmAcceleration` in `spacial_analyse.js` controls whether to use WASM. It's automatically set to `false` if WASM initialization fails.

### WASM Development

When modifying spatial analysis algorithms:

1. **Edit C++ source** in `wasm_modules/`:
   - `spatial_analysis.cpp`: Add/modify algorithms
   - `spatial_analysis.h`: Update function declarations
   - `wasm_bindings.cpp`: Add JavaScript bindings
   
2. **Rebuild WASM**:
   ```bash
   cd wasm_modules
   ./build.sh
   ```

3. **Update JavaScript wrappers**:
   - `wasm-loader.js`: Add wrapper functions
   - `wasm-integration.js`: Update integration logic
   - `spacial_analyse.js`: Call new WASM functions

4. **Test both paths**:
   - With WASM: Verify performance improvement
   - Without WASM: Ensure fallback works correctly

5. **Hard refresh browser** (Ctrl+F5 or Cmd+Shift+R) to reload WASM

## File Naming Patterns

- `*-core.js`: Core initialization modules
- `*-utils.js`: Utility function collections
- `wasm-*.js`: WASM-related JavaScript wrappers and loaders
- `*.php`: Backend API endpoints (in `/api/`)
- `*.css`: Modular stylesheets (one per feature area)
- `*.wasm`: WebAssembly binary modules (in `/resources/wasm/`)
- `*.h` / `*.cpp`: C++ source files (in `/wasm_modules/`)

## Important Notes from Existing Documentation

From `.github/copilot-instructions.md`:

1. **Preserve minimal footprint**: The application has no build tools for JavaScript. Only WASM requires compilation via Emscripten.
2. **HTML structure**: `index.html` uses standard HTML5 structure. Make targeted fixes and explain structural changes clearly.
3. **Deployment context**: This workspace is likely the production webroot; be cautious with file changes.
4. **External integrations**: No credentials or API keys should be added without confirmation.
5. **Asset organization**: Place new assets in `resources/` subdirectories (`css/`, `js/`, `wasm/`).

## External Service Dependencies

- **Baidu Maps API**: `online3.map.bdimg.com` for base map tiles
- **GeoServer**: `gis.kjjfpt.top/geoserver` for WMS/WFS layers
- **OpenLayers CDN**: `cdn.jsdelivr.net/npm/ol@7.4.0`
- **Proj4js CDN**: `cdn.jsdelivr.net/npm/proj4@2.9.0`

## Common Gotchas

1. **Projection mismatches**: Always verify coordinate system when adding/modifying features. BD-09 is used for display, but WGS84 for storage.
2. **Popup duplication**: The map click handler (`map-core.js:104-132`) has debouncing logic to prevent duplicate popups. Respect this pattern.
3. **GeoServer URL formats**: `geoserver_proxy.php` tries multiple URL patterns. If layers fail to load, check GeoServer configuration.
4. **Asynchronous initialization**: `main.js` preloads layers, markers, and WASM module asynchronously. Ensure UI interactions wait for these to complete.
5. **CORS**: All external requests must go through PHP proxies (`api/*_proxy.php`).
6. **WASM MIME type**: Ensure `.wasm` files are served with `application/wasm` MIME type. Check browser console if WASM fails to load.
7. **WASM caching**: Browsers aggressively cache WASM modules. Use hard refresh (Ctrl+F5) after rebuilding WASM.
8. **Emscripten environment**: Remember to `source emsdk/emsdk_env.sh` before building WASM in each new terminal session.

## Performance Considerations

- **WASM vs JavaScript**: WASM provides 5-20x performance improvement for spatial analysis
- **Large datasets**: For datasets >1000 features, WASM is critical for acceptable performance
- **Graceful degradation**: Application remains functional without WASM, just slower
- **Memory usage**: WASM uses less memory than equivalent JavaScript for large computations
- **Browser compatibility**: WASM works in all modern browsers (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)

## Lightweight Server Architecture

This application is designed to run on lightweight servers with minimal resources:

1. **Client-side computation**: All spatial analysis happens in the browser via WASM
2. **Client-side data processing**: Shapefile parsing happens in the browser (no server uploads)
3. **Server role**: Only serves static files and acts as proxy for CORS
4. **No server-side processing**: PHP backend only handles database CRUD and proxying
5. **Scalability**: Can handle many concurrent users since computation is distributed to clients
6. **Resource requirements**: Server only needs PHP, MySQL (optional), and static file serving capability
7. **Offline capable**: Can work without database and GeoServer if using local shapefiles only

## Data Sources

The application supports three data sources:

1. **Local Shapefiles** (NEW - recommended):
   - Uploaded directly from user's computer
   - Parsed entirely in browser using shapefile.js
   - No server upload or processing required
   - Complete data privacy (data never leaves browser)
   - See `LOCAL_SHAPEFILE_GUIDE.md` for usage instructions

2. **GeoServer WFS** (optional):
   - Fetch vector data from remote GeoServer
   - Requires `geoserver_proxy.php` to avoid CORS
   - Useful for shared/public datasets

3. **User Markers** (optional):
   - Point markers stored in MySQL database
   - Managed via `markers.php` REST API
   - Separate from spatial analysis workflow
