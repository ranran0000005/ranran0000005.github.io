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
var isAddingMarker = false; // 是否处于添加标注模式

// 弹窗管理变量（在utils.js中定义，这里声明以避免重复）
var currentPopup = null;
var popupTimer = null;

// 初始化标志
var mapInitialized = false; // 地图是否已初始化

// 预定义的 GeoServer 图层列表（作为备用，如果自动获取失败则使用此列表）
const availableLayers = [
    { workspace: 'WebGIS', name: 'China_boundary', displayName: '中国边界' },
    { workspace: 'WebGIS', name: 'Hefei_PSEUDO_COLOR', displayName: '合肥伪彩色栅格' },
];

// 从 GeoServer 获取的图层列表
var fetchedLayers = []; // 存储从 GeoServer 获取的图层列表

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

