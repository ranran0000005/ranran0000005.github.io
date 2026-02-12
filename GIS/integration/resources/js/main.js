/**
 * 主入口文件
 * 页面加载完成后初始化地图和相关功能
 */

// 页面加载完成后初始化地图
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    // 尝试初始化 WebGPU（如果可用）
    if (typeof initWebGPU === 'function') {
        initWebGPU().then((supported) => {
            if (supported) {
                console.log('✓ WebGPU 加速已启用');
            } else {
                console.log('WebGPU 不可用，将使用 WASM 或 JavaScript 实现');
            }
        }).catch(err => {
            console.warn('WebGPU 初始化失败:', err);
        });
    }
    
    // 尝试初始化 WASM 模块（如果可用）
    if (typeof initWasmModule === 'function') {
        initWasmModule().then(() => {
            console.log('✓ WASM 加速已启用');
        }).catch(err => {
            console.warn('WASM 初始化失败，将使用 JavaScript 回退实现:', err);
            useWasmAcceleration = false;
        });
    } else {
        console.log('WASM 模块不可用，使用 JavaScript 实现');
        useWasmAcceleration = false;
    }
    
    // Note: GeoServer integration is optional
    // Users can upload local shapefiles instead
    console.log('应用已就绪 - 可以上传本地 Shapefile 进行分析');

    // 从IndexedDB恢复之前保存的图层数据
    if (isIndexedDBSupported()) {
        // 延迟一点执行，确保地图完全初始化
        setTimeout(() => {
            restoreLayersFromStorage().catch(err => {
                console.warn('恢复图层数据失败:', err);
            });
        }, 500);
    } else {
        console.log('浏览器不支持IndexedDB，图层数据将不会持久化保存');
    }

    // 初始化本地标注系统
    setTimeout(() => {
        if (typeof initLocalMarkers === 'function') {
            initLocalMarkers();
        }
    }, 600);
});

