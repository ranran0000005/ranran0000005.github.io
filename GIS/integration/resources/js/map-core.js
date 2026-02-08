/**
 * 地图核心初始化
 */

/**
 * GIS地图初始化和显示
 */
function initMap() {
    // 防止重复初始化
    if (mapInitialized) {
        console.warn('地图已经初始化，跳过重复初始化');
        return;
    }
    
    console.log('初始化GIS地图...');
    
    // 初始化 OpenLayers 地图
    initOpenLayersMap();
    
    mapInitialized = true;
    console.log('GIS地图初始化完成');
}

/**
 * 初始化 OpenLayers 地图 - 使用高德地图
 */
function initOpenLayersMap() {
    // 使用 Web Mercator 投影 (EPSG:3857) - 高德地图使用标准 Web Mercator
    const projection = ol.proj.get('EPSG:3857');

    // 创建高德地图源（HTTPS支持，多服务器负载均衡）
    const amapSource = new ol.source.XYZ({
        url: 'https://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        attributions: '&copy; <a href="https://www.amap.com/">高德地图</a>',
        crossOrigin: 'anonymous',
        maxZoom: 18
    });

    const amapLayer = new ol.layer.Tile({ 
        source: amapSource,
        name: 'amap-base'
    });

    // 保存到全局变量（用于兼容旧代码中使用 baiduLayer 的部分）
    baiduLayer = amapLayer;

    // 创建视图 - 使用 Web Mercator 坐标系
    const view = new ol.View({
        projection: projection,
        center: ol.proj.fromLonLat([117.2, 31.8]), // 合肥市中心 (WGS84 转 Web Mercator)
        zoom: 10,
        minZoom: 3,
        maxZoom: 18
    });

    // 创建标注数据源和图层
    markersSource = new ol.source.Vector();
    markersLayer = new ol.layer.Vector({
        source: markersSource,
        name: 'markers',
        style: new ol.style.Style({
            image: new ol.style.Icon({
                anchor: [0.5, 1],
                src: 'data:image/svg+xml;base64,' + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
                        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 32 16 32s16-20.5 16-32C32 7.163 24.837 0 16 0z" fill="#FF0000" stroke="#FFFFFF" stroke-width="2"/>
                        <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
                    </svg>
                `),
                scale: 1
            })
        })
    });

    // 创建地图
    map = new ol.Map({
        target: 'container',
        layers: [amapLayer, markersLayer],
        view: view,
        controls: ol.control.defaults({
            attribution: true,
            zoom: true,
            rotate: false
        })
    });

    // 添加鼠标位置控件（显示经纬度）
    map.addControl(new ol.control.MousePosition({
        coordinateFormat: function(coord) {
            const lonLat = ol.proj.toLonLat(coord);
            return `经度: ${lonLat[0].toFixed(6)}, 纬度: ${lonLat[1].toFixed(6)}`;
        },
        projection: projection,
        className: 'custom-mouse-position',
        undefinedHTML: '&nbsp;'
    }));

    // 添加比例尺控件
    map.addControl(new ol.control.ScaleLine({
        units: 'metric',
        position: 'bottom-left',
        minWidth: 64,
        maxWidth: 200
    }));

    // 添加地图点击事件（用于添加标注）
    map.on('click', function(event) {
        if (isAddingMarker) {
            addMarkerAtCoordinate(event.coordinate);
        }
    });
    
    // 添加标注点击事件（显示标注信息）
    // 使用防抖机制避免重复触发
    let clickTimeout = null;
    map.on('singleclick', function(event) {
        if (!isAddingMarker) {
            // 清除之前的定时器
            if (clickTimeout) {
                clearTimeout(clickTimeout);
            }
            
            // 延迟执行，避免快速点击导致重复弹窗
            clickTimeout = setTimeout(function() {
                // 检查是否点击到了标注要素
                const feature = map.forEachFeatureAtPixel(event.pixel, function(feature) {
                    // 只处理标注要素（有id属性的）
                    if (feature && feature.get('id')) {
                        return feature;
                    }
                    return null;
                });
                
                // 如果点击到了标注，显示信息（只显示一次）
                if (feature && feature.get('id')) {
                    // 再次检查是否已有弹窗，避免重复
                    if (!currentPopup || !document.body.contains(currentPopup)) {
                        showMarkerInfo(feature);
                    }
                }
                clickTimeout = null;
            }, 100); // 100ms防抖
        }
    });

    // 错误处理
    amapSource.on('tileloaderror', (evt) => { 
        console.error('Amap tile load error', evt); 
    });

    // 隐藏加载提示
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }

    console.log('OpenLayers 地图初始化成功 - 使用高德地图');
}
