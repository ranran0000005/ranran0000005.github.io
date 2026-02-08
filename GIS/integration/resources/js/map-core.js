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
 * 初始化 OpenLayers 地图
 */
function initOpenLayersMap() {
    // 定义百度地图投影 (BD-09 Mercator)
    proj4.defs('BD-09', '+proj=merc +a=6378206 +b=6356584.314245179 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs');
    ol.proj.proj4.register(proj4);
    const baiduProjection = ol.proj.get('BD-09');

    const resolutions = [];
    for (let i = 0; i <= 18; i++) {
        resolutions[i] = Math.pow(2, 18 - i);
    }

    const baiduTileGrid = new ol.tilegrid.TileGrid({
        origin: [0, 0],
        resolutions: resolutions,
        tileSize: 256
    });

    // 创建百度地图源 - 由于百度 HTTPS 证书问题，提供多个备选方案
    let baiduSource;
    
    // 尝试使用不同的百度地图服务器
    const baiduServers = ['online0', 'online1', 'online2', 'online3'];
    const randomServer = baiduServers[Math.floor(Math.random() * baiduServers.length)];
    
    baiduSource = new ol.source.XYZ({
        projection: baiduProjection,
        tileGrid: baiduTileGrid,
        tileUrlFunction: function(tileCoord) {
            if (!tileCoord) return '';
            const z = tileCoord[0];
            const x = tileCoord[1];
            const y = -tileCoord[2] - 1;
            // 使用随机服务器以分散负载，并使用 HTTP（在 HTTPS 环境下可能被阻止，但作为备选）
            return `http://${randomServer}.map.bdimg.com/onlinelabel/?qt=tile&x=${x}&y=${y}&z=${z}&styles=pl&scaler=1&p=1`;
        },
        attributions: '&copy; 百度地图'
    });

    baiduLayer = new ol.layer.Tile({ source: baiduSource });

    // 创建视图
    const view = new ol.View({
        projection: baiduProjection,
        center: ol.proj.fromLonLat([104.299, 31.769], baiduProjection),
        zoom: 5,
        maxZoom: 18
    });

    // 创建标注数据源和图层
    markersSource = new ol.source.Vector();
    markersLayer = new ol.layer.Vector({
        source: markersSource,
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

    // 创建地图（不添加默认控件，手动添加）
    map = new ol.Map({
        target: 'container',
        layers: [baiduLayer, markersLayer],
        view: view,
        controls: [] // 先不添加任何控件
    });
    
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

    // 添加缩放控件，放在右上角
    map.addControl(new ol.control.Zoom({
        position: 'top-right'
    }));

    // 添加比例尺控件，放在左下角，配置单位以确保图形正确显示
    map.addControl(new ol.control.ScaleLine({
        units: 'metric', // 使用公制单位（米、千米）
        position: 'bottom-left',
        minWidth: 64, // 最小宽度，避免过长
        maxWidth: 200 // 最大宽度，保持美观
    }));

    // 错误处理
    baiduSource.on('tileloaderror', (evt) => { 
        console.error('Baidu tile load error', evt); 
    });

    // 隐藏加载提示
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }

    console.log('OpenLayers 地图初始化成功');
}

