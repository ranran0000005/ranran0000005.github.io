/**
 * 连接度计算模块
 * 连接度 = 一条线段与其他线段的相交次数（使用预计算邻接表）
 */

/**
 * 计算连接度（Connectivity）——使用预计算邻接表
 * 连接度 = 邻接表度数
 * @param {Array} features - GeoJSON 要素数组
 * @param {Function} progressCallback - 进度回调函数 (message, percent)
 * @param {Array} adjacencyList - 预计算的邻接表（可选，如果不提供则内部构建）
 * @returns {Promise<Map>} 要素ID到连接度的映射
 */
async function calculateConnectivity(features, progressCallback, adjacencyList) {
    console.log('开始计算连接度...');
    const connectivity = new Map();

    // 如果没有传入邻接表，需要先构建（需要从 integration.js 导入 buildAdjacencySimple）
    if (!adjacencyList) {
        // 注意：这里需要 buildAdjacencySimple，但它应该在 integration.js 中
        // 如果 integration.js 已加载，可以直接调用
        if (typeof buildAdjacencySimple === 'function') {
            const adj = await buildAdjacencySimple(features, progressCallback);
            adjacencyList = adj.adjacencyList;
        } else {
            throw new Error('buildAdjacencySimple 函数未定义，请确保 integration.js 已加载');
        }
    }

    // 连接度 = 邻接表中每个节点的邻居数量
    adjacencyList.forEach((neighbors, idx) => {
        connectivity.set(idx, neighbors.length);
    });

    if (progressCallback) {
        progressCallback('连接度计算完成', 40);
    }

    console.log('连接度计算完成');
    return connectivity;
}
