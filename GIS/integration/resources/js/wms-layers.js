/**
 * WMS图层管理功能
 */

/**
 * 添加WMS图层到地图
 * @param {string} layerName - 图层名称
 * @param {string} workspace - 工作空间名称
 * @param {Object} options - 可选配置参数
 */
function addWMSLayer(layerName, workspace, options) {
    options = options || {};

    const targetWorkspace = workspace || geoserverConfig.workspace || '';
    const baseUrl = geoserverConfig.url.replace(/\/$/, '');

    // 构建图层完整名称
    const fullName = targetWorkspace ? `${targetWorkspace}:${layerName}` : layerName;

    // 检查图层是否已存在
    if (wmsLayers[layerName]) {
        console.warn(`图层 ${layerName} 已存在`);
        return wmsLayers[layerName].layer;
    }

    // 构建WMS URL
    const wmsUrl = targetWorkspace
        ? `${baseUrl}/${targetWorkspace}/wms`
        : `${baseUrl}/wms`;

    // 创建WMS图层
    const wmsLayer = new ol.layer.Tile({
        source: new ol.source.TileWMS({
            url: wmsUrl,
            params: {
                'LAYERS': fullName,
                'TILED': true,
                'FORMAT': 'image/png',
                'TRANSPARENT': true,
                'VERSION': '1.1.1'
            },
            serverType: 'geoserver',
            crossOrigin: 'anonymous'
        }),
        name: layerName,
        visible: options.visible !== false,
        opacity: options.opacity || 1
    });

    // 添加到地图
    map.addLayer(wmsLayer);

    // 保存图层信息
    wmsLayers[layerName] = {
        layer: wmsLayer,
        name: layerName,
        workspace: targetWorkspace,
        fullName: fullName,
        url: wmsUrl
    };

    console.log(`WMS图层已添加: ${fullName}`);
    return wmsLayer;
}

/**
 * 移除WMS图层
 * @param {string} layerName - 图层名称
 */
function removeWMSLayer(layerName) {
    const layerInfo = wmsLayers[layerName];
    if (!layerInfo) {
        console.warn(`图层 ${layerName} 不存在`);
        return;
    }

    // 从地图移除
    map.removeLayer(layerInfo.layer);

    // 从列表删除
    delete wmsLayers[layerName];

    console.log(`WMS图层已移除: ${layerName}`);
}

/**
 * 切换WMS图层可见性
 * @param {string} layerName - 图层名称
 * @param {boolean} visible - 是否可见
 */
function toggleWMSLayer(layerName, visible) {
    const layerInfo = wmsLayers[layerName];
    if (layerInfo && layerInfo.layer) {
        layerInfo.layer.setVisible(visible);
    }
}

/**
 * 设置WMS图层透明度
 * @param {string} layerName - 图层名称
 * @param {number} opacity - 透明度 (0-1)
 */
function setWMSLayerOpacity(layerName, opacity) {
    const layerInfo = wmsLayers[layerName];
    if (layerInfo && layerInfo.layer) {
        layerInfo.layer.setOpacity(opacity);
    }
}

/**
 * 获取所有WMS图层列表
 * @returns {Object} 图层对象
 */
function getWMSLayers() {
    return wmsLayers;
}
