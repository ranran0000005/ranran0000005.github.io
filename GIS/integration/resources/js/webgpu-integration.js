/**
 * WebGPU-accelerated Integration Calculation
 * Uses GPU compute shaders for parallel shortest path computation
 */

let gpuDevice = null;
let gpuInitialized = false;
let gpuSupported = false;

/**
 * Initialize WebGPU device
 * @returns {Promise<boolean>} True if initialization successful
 */
async function initWebGPU() {
    if (gpuInitialized) {
        return gpuSupported;
    }
    
    try {
        // Check if WebGPU is available
        if (!navigator.gpu) {
            console.log('WebGPU 不支持 - 浏览器不支持');
            gpuInitialized = true;
            gpuSupported = false;
            return false;
        }
        
        // Request GPU adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.log('WebGPU 不支持 - 无法获取 GPU 适配器');
            gpuInitialized = true;
            gpuSupported = false;
            return false;
        }
        
        // Request GPU device
        gpuDevice = await adapter.requestDevice();
        
        // Handle device loss
        gpuDevice.lost.then((info) => {
            console.error('WebGPU 设备丢失:', info.message);
            gpuDevice = null;
            gpuSupported = false;
        });
        
        gpuInitialized = true;
        gpuSupported = true;
        
        console.log('✓ WebGPU 初始化成功');
        console.log('  GPU:', adapter.name || 'Unknown');
        console.log('  限制:', {
            maxComputeWorkgroupsPerDimension: gpuDevice.limits.maxComputeWorkgroupsPerDimension,
            maxComputeInvocationsPerWorkgroup: gpuDevice.limits.maxComputeInvocationsPerWorkgroup,
            maxBufferSize: gpuDevice.limits.maxBufferSize
        });
        
        return true;
        
    } catch (error) {
        console.warn('WebGPU 初始化失败:', error);
        gpuInitialized = true;
        gpuSupported = false;
        return false;
    }
}

/**
 * Check if WebGPU is available and initialized
 * @returns {boolean}
 */
function isWebGPUAvailable() {
    return gpuInitialized && gpuSupported && gpuDevice !== null;
}

/**
 * Convert adjacency list to dense matrix format for GPU
 * @param {Array} adjacencyList - Adjacency list with {index, weight} pairs
 * @param {number} nodeCount - Total number of nodes
 * @returns {Float32Array} Flat adjacency matrix (nodeCount x nodeCount)
 */
function convertToAdjacencyMatrix(adjacencyList, nodeCount) {
    const matrix = new Float32Array(nodeCount * nodeCount);
    
    // Initialize with infinity (use large number since GPU doesn't handle Infinity well)
    const INF = 1e10;
    matrix.fill(INF);
    
    // Set diagonal to 0
    for (let i = 0; i < nodeCount; i++) {
        matrix[i * nodeCount + i] = 0;
    }
    
    // Fill edges from adjacency list
    for (let i = 0; i < nodeCount; i++) {
        const neighbors = adjacencyList[i] || [];
        for (const { index, weight } of neighbors) {
            if (index >= 0 && index < nodeCount) {
                matrix[i * nodeCount + index] = weight || 1.0;
            }
        }
    }
    
    return matrix;
}

/**
 * WGSL shader code for parallel shortest path computation
 * Uses a simplified parallel Dijkstra-like algorithm
 */
const DIJKSTRA_SHADER = `
@group(0) @binding(0) var<storage, read> adjacency: array<f32>;
@group(0) @binding(1) var<storage, read_write> distances: array<f32>;
@group(0) @binding(2) var<storage, read> params: array<u32>;

const INF: f32 = 1e10;
const WORKGROUP_SIZE: u32 = 256;

@compute @workgroup_size(256)
fn dijkstra_kernel(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_count = params[0];
    let root_index = params[1];
    let thread_id = global_id.x;
    
    if (thread_id >= node_count) {
        return;
    }
    
    // Each thread computes distance from root to its assigned node
    let dest_node = thread_id;
    
    // Initialize distance array (shared across all nodes from this root)
    let dist_offset = root_index * node_count;
    
    // Simple iterative relaxation (not optimal but parallelizable)
    // This is a simplified version - proper parallel SSSP is more complex
    for (var iter: u32 = 0; iter < node_count; iter++) {
        // Read current distances
        var my_dist = distances[dist_offset + thread_id];
        
        // Relax edges
        for (var neighbor: u32 = 0; neighbor < node_count; neighbor++) {
            let edge_weight = adjacency[thread_id * node_count + neighbor];
            let neighbor_dist = distances[dist_offset + neighbor];
            
            if (edge_weight < INF && neighbor_dist < INF) {
                let new_dist = neighbor_dist + edge_weight;
                if (new_dist < my_dist) {
                    my_dist = new_dist;
                }
            }
        }
        
        // Write back
        distances[dist_offset + thread_id] = my_dist;
        
        // Synchronization barrier (workgroup only)
        workgroupBarrier();
    }
}

@compute @workgroup_size(256)
fn init_distances(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_count = params[0];
    let root_index = params[1];
    let thread_id = global_id.x;
    
    if (thread_id >= node_count) {
        return;
    }
    
    let dist_offset = root_index * node_count;
    
    if (thread_id == root_index) {
        distances[dist_offset + thread_id] = 0.0;
    } else {
        distances[dist_offset + thread_id] = INF;
    }
}
`;

/**
 * Calculate integration using WebGPU
 * @param {Array} features - GeoJSON features
 * @param {Array} adjacencyList - Pre-computed adjacency list
 * @param {Function} progressCallback - Progress callback
 * @param {number} tulipBins - Angle resolution (default 8)
 * @returns {Promise<Map>} Map of node index to integration value
 */
async function calculateIntegrationWebGPU(features, adjacencyList, progressCallback, tulipBins = 8) {
    if (!isWebGPUAvailable()) {
        throw new Error('WebGPU not available');
    }
    
    const nodeCount = features.length;
    const results = new Map();
    
    console.log('WebGPU 整合度计算开始:', {
        nodeCount: nodeCount,
        tulipBins: tulipBins,
        gpu: gpuDevice ? 'Available' : 'Not available'
    });
    
    if (progressCallback) {
        progressCallback('准备 WebGPU 计算...', 10);
    }
    
    try {
        // Convert adjacency list to matrix
        const adjacencyMatrix = convertToAdjacencyMatrix(adjacencyList, nodeCount);
        console.log('【WebGPU Debug】邻接矩阵大小:', adjacencyMatrix.length, 'elements');
        console.log('【WebGPU Debug】邻接矩阵前10个值:', adjacencyMatrix.slice(0, 10));
        console.log('【WebGPU Debug】邻接矩阵非无穷值数量:', adjacencyMatrix.filter(v => v < 1e9).length);
        
        // Create GPU buffers
        const adjacencyBuffer = gpuDevice.createBuffer({
            size: adjacencyMatrix.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(adjacencyBuffer.getMappedRange()).set(adjacencyMatrix);
        adjacencyBuffer.unmap();
        console.log('【WebGPU Debug】邻接矩阵已上传到 GPU');
        
        // Distance buffer (nodeCount x nodeCount to store all distances)
        const distancesArray = new Float32Array(nodeCount * nodeCount);
        distancesArray.fill(1e10);
        
        const distancesBuffer = gpuDevice.createBuffer({
            size: distancesArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        console.log('【WebGPU Debug】距离缓冲区大小:', distancesArray.byteLength, 'bytes');
        
        // Parameters buffer [nodeCount, rootIndex]
        const paramsBuffer = gpuDevice.createBuffer({
            size: 8, // 2 * u32
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        
        // Read buffer for results
        const readBuffer = gpuDevice.createBuffer({
            size: nodeCount * 4, // One row at a time
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        
        // Create shader module
        const shaderModule = gpuDevice.createShaderModule({
            code: DIJKSTRA_SHADER
        });
        
        // Create compute pipeline
        const pipeline = gpuDevice.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'dijkstra_kernel'
            }
        });
        
        const initPipeline = gpuDevice.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'init_distances'
            }
        });
        
        // Process each node as root
        const updateInterval = Math.max(1, Math.floor(nodeCount / 20));
        
        for (let root = 0; root < nodeCount; root++) {
            if (progressCallback && root % updateInterval === 0) {
                const percent = 10 + (root / nodeCount) * 85;
                progressCallback(`WebGPU 计算中... (${root + 1}/${nodeCount})`, Math.min(95, percent));
            }
            
            console.log(`【WebGPU Debug】开始计算根节点 ${root}`);
            
            // Update params for this root
            const params = new Uint32Array([nodeCount, root]);
            gpuDevice.queue.writeBuffer(paramsBuffer, 0, params);
            
            // Create bind group
            const bindGroup = gpuDevice.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: adjacencyBuffer } },
                    { binding: 1, resource: { buffer: distancesBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });
            
            const initBindGroup = gpuDevice.createBindGroup({
                layout: initPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: adjacencyBuffer } },
                    { binding: 1, resource: { buffer: distancesBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });
            
            // Create command encoder
            const commandEncoder = gpuDevice.createCommandEncoder();
            
            // Initialize distances
            const initPass = commandEncoder.beginComputePass();
            initPass.setPipeline(initPipeline);
            initPass.setBindGroup(0, initBindGroup);
            const initWorkgroups = Math.ceil(nodeCount / 256);
            initPass.dispatchWorkgroups(initWorkgroups);
            initPass.end();
            
            // Run Dijkstra computation
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(pipeline);
            computePass.setBindGroup(0, bindGroup);
            const workgroups = Math.ceil(nodeCount / 256);
            computePass.dispatchWorkgroups(workgroups);
            computePass.end();
            
            // Copy results to read buffer
            commandEncoder.copyBufferToBuffer(
                distancesBuffer,
                root * nodeCount * 4,
                readBuffer,
                0,
                nodeCount * 4
            );
            
            // Submit commands
            gpuDevice.queue.submit([commandEncoder.finish()]);
            
            // Read results
            await readBuffer.mapAsync(GPUMapMode.READ);
            const distances = new Float32Array(readBuffer.getMappedRange()).slice();
            readBuffer.unmap();
            
            // Debug first few roots
            if (root < 3) {
                console.log(`【WebGPU Debug】根节点 ${root} 的距离数组:`, distances.slice(0, 10));
                console.log(`【WebGPU Debug】根节点 ${root} 可达节点数:`, distances.filter(d => d < 1e9).length);
            }
            
            // Calculate integration value
            let totalDepth = 0;
            let reachableCount = 0;
            for (let i = 0; i < nodeCount; i++) {
                if (i !== root) {
                    const dist = distances[i];
                    if (dist < 1e9) {
                        totalDepth += dist;
                        reachableCount++;
                    } else {
                        totalDepth += (nodeCount * nodeCount * 10);
                    }
                }
            }
            
            // Debug totals
            if (root < 3) {
                console.log(`【WebGPU Debug】根节点 ${root} 总深度:`, totalDepth, '可达节点:', reachableCount);
            }
            
            // Apply integration formula
            const totalDepthConv = (2.0 * totalDepth) / (tulipBins - 1.0);
            const integration = totalDepthConv > 0 ? (nodeCount * nodeCount) / totalDepthConv : 0;
            
            if (root < 3) {
                console.log(`【WebGPU Debug】根节点 ${root} 整合度:`, integration);
            }
            
            results.set(root, integration);
        }
        
        // Cleanup
        adjacencyBuffer.destroy();
        distancesBuffer.destroy();
        paramsBuffer.destroy();
        readBuffer.destroy();
        
        if (progressCallback) {
            progressCallback('WebGPU 计算完成', 95);
        }
        
        console.log('WebGPU 计算完成, 结果数量:', results.size);
        return results;
        
    } catch (error) {
        console.error('WebGPU 计算失败:', error);
        throw error;
    }
}
