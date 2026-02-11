/**
 * Layer Storage Module
 * 使用IndexedDB持久化存储本地Shapefile图层数据
 * 刷新页面后数据不丢失
 */

// IndexedDB数据库名称和版本
const DB_NAME = 'WebGIS_LayerStorage';
const DB_VERSION = 2; // 升级版本以添加新的对象存储
const STORE_NAME = 'shapefileLayers';
const ANALYSIS_STORE_NAME = 'analysisResultLayers'; // 新增：分析结果图层存储

// 全局数据库实例
var layerDB = null;

/**
 * 初始化IndexedDB数据库
 * @returns {Promise<IDBDatabase>}
 */
async function initLayerStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = function(event) {
            console.error('IndexedDB初始化失败:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = function(event) {
            layerDB = event.target.result;
            console.log('IndexedDB初始化成功');
            resolve(layerDB);
        };

        request.onupgradeneeded = function(event) {
            const db = event.target.result;

            // 创建对象存储空间 - Shapefile图层
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('创建对象存储空间:', STORE_NAME);
            }
            
            // 创建对象存储空间 - 分析结果图层
            if (!db.objectStoreNames.contains(ANALYSIS_STORE_NAME)) {
                const analysisStore = db.createObjectStore(ANALYSIS_STORE_NAME, { keyPath: 'id' });
                analysisStore.createIndex('name', 'name', { unique: false });
                analysisStore.createIndex('timestamp', 'timestamp', { unique: false });
                analysisStore.createIndex('analysisType', 'analysisType', { unique: false });
                console.log('创建对象存储空间:', ANALYSIS_STORE_NAME);
            }
        };
    });
}

/**
 * 保存图层数据到IndexedDB
 * @param {Object} layerInfo - 图层信息对象
 * @returns {Promise<void>}
 */
async function saveLayerToStorage(layerInfo) {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // 准备存储的数据（只存储可序列化的数据）
        const storageData = {
            id: layerInfo.id,
            name: layerInfo.name,
            features: layerInfo.features,
            originalFeatures: layerInfo.originalFeatures,
            segmentMode: layerInfo.segmentMode,
            featureCount: layerInfo.featureCount,
            timestamp: Date.now()
        };

        const request = store.put(storageData);

        request.onsuccess = function() {
            console.log('图层数据已保存到IndexedDB:', layerInfo.name);
            resolve();
        };

        request.onerror = function(event) {
            console.error('保存图层数据失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 从IndexedDB加载所有图层数据
 * @returns {Promise<Array>}
 */
async function loadAllLayersFromStorage() {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = function(event) {
            const layers = event.target.result;
            console.log('从IndexedDB加载了', layers.length, '个图层');
            resolve(layers);
        };

        request.onerror = function(event) {
            console.error('加载图层数据失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 从IndexedDB删除指定图层
 * @param {string} layerId - 图层ID
 * @returns {Promise<void>}
 */
async function removeLayerFromStorage(layerId) {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(layerId);

        request.onsuccess = function() {
            console.log('图层已从IndexedDB删除:', layerId);
            resolve();
        };

        request.onerror = function(event) {
            console.error('删除图层数据失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 清除所有存储的图层数据
 * @returns {Promise<void>}
 */
async function clearAllLayersFromStorage() {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = function() {
            console.log('所有图层数据已从IndexedDB清除');
            resolve();
        };

        request.onerror = function(event) {
            console.error('清除图层数据失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 获取存储的图层数量
 * @returns {Promise<number>}
 */
async function getLayerCountFromStorage() {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function(event) {
            console.error('获取图层数量失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 恢复所有存储的图层到地图
 * 在页面加载时调用
 */
async function restoreLayersFromStorage() {
    try {
        console.log('开始从IndexedDB恢复图层数据...');

        // 初始化数据库
        await initLayerStorage();

        // 加载所有存储的Shapefile图层
        const storedLayers = await loadAllLayersFromStorage();
        
        // 加载所有存储的分析结果图层
        const storedAnalysisLayers = await loadAllAnalysisLayersFromStorage();

        if (storedLayers.length === 0 && storedAnalysisLayers.length === 0) {
            console.log('没有存储的图层数据需要恢复');
            return;
        }

        // 恢复Shapefile图层
        if (storedLayers.length > 0) {
            // 按时间戳排序（先导入的在前面）
            storedLayers.sort((a, b) => a.timestamp - b.timestamp);

            // 恢复每个图层
            for (const storedLayer of storedLayers) {
                await restoreSingleLayer(storedLayer);
            }

            // 更新图层计数器
            localShapefileLayerCounter = storedLayers.length;
        }
        
        // 恢复分析结果图层
        if (storedAnalysisLayers.length > 0) {
            // 按时间戳排序
            storedAnalysisLayers.sort((a, b) => a.timestamp - b.timestamp);
            
            // 恢复每个分析结果图层
            for (const storedAnalysisLayer of storedAnalysisLayers) {
                await restoreSingleAnalysisLayer(storedAnalysisLayer);
            }
            
            // 更新分析图层计数器
            analysisResultLayerCounter = storedAnalysisLayers.length;
        }

        // 更新UI
        updateLocalShapefileLayerList();

        const totalCount = storedLayers.length + storedAnalysisLayers.length;
        console.log('图层数据恢复完成，共恢复', totalCount, '个图层（', storedLayers.length, '个Shapefile +', storedAnalysisLayers.length, '个分析结果）');

        // 显示恢复提示
        showPopup(`已恢复 ${totalCount} 个图层数据（${storedLayers.length} 个Shapefile + ${storedAnalysisLayers.length} 个分析结果）`);

    } catch (error) {
        console.error('恢复图层数据失败:', error);
    }
}

/**
 * 恢复单个图层到地图
 * @param {Object} storedLayer - 存储的图层数据
 */
async function restoreSingleLayer(storedLayer) {
    try {
        const geoJsonFormat = new ol.format.GeoJSON();

        // 创建数据源
        const source = new ol.source.Vector();

        // 添加要素
        storedLayer.features.forEach(feature => {
            const olFeature = geoJsonFormat.readFeature(feature, {
                dataProjection: 'EPSG:4326',
                featureProjection: map.getView().getProjection()
            });

            // 设置样式
            olFeature.setStyle(new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#0066cc',
                    width: 2
                }),
                fill: new ol.style.Fill({
                    color: 'rgba(0, 102, 204, 0.1)'
                })
            }));

            source.addFeature(olFeature);
        });

        // 创建图层
        const layer = new ol.layer.Vector({
            source: source,
            name: storedLayer.id
        });

        map.addLayer(layer);

        // 构建图层信息对象
        const layerInfo = {
            id: storedLayer.id,
            name: storedLayer.name,
            layer: layer,
            source: source,
            features: storedLayer.features,
            originalFeatures: storedLayer.originalFeatures,
            segmentMode: storedLayer.segmentMode,
            featureCount: storedLayer.featureCount
        };

        // 添加到图层数组
        localShapefileLayers.push(layerInfo);

        console.log('已恢复图层:', storedLayer.name);

    } catch (error) {
        console.error('恢复单个图层失败:', storedLayer.id, error);
    }
}

/**
 * 检查浏览器是否支持IndexedDB
 * @returns {boolean}
 */
function isIndexedDBSupported() {
    return 'indexedDB' in window;
}

/**
 * 获取IndexedDB存储使用情况
 * @returns {Promise<Object>}
 */
async function getStorageUsage() {
    if (!isIndexedDBSupported()) {
        return { supported: false };
    }

    try {
        const count = await getLayerCountFromStorage();
        const layers = await loadAllLayersFromStorage();

        // 估算存储大小
        let totalSize = 0;
        layers.forEach(layer => {
            totalSize += JSON.stringify(layer).length * 2; // 粗略估算：每个字符2字节
        });

        return {
            supported: true,
            layerCount: count,
            estimatedSize: totalSize,
            estimatedSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        };
    } catch (error) {
        console.error('获取存储使用情况失败:', error);
        return { supported: true, error: error.message };
    }
}

/**
 * ========================================
 * 分析结果图层持久化相关函数
 * ========================================
 */

/**
 * 保存分析结果图层到IndexedDB
 * @param {Object} analysisLayerInfo - 分析结果图层信息对象
 * @returns {Promise<void>}
 */
async function saveAnalysisLayerToStorage(analysisLayerInfo) {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([ANALYSIS_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(ANALYSIS_STORE_NAME);

        // 准备存储的数据（只存储可序列化的数据）
        const storageData = {
            id: analysisLayerInfo.id,
            name: analysisLayerInfo.name,
            features: analysisLayerInfo.features,
            analysisType: analysisLayerInfo.analysisType,
            results: Array.from(analysisLayerInfo.results.entries()), // Map转数组
            minValue: analysisLayerInfo.minValue,
            maxValue: analysisLayerInfo.maxValue,
            sortedValues: analysisLayerInfo.sortedValues,
            sourceLayerName: analysisLayerInfo.sourceLayerName,
            timestamp: Date.now()
        };

        const request = store.put(storageData);

        request.onsuccess = function() {
            console.log('分析结果图层已保存到IndexedDB:', analysisLayerInfo.name);
            resolve();
        };

        request.onerror = function(event) {
            console.error('保存分析结果图层失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 从IndexedDB加载所有分析结果图层数据
 * @returns {Promise<Array>}
 */
async function loadAllAnalysisLayersFromStorage() {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([ANALYSIS_STORE_NAME], 'readonly');
        const store = transaction.objectStore(ANALYSIS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = function(event) {
            const layers = event.target.result;
            console.log('从IndexedDB加载了', layers.length, '个分析结果图层');
            resolve(layers);
        };

        request.onerror = function(event) {
            console.error('加载分析结果图层失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 从IndexedDB删除指定分析结果图层
 * @param {string} layerId - 图层ID
 * @returns {Promise<void>}
 */
async function removeAnalysisLayerFromStorage(layerId) {
    if (!layerDB) {
        await initLayerStorage();
    }

    return new Promise((resolve, reject) => {
        const transaction = layerDB.transaction([ANALYSIS_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(ANALYSIS_STORE_NAME);
        const request = store.delete(layerId);

        request.onsuccess = function() {
            console.log('分析结果图层已从IndexedDB删除:', layerId);
            resolve();
        };

        request.onerror = function(event) {
            console.error('删除分析结果图层失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 恢复单个分析结果图层到地图
 * @param {Object} storedAnalysisLayer - 存储的分析结果图层数据
 */
async function restoreSingleAnalysisLayer(storedAnalysisLayer) {
    try {
        const geoJsonFormat = new ol.format.GeoJSON();

        // 创建数据源
        const source = new ol.source.Vector();

        // 重建results Map
        const results = new Map(storedAnalysisLayer.results);

        // 添加要素并应用颜色
        storedAnalysisLayer.features.forEach((feature, index) => {
            const olFeature = geoJsonFormat.readFeature(feature, {
                dataProjection: 'EPSG:4326',
                featureProjection: map.getView().getProjection()
            });

            const value = results.get(index);
            const color = valueToColor(
                value, 
                storedAnalysisLayer.minValue, 
                storedAnalysisLayer.maxValue,
                storedAnalysisLayer.sortedValues
            );

            // 设置属性
            olFeature.set('connectivity', storedAnalysisLayer.analysisType === 'connectivity' ? value : undefined);
            olFeature.set('integration', storedAnalysisLayer.analysisType === 'integration' ? value : undefined);
            olFeature.set('originalFeature', feature);

            // 设置样式
            olFeature.setStyle(new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 3
                })
            }));

            source.addFeature(olFeature);
        });

        // 创建图层
        const layer = new ol.layer.Vector({
            source: source,
            name: storedAnalysisLayer.id
        });

        map.addLayer(layer);

        // 构建图层信息对象
        const layerInfo = {
            id: storedAnalysisLayer.id,
            name: storedAnalysisLayer.name,
            layer: layer,
            source: source,
            features: storedAnalysisLayer.features,
            analysisType: storedAnalysisLayer.analysisType,
            results: results,
            minValue: storedAnalysisLayer.minValue,
            maxValue: storedAnalysisLayer.maxValue,
            sortedValues: storedAnalysisLayer.sortedValues,
            sourceLayerName: storedAnalysisLayer.sourceLayerName
        };

        // 添加到分析结果图层数组
        analysisResultLayers.push(layerInfo);

        console.log('已恢复分析结果图层:', storedAnalysisLayer.name);

    } catch (error) {
        console.error('恢复单个分析结果图层失败:', storedAnalysisLayer.id, error);
    }
}
