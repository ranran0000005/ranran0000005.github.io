/**
 * 全局配置和变量
 */

// 地图相关全局变量
var map;
var baiduLayer;
var wmsLayers = {}; // 存储所有WMS图层，key为图层名称

// 标注相关变量
var markersLayer; // 标注图层
var markersSource; // 标注数据源
var markersVector = {}; // 存储所有标注的矢量要素，key为标注ID
var isLocalMarkerMode = false; // 是否处于本地标注添加模式

// 弹窗管理变量（在utils.js中定义，这里声明以避免重复）
var currentPopup = null;
var popupTimer = null;

// 初始化标志
var mapInitialized = false; // 地图是否已初始化

// GeoServer 配置
var geoserverConfig = {
    // 默认使用本地WMS测试服务器
    url: 'http://localhost:3001',
    workspace: 'test', // 测试服务器的工作空间
    // 备用列表（当无法连接服务器时使用）
    fallbackLayers: [
        { workspace: 'test', name: 'test_polygon', displayName: '测试多边形' },
        { workspace: 'test', name: 'test_line', displayName: '测试线' },
        { workspace: 'test', name: 'china_boundary', displayName: '中国边界测试' }
    ]
};

// 加载GeoServer配置
function loadGeoServerConfig() {
    try {
        const saved = localStorage.getItem('geoserverConfig');
        if (saved) {
            const config = JSON.parse(saved);
            geoserverConfig.url = config.url || geoserverConfig.url;
            geoserverConfig.workspace = config.workspace || '';
            if (config.fallbackLayers) {
                geoserverConfig.fallbackLayers = config.fallbackLayers;
            }
        }
    } catch (e) {
        console.warn('无法加载GeoServer配置:', e);
    }
}

// 保存GeoServer配置
function saveGeoServerConfig(config) {
    try {
        geoserverConfig.url = config.url || geoserverConfig.url;
        geoserverConfig.workspace = config.workspace || '';
        if (config.fallbackLayers) {
            geoserverConfig.fallbackLayers = config.fallbackLayers;
        }
        localStorage.setItem('geoserverConfig', JSON.stringify(geoserverConfig));
    } catch (e) {
        console.warn('无法保存GeoServer配置:', e);
    }
}

// 页面加载时恢复配置
loadGeoServerConfig();

// 预定义的 GeoServer 图层列表（作为备用，如果自动获取失败则使用此列表）
const availableLayers = geoserverConfig.fallbackLayers || [];

// 从 GeoServer 获取的图层列表
var fetchedLayers = []; // 存储从 GeoServer 获取的图层列表

// 本地Shapefile图层管理
var localShapefileLayers = []; // 存储所有本地导入的Shapefile图层
var localShapefileLayerCounter = 0; // 图层计数器，用于生成唯一ID

// 空间分析结果图层管理
var analysisResultLayers = []; // 存储所有分析结果图层
var analysisResultLayerCounter = 0; // 分析图层计数器

// WASM 多线程配置
var wasmThreadCount = Math.min(Math.max(1, navigator.hardwareConcurrency || 4), 8); // 默认值：CPU核心数，最大8

// 保存/加载线程数配置
function saveThreadCount(count) {
    try {
        localStorage.setItem('wasmThreadCount', count);
        wasmThreadCount = count;
    } catch (e) {
        console.warn('无法保存线程数配置:', e);
    }
}

function loadThreadCount() {
    try {
        const saved = localStorage.getItem('wasmThreadCount');
        if (saved) {
            const count = parseInt(saved, 10);
            if (count >= 1 && count <= 16) {
                wasmThreadCount = count;
            }
        }
    } catch (e) {
        console.warn('无法加载线程数配置:', e);
    }
}

// 页面加载时恢复配置
loadThreadCount();

