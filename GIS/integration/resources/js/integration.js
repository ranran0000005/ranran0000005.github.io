/**
 * 整合度计算模块
 * 实现整合度（Integration）计算，包括深度值计算和并行优化
 * 支持两种模式：拓扑深度（topo）和角度+长度加权（angle）
 */

/**
 * 计算两条线段的交点
 * @param {Array} line1 - 第一条线段
 * @param {Array} line2 - 第二条线段
 * @returns {Array|null} 交点坐标或 null
 */
function getLineIntersection(line1, line2) {
    const [p1, p2] = line1;
    const [p3, p4] = line2;
    
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;
    const [x4, y4] = p4;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // 平行线
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    }
    
    return null;
}

/**
 * 从 GeoJSON 要素提取线段坐标
 * @param {Object} feature - GeoJSON 要素
 * @returns {Array} 线段数组，每个线段是 [[x1, y1], [x2, y2]]
 */
function extractLinesFromFeature(feature) {
    const geometry = feature.geometry;
    const lines = [];
    
    if (geometry.type === 'LineString') {
        const coordinates = geometry.coordinates;
        for (let i = 0; i < coordinates.length - 1; i++) {
            lines.push([coordinates[i], coordinates[i + 1]]);
        }
    } else if (geometry.type === 'MultiLineString') {
        geometry.coordinates.forEach(lineString => {
            for (let i = 0; i < lineString.length - 1; i++) {
                lines.push([lineString[i], lineString[i + 1]]);
            }
        });
    }
    
    return lines;
}

/**
 * 计算两条线的方向角度（度）
 * @param {Array} line1 - 线段1 [[x1, y1], [x2, y2]]
 * @param {Array} line2 - 线段2 [[x3, y3], [x4, y4]]
 * @returns {number} 0-180 度
 */
function angleBetweenLines(line1, line2) {
    const v1 = [line1[1][0] - line1[0][0], line1[1][1] - line1[0][1]];
    const v2 = [line2[1][0] - line2[0][0], line2[1][1] - line2[0][1]];
    const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
    if (len1 === 0 || len2 === 0) return 0;
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    let cos = dot / (len1 * len2);
    cos = Math.max(-1, Math.min(1, cos));
    const rad = Math.acos(cos);
    const deg = rad * 180 / Math.PI;
    // 线方向无向，取最小夹角
    return Math.min(deg, 180 - deg);
}

/**
 * 计算线段长度
 * @param {Array} line - 线段 [[x1, y1], [x2, y2]]
 * @returns {number} 线段长度
 */
function lineLength(line) {
    const dx = line[1][0] - line[0][0];
    const dy = line[1][1] - line[0][1];
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 异步延迟函数，用于让出控制权给浏览器更新UI
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 构建邻接表（判断相交并计算权重）
 * @param {Array} features - GeoJSON 要素数组
 * @param {Function} progressCallback - 进度回调函数
 * @param {number} tulipBins - 角度分辨率，默认8
 * @param {string} mode - 'topo'（只计转折步数）或 'angle'（角度+长度加权）
 * @returns {Promise<{adjacencyList: Array<Array<{index:number, weight:number}>>, cachedLines: Array}>}
 */
async function buildAdjacencySimple(features, progressCallback, tulipBins = 8, mode = 'angle') {
    const total = features.length;
    const totalPairs = (total * (total - 1)) / 2;
    let processedPairs = 0;
    const updateInterval = Math.max(1, Math.floor(total / 40));

    // 缓存所有线段，避免重复提取
    const cachedLines = features.map(f => extractLinesFromFeature(f));
    const adjacencyList = Array.from({ length: total }, () => []);

    for (let i = 0; i < total; i++) {
        if (progressCallback && i % updateInterval === 0) {
            const percent = 5 + (processedPairs / totalPairs) * 25; // 5%-30%
            progressCallback(`正在预计算邻接关系... (${i + 1}/${total})`, Math.min(30, percent));
            await delay(5);
        }

        const lines1 = cachedLines[i];
        for (let j = i + 1; j < total; j++) {
            const lines2 = cachedLines[j];

            let intersect = false;
            let angleDeg = 0;
            let len1 = 0;
            let len2 = 0;
            for (const line1 of lines1) {
                for (const line2 of lines2) {
                    if (getLineIntersection(line1, line2)) {
                        intersect = true;
                        angleDeg = angleBetweenLines(line1, line2);
                        len1 = lineLength(line1);
                        len2 = lineLength(line2);
                        break;
                    }
                }
                if (intersect) break;
            }

            if (intersect) {
                let weight = 1;
                if (mode === 'angle') {
                    const avgLen = (len1 + len2) / 2;
                    weight = Math.max(0.1, angleDeg * tulipBins * 0.5 + avgLen * 0.001);
                } else {
                    weight = 1; // topo: 每跨一条线加1
                }
                adjacencyList[i].push({ index: j, weight });
                adjacencyList[j].push({ index: i, weight });
            }
            processedPairs++;
        }
    }

    if (progressCallback) {
        progressCallback('邻接关系预计算完成', 30);
    }

    return { adjacencyList, cachedLines };
}

/**
 * 按需计算某一条线的整合度（基于已构建的邻接表）
 * 使用 Dijkstra 算法计算从 rootIndex 到所有其他节点的最短路径深度总和
 * @param {number} rootIndex - 根节点索引
 * @param {number} nodeCount - 节点总数（如果提供全局节点数，应使用全局节点数）
 * @param {Array} adjacencyList - 邻接表数组，每个元素是 [{index, weight}, ...]
 * @param {number} tulipBins - 角度分辨率，默认8
 * @param {boolean} applyFormula - 是否应用整合度公式，默认true
 * @param {number} globalNodeCount - 全局节点数（用于确保一致性）
 * @returns {Promise<number>} 整合度值或总深度值
 */
async function calculateIntegrationOnDemand(rootIndex, nodeCount, adjacencyList, tulipBins = 8, applyFormula = true, globalNodeCount = null) {
    // 优先使用全局节点数，确保一致性
    const totalNodes = globalNodeCount || nodeCount || (adjacencyList ? adjacencyList.length : 0);
    if (!adjacencyList || totalNodes <= 0 || rootIndex < 0 || rootIndex >= totalNodes) {
        return 0;
    }
    
    let totalDepth = 0;
    const dist = new Array(totalNodes).fill(Infinity);
    dist[rootIndex] = 0;
    const visited = new Array(totalNodes).fill(false);

    // Dijkstra 算法：计算从 rootIndex 到所有其他节点的最短路径
    for (let k = 0; k < totalNodes; k++) {
        let u = -1;
        let best = Infinity;
        for (let i = 0; i < totalNodes; i++) {
            if (!visited[i] && dist[i] < best) {
                best = dist[i];
                u = i;
            }
        }
        if (u === -1) break;
        visited[u] = true;
        const neighbors = adjacencyList[u] || [];
        for (const nb of neighbors) {
            const v = nb.index;
            const w = nb.weight;
            if (!visited[v] && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
            }
        }
    }

    // 累加所有节点的深度值（不包括根节点自身）
    for (let i = 0; i < totalNodes; i++) {
        if (i === rootIndex) continue;
        // 不可达节点给出较大惩罚，避免孤立线段被高估
        totalDepth += dist[i] === Infinity ? (totalNodes * totalNodes * 10) : dist[i];
    }

    // 如果不需要应用公式，直接返回总深度值
    if (!applyFormula) {
        return totalDepth;
    }
    
    // 应用整合度公式
    // Integration = (nodecount^2) / (totaldepth_conv)
    // totaldepth_conv = (2 * totaldepth) / (tulip_bins - 1.0)
    const totalDepthConv = (2 * totalDepth) / (tulipBins - 1.0);
    const integrationValue = totalDepthConv > 0 ? (totalNodes * totalNodes) / totalDepthConv : 0;
    return integrationValue;
}

/**
 * 计算整合度（Integration）- 支持拓扑深度和角度+长度加权两种模式
 * 使用单源最短路径（Dijkstra）计算 root 到所有节点的最小深度和
 * @param {Array} features - GeoJSON 要素数组
 * @param {number} tulipBins - 角度分辨率，默认8
 * @param {Function} progressCallback - 进度回调函数
 * @param {Array} adjacencyList - 预计算邻接表（可选）
 * @param {string} mode - 'topo'（拓扑深度）或 'angle'（角度+长度加权），默认'angle'
 * @returns {Promise<Map>} 要素ID到整合度的映射
 */
async function calculateIntegration(features, tulipBins = 8, progressCallback, adjacencyList, mode = 'angle') {
    console.log('开始计算整合度（模式:', mode, ')');
    const integration = new Map();
    const nodeCount = features.length;

    // 如果没有邻接表，先构建
    if (!adjacencyList) {
        const adj = await buildAdjacencySimple(features, progressCallback, tulipBins, mode);
        adjacencyList = adj.adjacencyList;
    }

    // 计算每个节点到其他节点的总深度（最短步数）
    const updateInterval = Math.max(1, Math.floor(nodeCount / 50));

    // 优先使用 Web Workers 并行计算
    const useWorkers = typeof Worker !== 'undefined' && nodeCount > 1;
    if (useWorkers) {
        const workerCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4, nodeCount));
        const workers = [];
        const results = new Array(nodeCount).fill(null);
        let completed = 0;
        let errorFlag = false;
        const workerUrl = 'resources/js/integration-worker.js';

        await new Promise((resolve, reject) => {
            const taskQueue = [];
            for (let i = 0; i < nodeCount; i++) taskQueue.push(i);

            const startTask = (worker) => {
                if (taskQueue.length === 0) return false;
                const idx = taskQueue.shift();
                worker.postMessage({ rootIndex: idx, adjacencyList, nodeCount });
                return true;
            };

            const cleanup = () => workers.forEach(w => w.terminate());

            for (let w = 0; w < workerCount; w++) {
                try {
                    const worker = new Worker(workerUrl);
                    workers.push(worker);

                    worker.onmessage = (e) => {
                        if (errorFlag) return;
                        const { rootIndex, totalDepth, error } = e.data || {};
                        if (error) {
                            errorFlag = true;
                            cleanup();
                            reject(new Error(error));
                            return;
                        }
                        results[rootIndex] = totalDepth;
                        completed++;
                        if (progressCallback && completed % updateInterval === 0) {
                            const percent = 30 + (completed / nodeCount) * 65;
                            progressCallback(`正在计算深度值... (${completed}/${nodeCount})`, Math.min(95, percent));
                        }
                        if (!startTask(worker) && completed >= nodeCount) {
                            cleanup();
                            resolve();
                        }
                    };

                    worker.onerror = (err) => {
                        if (errorFlag) return;
                        errorFlag = true;
                        cleanup();
                        reject(err);
                    };

                    startTask(worker);
                } catch (err) {
                    errorFlag = true;
                    cleanup();
                    reject(err);
                    break;
                }
            }
        }).catch(async (e) => {
            console.warn('Web Worker 并行计算失败，回退单线程:', e);
            // 回退单线程
            for (let root = 0; root < nodeCount; root++) {
                if (progressCallback && root % updateInterval === 0) {
                    const percent = 30 + (root / nodeCount) * 65;
                    progressCallback(`正在计算深度值... (${root + 1}/${nodeCount})`, Math.min(95, percent));
                    await delay(5);
                }
                results[root] = await calculateIntegrationOnDemand(root, nodeCount, adjacencyList, tulipBins, false);
            }
            // 将结果写入 integration Map
            for (let i = 0; i < nodeCount; i++) {
                integration.set(i, results[i]);
            }
            return;
        });

        // 如未回退，将 worker 结果写入
        if (integration.size === 0) {
            for (let i = 0; i < nodeCount; i++) {
                const totalDepth = results[i] ?? (nodeCount * 100);
                const totalDepthConv = (2 * totalDepth) / (tulipBins - 1.0);
                const integrationValue = totalDepthConv > 0 ? (nodeCount * nodeCount) / totalDepthConv : 0;
                integration.set(i, integrationValue);
            }
        }
    } else {
        // 单线程计算
        for (let root = 0; root < nodeCount; root++) {
            if (progressCallback && root % updateInterval === 0) {
                const percent = 30 + (root / nodeCount) * 65; // 30%-95%
                progressCallback(`正在计算深度值... (${root + 1}/${nodeCount})`, Math.min(95, percent));
                await delay(5);
            }

            const totalDepth = await calculateIntegrationOnDemand(root, nodeCount, adjacencyList, tulipBins, false);
            const totalDepthConv = (2 * totalDepth) / (tulipBins - 1.0);
            const integrationValue = totalDepthConv > 0 ? (nodeCount * nodeCount) / totalDepthConv : 0;
            integration.set(root, integrationValue);
        }
    }

    if (progressCallback) {
        progressCallback('整合度计算完成', 95);
    }

    console.log('整合度计算完成');
    return integration;
}
