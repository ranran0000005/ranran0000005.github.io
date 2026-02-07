/**
 * Web Worker 用于并行计算整合度
 * 计算单个根节点的深度值总和
 */

// 计算单个根节点的深度值总和（加权最短路径，邻接表元素需包含 {index, weight}）
function calculateDepthForRoot(rootIndex, adjacencyList, nodeCount) {
    let totalDepth = 0;
    const dist = new Array(nodeCount).fill(Infinity);
    dist[rootIndex] = 0;
    const visited = new Array(nodeCount).fill(false);

    // 简单 O(n^2) Dijkstra
    for (let k = 0; k < nodeCount; k++) {
        let u = -1;
        let best = Infinity;
        for (let i = 0; i < nodeCount; i++) {
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
            const w = nb.weight !== undefined ? nb.weight : 1;
            if (!visited[v] && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
            }
        }
    }

    for (let i = 0; i < nodeCount; i++) {
        if (i === rootIndex) continue;
        totalDepth += dist[i] === Infinity ? (nodeCount * 100) : dist[i];
    }

    return totalDepth;
}

// 监听主线程消息
self.onmessage = function(e) {
    try {
        const { rootIndex, adjacencyList, nodeCount } = e.data;
        const totalDepth = calculateDepthForRoot(rootIndex, adjacencyList, nodeCount);
        self.postMessage({ rootIndex, totalDepth });
    } catch (error) {
        self.postMessage({ 
            rootIndex: e.data.rootIndex, 
            error: error.message,
            totalDepth: 0 
        });
    }
};

