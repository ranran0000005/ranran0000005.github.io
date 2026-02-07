/**
 * 主入口文件
 * 页面加载完成后初始化地图和相关功能
 */

// 页面加载完成后初始化地图
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
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
});

