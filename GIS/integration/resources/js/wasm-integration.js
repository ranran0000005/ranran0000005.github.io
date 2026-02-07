/**
 * WASM-accelerated Integration Calculation with Web Workers
 * Calculates integration values for all features using WASM in parallel
 */
async function calculateIntegrationWasm(features, adjacencyList, progressCallback, tulipBins = 8) {
    const results = new Map();
    const nodeCount = features.length;
    
    // Use global thread count configuration
    const workerCount = Math.min(Math.max(1, wasmThreadCount), 16);
    
    console.log('calculateIntegrationWasm 开始 (多线程):', {
        nodeCount: nodeCount,
        adjacencyListLength: adjacencyList.length,
        tulipBins: tulipBins,
        configuredThreads: wasmThreadCount,
        actualThreads: workerCount,
        cpuCores: navigator.hardwareConcurrency || 4
    });
    
    // Try to use Web Workers for parallel computation
    const workerUrl = 'resources/js/wasm-integration-worker.js';
    
    try {
        // Create workers
        const workers = [];
        const workerReady = [];
        
        console.log(`创建 ${workerCount} 个 Web Workers...`);
        
        // Initialize workers
        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(workerUrl);
            workers.push(worker);
            
            // Wait for worker to be ready
            const readyPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Worker initialization timeout'));
                }, 10000);
                
                worker.onmessage = (e) => {
                    if (e.data.type === 'ready') {
                        clearTimeout(timeout);
                        resolve();
                    } else if (e.data.type === 'error') {
                        clearTimeout(timeout);
                        reject(new Error(e.data.error));
                    }
                };
            });
            
            worker.postMessage({ type: 'init' });
            workerReady.push(readyPromise);
        }
        
        // Wait for all workers to be ready
        await Promise.all(workerReady);
        console.log('所有 Workers 已就绪');
        
        // Distribute work among workers
        const resultPromises = [];
        const resultsArray = new Array(nodeCount);
        let completed = 0;
        
        const taskQueue = [];
        for (let i = 0; i < nodeCount; i++) {
            taskQueue.push(i);
        }
        
        // Function to process next task
        const processNext = (worker, workerIndex) => {
            if (taskQueue.length === 0) return null;
            
            const rootIndex = taskQueue.shift();
            
            return new Promise((resolve, reject) => {
                const messageHandler = (e) => {
                    if (e.data.type === 'result' && e.data.rootIndex === rootIndex) {
                        worker.removeEventListener('message', messageHandler);
                        resultsArray[rootIndex] = e.data.integration;
                        completed++;
                        
                        // Update progress
                        if (progressCallback && completed % Math.max(1, Math.floor(nodeCount / 20)) === 0) {
                            const percent = 40 + (completed / nodeCount) * 55;
                            progressCallback(`使用 WASM 多线程计算... (${completed}/${nodeCount})`, Math.min(95, percent));
                        }
                        
                        resolve();
                    } else if (e.data.type === 'error' && e.data.rootIndex === rootIndex) {
                        worker.removeEventListener('message', messageHandler);
                        reject(new Error(e.data.error));
                    }
                };
                
                worker.addEventListener('message', messageHandler);
                
                worker.postMessage({
                    type: 'calculate',
                    data: {
                        rootIndex: rootIndex,
                        nodeCount: nodeCount,
                        adjacencyList: adjacencyList,
                        tulipBins: tulipBins
                    }
                });
            });
        };
        
        // Start workers
        const workerPromises = workers.map(async (worker, workerIndex) => {
            while (taskQueue.length > 0) {
                await processNext(worker, workerIndex);
            }
        });
        
        // Wait for all tasks to complete
        await Promise.all(workerPromises);
        
        // Convert array to Map
        for (let i = 0; i < nodeCount; i++) {
            results.set(i, resultsArray[i] || 0);
        }
        
        // Terminate workers
        workers.forEach(w => w.terminate());
        
        console.log('多线程计算完成');
        
    } catch (error) {
        console.warn('多线程计算失败，回退到单线程:', error);
        
        // Fallback to single-threaded WASM calculation
        for (let i = 0; i < nodeCount; i++) {
            if (progressCallback && i % Math.max(1, Math.floor(nodeCount / 20)) === 0) {
                const percent = 40 + (i / nodeCount) * 55;
                progressCallback(`使用 WASM 单线程计算... (${i + 1}/${nodeCount})`, Math.min(95, percent));
            }
            
            const integration = calculateIntegrationForRootWasm(
                i,
                nodeCount,
                adjacencyList,
                true,
                nodeCount,
                tulipBins
            );
            
            results.set(i, integration);
            
            // Allow UI updates periodically
            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }
    
    if (progressCallback) {
        progressCallback('整合度计算完成', 95);
    }
    
    console.log('calculateIntegrationWasm 完成, 结果数量:', results.size);
    console.log('结果样例:', Array.from(results.values()).slice(0, 10));
    
    return results;
}
