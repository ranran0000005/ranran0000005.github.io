/**
 * WMS 图层管理
 */

/**
 * 添加 WMS 图层
 * @param {string} layerName - 图层名称
 * @param {string} workspace - 工作空间名称
 */
function addWMSLayer(layerName, workspace) {
    // 如果图层已存在，先移除
    if (wmsLayers[layerName]) {
        removeWMSLayer(layerName);
    }

    const fullLayerName = workspace + ':' + layerName;
    
    const wmsSource = new ol.source.ImageWMS({
        url: 'http://gis.kjjfpt.top/geoserver/' + workspace + '/wms',
        params: {
            'LAYERS': fullLayerName,
            'VERSION': '1.1.0',
            'TRANSPARENT': true
        },
        serverType: 'geoserver',
        ratio: 1,
        projection: 'EPSG:4326'
    });

    const wmsLayer = new ol.layer.Image({ 
        source: wmsSource, 
        opacity: 0.8,
        name: layerName // 添加名称属性便于管理
    });

    // 存储图层引用
    wmsLayers[layerName] = {
        layer: wmsLayer,
        workspace: workspace,
        fullName: fullLayerName
    };

    // 添加到地图
    map.addLayer(wmsLayer);

    // 错误处理
    wmsSource.on('tileloaderror', (evt) => { 
        console.error('WMS layer load error:', layerName, evt); 
    });

    console.log('已添加 WMS 图层:', fullLayerName);
    return wmsLayer;
}

/**
 * 移除 WMS 图层
 * @param {string} layerName - 图层名称
 */
function removeWMSLayer(layerName) {
    if (wmsLayers[layerName]) {
        map.removeLayer(wmsLayers[layerName].layer);
        delete wmsLayers[layerName];
        console.log('已移除 WMS 图层:', layerName);
        return true;
    }
    return false;
}

/**
 * 切换 WMS 图层显示/隐藏
 * @param {string} layerName - 图层名称
 * @param {boolean} visible - 是否显示
 */
function toggleWMSLayer(layerName, visible) {
    if (wmsLayers[layerName]) {
        wmsLayers[layerName].layer.setVisible(visible);
        console.log('图层', layerName, visible ? '显示' : '隐藏');
        return true;
    }
    return false;
}

/**
 * 设置 WMS 图层透明度
 * @param {string} layerName - 图层名称
 * @param {number} opacity - 透明度 (0-1)
 */
function setWMSLayerOpacity(layerName, opacity) {
    if (wmsLayers[layerName]) {
        wmsLayers[layerName].layer.setOpacity(opacity);
        console.log('图层', layerName, '透明度设置为', opacity);
        return true;
    }
    return false;
}

