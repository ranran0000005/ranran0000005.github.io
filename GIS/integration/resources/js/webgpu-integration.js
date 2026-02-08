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
 * Uses Delta-Stepping algorithm - GPU-friendly alternative to Dijkstra
 * 
 * Delta-Stepping works by:
 * 1. Bucketing nodes by distance ranges (buckets of size delta)
 * 2. Processing buckets in order (light edges first, then heavy edges)
 * 3. Each bucket can be processed in parallel
 * 
 * For simplicity, we use a "Near-Far" approach:
 * - "Near" nodes: distance changed in last iteration
 * - Process near nodes' light edges in parallel
 * - Then process heavy edges
 */
const DIJKSTRA_SHADER = `
@group(0) @binding(0) var<storage, read> adjacency: array<f32>;
@group(0) @binding(1) var<storage, read_write> distances: array<f32>;
@group(0) @binding(2) var<storage, read_write> active_nodes: array<u32>;  // Active nodes bitmap
@group(0) @binding(3) var<storage, read> params: array<u32>;

const INF: f32 = 1e10;
const DELTA: f32 = 1.0;  // Bucket width (adjust based on edge weights)

// Initialize distances and active set
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
        active_nodes[thread_id] = 1u;  // Root is active
    } else {
        distances[dist_offset + thread_id] = INF;
        active_nodes[thread_id] = 0u;
    }
}

// Relax light edges from active nodes
@compute @workgroup_size(256)
fn relax_light(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_count = params[0];
    let root_index = params[1];
    let thread_id = global_id.x;
    
    if (thread_id >= node_count) {
        return;
    }
    
    // Only process active nodes
    if (active_nodes[thread_id] == 0u) {
        return;
    }
    
    let dist_offset = root_index * node_count;
    let my_dist = distances[dist_offset + thread_id];
    
    if (my_dist >= INF) {
        return;
    }
    
    // Relax all outgoing edges from this node
    for (var neighbor: u32 = 0; neighbor < node_count; neighbor++) {
        let edge_weight = adjacency[thread_id * node_count + neighbor];
        
        if (edge_weight < INF) {
            let new_dist = my_dist + edge_weight;
            let old_dist = distances[dist_offset + neighbor];
            
            if (new_dist < old_dist) {
                distances[dist_offset + neighbor] = new_dist;
                active_nodes[neighbor] = 1u;  // Mark neighbor as active for next round
            }
        }
    }
    
    // Deactivate this node after processing
    active_nodes[thread_id] = 0u;
}

// Check if any nodes are still active (for termination)
@compute @workgroup_size(256)
fn check_active(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_count = params[0];
    let thread_id = global_id.x;
    
    if (thread_id >= node_count) {
        return;
    }
    
    // This is a simple check - in practice we'd use reduction
    // For now, we'll rely on fixed iteration count
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
        
        // Create explicit bind group layout for Delta-Stepping
        const bindGroupLayout = gpuDevice.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'storage' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'storage' }  // Active nodes bitmap
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'read-only-storage' }
                }
            ]
        });
        
        const pipelineLayout = gpuDevice.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });
        
        // Create compute pipelines
        const relaxPipeline = gpuDevice.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module: shaderModule,
                entryPoint: 'relax_light'
            }
        });
        
        const initPipeline = gpuDevice.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module: shaderModule,
                entryPoint: 'init_distances'
            }
        });
        
        // Create active nodes buffer
        const activeBuffer = gpuDevice.createBuffer({
            size: nodeCount * 4, // u32 per node
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        console.log('【WebGPU Debug】活跃节点缓冲区大小:', nodeCount * 4, 'bytes');
        
        // Create bind group once (reusable for all roots)
        const bindGroup = gpuDevice.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: adjacencyBuffer } },
                { binding: 1, resource: { buffer: distancesBuffer } },
                { binding: 2, resource: { buffer: activeBuffer } },
                { binding: 3, resource: { buffer: paramsBuffer } }
            ]
        });
        
        console.log('【WebGPU Debug】Pipeline和BindGroup创建成功');
        
        // Process nodes in batches to prevent GPU freeze
        const BATCH_SIZE = 10; // Process 10 roots at a time
        const updateInterval = Math.max(1, Math.floor(nodeCount / 20));
        
        for (let batchStart = 0; batchStart < nodeCount; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, nodeCount);
            
            // Process batch
            for (let root = batchStart; root < batchEnd; root++) {
                if (progressCallback && root % updateInterval === 0) {
                    const percent = 10 + (root / nodeCount) * 85;
                    progressCallback(`WebGPU 计算中... (${root + 1}/${nodeCount})`, Math.min(95, percent));
                }
                
                if (root < 3 || root % 100 === 0) {
                    console.log(`【WebGPU Debug】开始计算根节点 ${root}`);
                }
                
                // Update params for this root
                const params = new Uint32Array([nodeCount, root]);
                gpuDevice.queue.writeBuffer(paramsBuffer, 0, params);
                
                // Create command encoder
                const commandEncoder = gpuDevice.createCommandEncoder();
                
                // Initialize distances and active bitmap
                const initPass = commandEncoder.beginComputePass();
                initPass.setPipeline(initPipeline);
                initPass.setBindGroup(0, bindGroup);
                const initWorkgroups = Math.ceil(nodeCount / 256);
                initPass.dispatchWorkgroups(initWorkgroups);
                initPass.end();
                
                // Run Delta-Stepping iterations
                // Strategy: Use adaptive iteration count based on graph size
                // - Small graphs (< 100): Use full n-1 (Bellman-Ford guarantee)
                // - Medium graphs (100-1000): Use sqrt(n) * 10 (grid-like assumption)
                // - Large graphs (> 1000): Use log2(n) * 15 (sparse network assumption)
                let maxIterations;
                if (nodeCount < 100) {
                    maxIterations = nodeCount - 1;
                } else if (nodeCount < 1000) {
                    maxIterations = Math.ceil(Math.sqrt(nodeCount) * 10);
                } else {
                    // For 2461 nodes: log2(2461) * 15 = 11.3 * 15 ≈ 170 iterations
                    maxIterations = Math.ceil(Math.log2(nodeCount) * 15);
                }
                
                // Cap at nodeCount to avoid infinite loops
                maxIterations = Math.min(maxIterations, nodeCount);
                
                if (root === 0) {
                    console.log(`【WebGPU Debug】使用迭代次数: ${maxIterations} (节点数: ${nodeCount})`);
                }
                
                for (let iter = 0; iter < maxIterations; iter++) {
                    // Relax edges from active nodes
                    const relaxPass = commandEncoder.beginComputePass();
                    relaxPass.setPipeline(relaxPipeline);
                    relaxPass.setBindGroup(0, bindGroup);
                    const workgroups = Math.ceil(nodeCount / 256);
                    relaxPass.dispatchWorkgroups(workgroups);
                    relaxPass.end();
                    
                    // Note: In a more sophisticated implementation, we would check
                    // if any nodes are still active and terminate early
                    // For now, we rely on adaptive iteration count
                }
                
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
            
            // Yield control to browser between batches to prevent freeze
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Cleanup
        adjacencyBuffer.destroy();
        distancesBuffer.destroy();
        activeBuffer.destroy();
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
