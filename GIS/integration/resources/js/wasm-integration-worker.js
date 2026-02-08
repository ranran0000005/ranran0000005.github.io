/**
 * Web Worker for WASM-accelerated Integration Calculation
 * This worker loads the WASM module and calculates integration for assigned nodes
 */

// Import the WASM module
// Worker is loaded from resources/js/, so wasm is at ../wasm/
importScripts('../wasm/spatial_analysis.js');

let wasmModule = null;
let wasmReady = false;

// Initialize WASM module
async function initWasm() {
    if (wasmReady) return;
    
    try {
        console.log('[Worker] 开始初始化 WASM...');
        
        // Configure the module to use the correct path for .wasm file
        wasmModule = await SpatialAnalysisModule({
            locateFile: function(path) {
                if (path.endsWith('.wasm')) {
                    // Worker is at resources/js/, wasm is at resources/wasm/
                    const wasmPath = '../wasm/' + path;
                    console.log('[Worker] 定位 WASM 文件:', wasmPath);
                    return wasmPath;
                }
                return path;
            }
        });
        
        console.log('[Worker] WASM 初始化成功');
        wasmReady = true;
        self.postMessage({ type: 'ready' });
    } catch (error) {
        console.error('[Worker] WASM 初始化失败:', error);
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
