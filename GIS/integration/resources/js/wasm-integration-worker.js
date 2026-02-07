/**
 * Web Worker for WASM-accelerated Integration Calculation
 * This worker loads the WASM module and calculates integration for assigned nodes
 */

// Import the WASM module (use absolute path from worker context)
// The worker's base URL is relative to the HTML file, not the worker file itself
importScripts('resources/wasm/spatial_analysis.js');

let wasmModule = null;
let wasmReady = false;

// Initialize WASM module
async function initWasm() {
    if (wasmReady) return;
    
    try {
        // Configure the module to use the correct path for .wasm file
        wasmModule = await SpatialAnalysisModule({
            locateFile: function(path) {
                if (path.endsWith('.wasm')) {
                    return 'resources/wasm/' + path;
                }
                return path;
            }
        });
        wasmReady = true;
        self.postMessage({ type: 'ready' });
    } catch (error) {
        self.postMessage({ 
            type: 'error', 
            error: 'WASM initialization failed: ' + error.message 
        });
    }
}

// Calculate integration for a single root using WASM
function calculateIntegrationForRoot(rootIndex, nodeCount, adjacencyList, tulipBins) {
    if (!wasmReady || !wasmModule) {
        throw new Error('WASM module not ready');
    }
    
    try {
        const integration = wasmModule.calculateIntegrationForRoot(
            rootIndex,
            nodeCount,
            adjacencyList,
            true, // applyFormula
            nodeCount, // globalNodeCount
            tulipBins
        );
        
        return integration;
    } catch (error) {
        throw new Error('WASM calculation failed: ' + error.message);
    }
}

// Handle messages from main thread
self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    if (type === 'init') {
        await initWasm();
        return;
    }
    
    if (type === 'calculate') {
        try {
            const { rootIndex, nodeCount, adjacencyList, tulipBins } = data;
            
            if (!wasmReady) {
                self.postMessage({
                    type: 'error',
                    rootIndex: rootIndex,
                    error: 'WASM not initialized'
                });
                return;
            }
            
            const integration = calculateIntegrationForRoot(
                rootIndex,
                nodeCount,
                adjacencyList,
                tulipBins
            );
            
            self.postMessage({
                type: 'result',
                rootIndex: rootIndex,
                integration: integration
            });
            
        } catch (error) {
            self.postMessage({
                type: 'error',
                rootIndex: data.rootIndex,
                error: error.message
            });
        }
    }
};
