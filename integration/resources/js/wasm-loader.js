/**
 * WASM Spatial Analysis Loader
 * Loads and initializes the WebAssembly module for high-performance spatial calculations
 */

let wasmModule = null;
let wasmInitialized = false;

/**
 * Initialize the WASM module
 * @returns {Promise<void>}
 */
async function initWasmModule() {
    if (wasmInitialized) {
        return;
    }

    try {
        console.log('Loading WASM spatial analysis module...');
        
        // Load the WASM module
        wasmModule = await SpatialAnalysisModule();
        
        wasmInitialized = true;
        console.log('✓ WASM module loaded successfully');
    } catch (error) {
        console.error('Failed to load WASM module:', error);
        throw error;
    }
}

/**
 * Check if WASM module is initialized
 * @returns {boolean}
 */
function isWasmInitialized() {
    return wasmInitialized;
}

/**
 * Build adjacency list using WASM
 * @param {Array} features - GeoJSON features
 * @param {string} mode - 'topo' or 'angle'
 * @param {number} tulipBins - Angle resolution (default 8)
 * @returns {Array} Adjacency list
 */
function buildAdjacencyListWasm(features, mode = 'angle', tulipBins = 8) {
    if (!wasmInitialized) {
        throw new Error('WASM module not initialized. Call initWasmModule() first.');
    }

    // Extract all lines from features
    const lines = [];
    features.forEach((feature, featureIndex) => {
        const geometry = feature.geometry;
        
        if (geometry.type === 'LineString') {
            const coords = geometry.coordinates;
            for (let i = 0; i < coords.length - 1; i++) {
                lines.push({
                    p1: { x: coords[i][0], y: coords[i][1] },
                    p2: { x: coords[i + 1][0], y: coords[i + 1][1] },
                    featureIndex: featureIndex
                });
            }
        } else if (geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach(lineString => {
                for (let i = 0; i < lineString.length - 1; i++) {
                    lines.push({
                        p1: { x: lineString[i][0], y: lineString[i][1] },
                        p2: { x: lineString[i + 1][0], y: lineString[i + 1][1] },
                        featureIndex: featureIndex
                    });
                }
            });
        }
    });

    // Call WASM function
    const adjacencyList = wasmModule.buildAdjacencyList(lines, mode, tulipBins);
    return adjacencyList;
}

/**
 * Calculate connectivity using WASM
 * @param {Array} adjacencyList - Pre-computed adjacency list
 * @param {number} featureCount - Total number of features
 * @returns {Array<number>} Connectivity values
 */
function calculateConnectivityWasm(adjacencyList, featureCount) {
    if (!wasmInitialized) {
        throw new Error('WASM module not initialized');
    }

    return wasmModule.calculateConnectivity(adjacencyList, featureCount);
}

/**
 * Calculate depth from a root node using WASM
 * @param {number} rootIndex - Root node index
 * @param {Array} adjacencyList - Adjacency list
 * @param {number} nodeCount - Total number of nodes
 * @returns {number} Total depth
 */
function calculateDepthFromRootWasm(rootIndex, adjacencyList, nodeCount) {
    if (!wasmInitialized) {
        throw new Error('WASM module not initialized');
    }

    return wasmModule.calculateDepthFromRoot(rootIndex, adjacencyList, nodeCount);
}

/**
 * Calculate integration for a single root using WASM
 * @param {number} rootIndex - Root node index
 * @param {number} nodeCount - Total number of nodes
 * @param {Array} adjacencyList - Adjacency list
 * @param {boolean} applyFormula - Whether to apply integration formula
 * @param {number} globalNodeCount - Global node count (0 = use nodeCount)
 * @param {number} tulipBins - Angle resolution (default 8)
 * @returns {number} Integration value
 */
function calculateIntegrationForRootWasm(rootIndex, nodeCount, adjacencyList, applyFormula = true, globalNodeCount = 0, tulipBins = 8) {
    if (!wasmInitialized) {
        throw new Error('WASM module not initialized');
    }

    return wasmModule.calculateIntegrationForRoot(rootIndex, nodeCount, adjacencyList, applyFormula, globalNodeCount, tulipBins);
}

/**
 * Check if two lines intersect using WASM
 * @param {Object} line1 - Line object with p1, p2
 * @param {Object} line2 - Line object with p1, p2
 * @returns {Object|null} {intersects: boolean, point: {x, y}} or null
 */
function checkLineIntersectionWasm(line1, line2) {
    if (!wasmInitialized) {
        throw new Error('WASM module not initialized');
    }

    return wasmModule.checkLineIntersection(line1, line2);
}

/**
 * Calculate angle between two lines using WASM
 * @param {Object} line1 - Line object with p1, p2
 * @param {Object} line2 - Line object with p1, p2
 * @returns {number} Angle in degrees (0-180)
 */
function angleBetweenLinesWasm(line1, line2) {
    if (!wasmInitialized) {
        throw new Error('WASM module not initialized');
    }

    return wasmModule.angleBetweenLines(line1, line2);
}
