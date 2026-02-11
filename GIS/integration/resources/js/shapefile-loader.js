/**
 * Shapefile Loader
 * Client-side shapefile parsing using shpjs library (better projection support)
 */

/**
 * 将值映射到颜色（蓝到红）- 本地副本，用于shapefile导入时的自动可视化
 * 使用分位数缩放确保颜色均匀分布
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @param {Array<number>} sortedValues - 排序后的所有值数组（用于分位数计算）
 * @returns {string} RGB颜色字符串
 */
function valueToColorLocal(value, min, max, sortedValues) {
    if (max === min) return 'rgb(0, 0, 255)'; // 蓝色
    
    // 使用分位数缩放：根据值在排序数组中的位置来归一化
    let normalized;
    if (sortedValues && sortedValues.length > 0) {
        // 找到当前值在排序数组中的位置（分位数）
        let position = sortedValues.findIndex(v => v >= value);
        if (position === -1) position = sortedValues.length - 1;
        normalized = position / (sortedValues.length - 1);
    } else {
        // 回退到线性归一化
        normalized = (value - min) / (max - min);
    }
    
    // 蓝到红渐变
    // 蓝色 (0, 0, 255) -> 青色 (0, 255, 255) -> 黄色 (255, 255, 0) -> 红色 (255, 0, 0)
    let r, g, b;
    
    if (normalized < 0.33) {
        // 蓝到青
        const t = normalized / 0.33;
        r = 0;
        g = Math.floor(255 * t);
        b = 255;
    } else if (normalized < 0.67) {
        // 青到黄
        const t = (normalized - 0.33) / 0.34;
        r = Math.floor(255 * t);
        g = 255;
        b = Math.floor(255 * (1 - t));
    } else {
        // 黄到红
        const t = (normalized - 0.67) / 0.33;
        r = 255;
        g = Math.floor(255 * (1 - t));
        b = 0;
    }
    
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 检测要素是否包含分析结果字段
 * @param {Array} features - GeoJSON features数组
 * @returns {Object|null} 返回{type: 'connectivity'|'integration', field: '字段名'}或null
 */
function checkForAnalysisFields(features) {
    if (!features || features.length === 0) return null;
    
    // 检查第一个要素的属性
    const firstFeature = features[0];
    if (!firstFeature.properties) return null;
    
    const props = firstFeature.properties;
    
    // 检查是否有CONNECT字段（导出时的字段名）
    if (props.hasOwnProperty('CONNECT') || props.hasOwnProperty('connect')) {
        const field = props.hasOwnProperty('CONNECT') ? 'CONNECT' : 'connect';
        // 检查是否有有效值（非空）
        const value = parseFloat(props[field]);
        if (!isNaN(value) && value !== 0) {
            console.log('检测到连接度字段:', field);
            return { type: 'connectivity', field: field };
        }
    }
    
    // 检查是否有INTEGRATE字段（导出时的字段名）
    if (props.hasOwnProperty('INTEGRATE') || props.hasOwnProperty('integrate')) {
        const field = props.hasOwnProperty('INTEGRATE') ? 'INTEGRATE' : 'integrate';
        // 检查是否有有效值（非空）
        const value = parseFloat(props[field]);
        if (!isNaN(value) && value !== 0) {
            console.log('检测到整合度字段:', field);
            return { type: 'integration', field: field };
        }
    }
    
    // 兼容旧字段名（connectivity/integration）
    if (props.hasOwnProperty('connectivi') || props.hasOwnProperty('connectivity')) {
        const field = props.hasOwnProperty('connectivi') ? 'connectivi' : 'connectivity';
        console.log('检测到连接度字段(旧):', field);
        return { type: 'connectivity', field: field };
    }
    
    if (props.hasOwnProperty('integratio') || props.hasOwnProperty('integration')) {
        const field = props.hasOwnProperty('integratio') ? 'integratio' : 'integration';
        console.log('检测到整合度字段(旧):', field);
        return { type: 'integration', field: field };
    }
    
    return null;
}

/**
 * 从导入的shapefile创建分析结果图层
 * @param {Array} features - GeoJSON features数组
 * @param {Object} analysisInfo - 分析信息 {type, field}
 * @param {string} fileName - 文件名
 */
async function createAnalysisLayerFromImport(features, analysisInfo, fileName) {
    try {
        // 从属性中提取分析结果值
        const results = new Map();
        const values = [];
        
        features.forEach((feature, index) => {
            const value = parseFloat(feature.properties[analysisInfo.field]);
            if (!isNaN(value)) {
                results.set(index, value);
                values.push(value);
            }
        });
        
        if (values.length === 0) {
            console.warn('未找到有效的分析结果值');
            return;
        }
        
        // 计算最小值和最大值
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const sortedValues = values.slice().sort((a, b) => a - b);
        
        console.log(`${analysisInfo.type}值范围: ${minValue} - ${maxValue}`);
        
        // 生成唯一的分析图层ID
        analysisResultLayerCounter++;
        const analysisLayerId = 'analysisResult_' + analysisResultLayerCounter;
        
        // 创建数据源
        const source = new ol.source.Vector();
        const geoJsonFormat = new ol.format.GeoJSON();
        
        // 添加要素并应用颜色
        features.forEach((feature, index) => {
            const value = results.get(index);
            if (value === undefined) return;
            
            const color = valueToColorLocal(value, minValue, maxValue, sortedValues);
            
            try {
                const olFeature = geoJsonFormat.readFeature(feature, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: map.getView().getProjection()
                });
                
                // 设置属性
                olFeature.set('connectivity', analysisInfo.type === 'connectivity' ? value : undefined);
                olFeature.set('integration', analysisInfo.type === 'integration' ? value : undefined);
                olFeature.set('originalFeature', feature);
                
                // 设置样式
                olFeature.setStyle(new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 3
                    })
                }));
                
                source.addFeature(olFeature);
            } catch (error) {
                console.warn('处理要素失败:', index, error);
            }
        });
        
        // 创建图层
        const layer = new ol.layer.Vector({
            source: source,
            name: analysisLayerId
        });
        
        map.addLayer(layer);
        
        // 构建图层信息对象
        const analysisLayerInfo = {
            id: analysisLayerId,
            name: `${fileName} - ${analysisInfo.type === 'connectivity' ? '连接度' : '整合度'}`,
            layer: layer,
            source: source,
            features: features,
            analysisType: analysisInfo.type,
            results: results,
            minValue: minValue,
            maxValue: maxValue,
            sortedValues: sortedValues,
            sourceLayerName: fileName,
            timestamp: Date.now()
        };
        
        analysisResultLayers.push(analysisLayerInfo);
        
        // 保存到IndexedDB
        if (typeof saveAnalysisLayerToStorage === 'function') {
            try {
                await saveAnalysisLayerToStorage(analysisLayerInfo);
            } catch (error) {
                console.warn('保存分析结果图层到IndexedDB失败:', error);
            }
        }
        
        // 更新图层列表UI
        updateLocalShapefileLayerList();
        
        console.log('已从导入数据创建分析结果图层:', analysisLayerInfo.name);
        
    } catch (error) {
        console.error('创建分析结果图层失败:', error);
    }
}

/**
 * Load shapefile from file input
 * @param {File} shpFile - .shp file
 * @param {File} dbfFile - .dbf file (optional)
 * @param {File} shxFile - .shx file (optional)
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function loadShapefileFromFiles(shpFile, dbfFile = null, shxFile = null) {
    try {
        console.log('开始解析 Shapefile...');
        
        // shpjs requires a Buffer or ArrayBuffer
        const shpBuffer = await readFileAsArrayBuffer(shpFile);
        
        // shpjs can parse .shp directly (it will look for companion files if provided)
        const geojson = await shp(shpBuffer);
        
        console.log('Shapefile 解析成功，共', geojson.features ? geojson.features.length : 0, '个要素');
        return geojson;
    } catch (error) {
        console.error('Shapefile 解析失败:', error);
        throw error;
    }
}

/**
 * Load shapefile from ZIP file
 * @param {File} zipFile - .zip file containing shapefile components
 * @returns {Promise<Object>} GeoJSON FeatureCollection with CRS info
 */
async function loadShapefileFromZip(zipFile) {
    try {
        console.log('正在解压 ZIP 文件...');
        
        const zipBuffer = await readFileAsArrayBuffer(zipFile);
        
        // shpjs has built-in support for ZIP files and automatically handles .prj files
        const geojson = await shp(zipBuffer);
        
        console.log('Shapefile 解析成功');
        
        // shpjs returns FeatureCollection or array of FeatureCollections
        // If it's an array, merge them
        if (Array.isArray(geojson)) {
            console.log('检测到', geojson.length, '个图层');
            // Use first layer or merge all layers
            const mergedFeatures = [];
            geojson.forEach(layer => {
                if (layer.features) {
                    mergedFeatures.push(...layer.features);
                }
            });
            const result = {
                type: 'FeatureCollection',
                features: mergedFeatures
            };
            console.log('合并后共', result.features.length, '个要素');
            return result;
        }
        
        console.log('共', geojson.features.length, '个要素');
        return geojson;
    } catch (error) {
        console.error('ZIP 文件解析失败:', error);
        throw error;
    }
}

/**
 * Read file as ArrayBuffer
 * @param {File} file - File object
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Show file upload dialog for shapefile
 */
function showShapefileUploadDialog() {
    // Close any existing popup
    if (currentPopup && document.body.contains(currentPopup)) {
        document.body.removeChild(currentPopup);
        currentPopup = null;
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'popup-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10001;
        min-width: 400px;
        max-width: 90%;
    `;
    
    dialog.innerHTML = `
        <h3 style="margin-top: 0; color: #333; font-size: 20px;">上传 Shapefile</h3>
        
        <div style="margin: 20px 0;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                选择方式 1：上传 ZIP 文件（推荐）
            </p>
            <input type="file" id="shapefileZipInput" accept=".zip" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        
        <div style="margin: 20px 0; padding-top: 15px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                选择方式 2：分别上传文件
            </p>
            <label style="display: block; margin-bottom: 10px;">
                <span style="display: inline-block; width: 80px;">SHP 文件:</span>
                <input type="file" id="shapefileShpInput" accept=".shp" style="width: calc(100% - 85px);">
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <span style="display: inline-block; width: 80px;">DBF 文件:</span>
                <input type="file" id="shapefileDbfInput" accept=".dbf" style="width: calc(100% - 85px);">
                <span style="font-size: 12px; color: #999;">(可选)</span>
            </label>
        </div>
        
        <div style="margin: 20px 0; padding-top: 15px; border-top: 1px solid #eee;">
            <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="shapefileSegmentMode" style="margin-right: 10px; width: 18px; height: 18px;">
                <div>
                    <strong style="color: #333;">段分析模式</strong>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        将每条线的多个顶点拆分为独立的段进行分析<br>
                        （适用于精细化的空间句法分析）
                    </div>
                </div>
            </label>
        </div>
        
        <div style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 10px;">
            <button id="shapefileUploadCancel" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
            <button id="shapefileUploadLoad" style="padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer;">加载</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    currentPopup = dialog;
    
    // Bind events
    document.getElementById('shapefileUploadCancel').onclick = function() {
        if (dialog && document.body.contains(dialog)) {
            document.body.removeChild(dialog);
            currentPopup = null;
        }
    };
    
    document.getElementById('shapefileUploadLoad').onclick = async function() {
        const zipInput = document.getElementById('shapefileZipInput');
        const shpInput = document.getElementById('shapefileShpInput');
        const dbfInput = document.getElementById('shapefileDbfInput');
        const segmentMode = document.getElementById('shapefileSegmentMode').checked;

        try {
            let geojson;
            let fileName;

            if (zipInput.files.length > 0) {
                // Load from ZIP
                fileName = zipInput.files[0].name;
                geojson = await loadShapefileFromZip(zipInput.files[0]);
            } else if (shpInput.files.length > 0) {
                // Load from individual files
                fileName = shpInput.files[0].name;
                const shpFile = shpInput.files[0];
                const dbfFile = dbfInput.files.length > 0 ? dbfInput.files[0] : null;
                geojson = await loadShapefileFromFiles(shpFile, dbfFile);
            } else {
                showPopup('请选择文件');
                return;
            }

            // Close dialog
            if (dialog && document.body.contains(dialog)) {
                document.body.removeChild(dialog);
                currentPopup = null;
            }

            // Load shapefile data with segment mode option and file name
            await loadLocalShapefile(geojson, segmentMode, fileName);

        } catch (error) {
            console.error('加载失败:', error);
            showPopup('加载失败: ' + error.message);
        }
    };
}

/**
 * Load local shapefile data and display on map
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {boolean} splitToSegments - Whether to split lines into segments
 * @param {string} fileName - Original file name for display
 */
async function loadLocalShapefile(geojson, splitToSegments = false, fileName = '未命名') {
    try {
        console.log('正在加载本地 Shapefile 数据...');

        // Generate unique layer ID
        localShapefileLayerCounter++;
        const layerId = 'localShapefile_' + localShapefileLayerCounter;

        // Store original features
        const originalFeatures = geojson.features;

        // Optionally split to segments
        let displayFeatures = originalFeatures;
        if (splitToSegments) {
            displayFeatures = convertFeaturesToSegments(originalFeatures);
            console.log(`段模式: ${originalFeatures.length} 条线 → ${displayFeatures.length} 个段`);
        }

        // Detect coordinate system from .prj file
        let sourceProjection = 'EPSG:4326'; // Default to WGS84
        if (geojson.crs && geojson.crs.wkt) {
            const detectedProj = detectProjectionFromWKT(geojson.crs.wkt);
            if (detectedProj) {
                sourceProjection = detectedProj;
                console.log('检测到坐标系:', sourceProjection);
            } else {
                console.warn('无法识别坐标系，使用默认 EPSG:4326');
                showPopup('警告：无法识别坐标系，默认作为WGS84处理。若显示位置不正确，请检查数据投影。');
            }
        }

        // Create vector source and layer
        const source = new ol.source.Vector();
        const geoJsonFormat = new ol.format.GeoJSON();

        // Add features to map with proper projection
        displayFeatures.forEach((feature, index) => {
            try {
                const olFeature = geoJsonFormat.readFeature(feature, {
                    dataProjection: sourceProjection,
                    featureProjection: map.getView().getProjection()
                });

                // Set style
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
            } catch (error) {
                if (index === 0) {
                    console.error('要素转换失败:', error);
                    throw new Error('坐标转换失败，可能是不支持的坐标系统');
                }
            }
        });

        // Create layer with unique name
        const layer = new ol.layer.Vector({
            source: source,
            name: layerId
        });

        map.addLayer(layer);

        // Store layer info
        const layerInfo = {
            id: layerId,
            name: fileName.replace(/\.[^/.]+$/, '') || '图层 ' + localShapefileLayerCounter,
            layer: layer,
            source: source,
            features: displayFeatures,
            originalFeatures: originalFeatures,
            segmentMode: splitToSegments,
            featureCount: displayFeatures.length,
            sourceProjection: sourceProjection
        };
        localShapefileLayers.push(layerInfo);

        // Save to IndexedDB for persistence
        if (isIndexedDBSupported()) {
            saveLayerToStorage(layerInfo).catch(err => {
                console.warn('保存图层到IndexedDB失败:', err);
            });
        }

        // Zoom to layer extent
        const extent = source.getExtent();
        if (extent && !ol.extent.isEmpty(extent)) {
            map.getView().fit(extent, {
                padding: [50, 50, 50, 50],
                duration: 1000
            });
        }

        // Cache data for spatial analysis (use the latest layer)
        spatialFeaturesCache = displayFeatures;
        spatialAdjacency = null; // Reset adjacency cache

        // Store original features and mode
        window._originalFeatures = originalFeatures;
        window._segmentMode = splitToSegments;
        
        // 检测是否包含分析结果字段(connectivity或integration)
        const hasAnalysisFields = checkForAnalysisFields(displayFeatures);
        if (hasAnalysisFields) {
            console.log('检测到分析结果字段，自动创建分析结果图层...');
            await createAnalysisLayerFromImport(displayFeatures, hasAnalysisFields, fileName);
        }

        const modeText = splitToSegments ? '（段模式）' : '（线模式）';
        const projText = sourceProjection !== 'EPSG:4326' ? ` [${sourceProjection}]` : '';
        const analysisText = hasAnalysisFields ? ` [包含${hasAnalysisFields.type}分析结果]` : '';
        showPopup(`成功加载 "${layerInfo.name}"，共 ${displayFeatures.length} 个要素${modeText}${projText}${analysisText}`);
        console.log('本地 Shapefile 加载完成:', layerInfo.name);

        // Update layer list UI
        updateLocalShapefileLayerList();

        // Auto close popup after 2 seconds
        setTimeout(() => {
            if (currentPopup && document.body.contains(currentPopup)) {
                document.body.removeChild(currentPopup);
                currentPopup = null;
            }
            if (popupTimer) {
                clearTimeout(popupTimer);
                popupTimer = null;
            }
        }, 2000);

    } catch (error) {
        console.error('加载本地 Shapefile 失败:', error);
        showPopup('加载失败: ' + error.message);
    }
}

/**
 * Detect projection from WKT string
 * @param {string} wkt - Well-Known Text projection string
 * @returns {string|null} EPSG code or custom projection string
 */
function detectProjectionFromWKT(wkt) {
    console.log('WKT投影定义:', wkt.substring(0, 300));

    // Check for Lambert Conformal Conic (China)
    if (/Lambert_Conformal_Conic/i.test(wkt) || /China.*Lambert/i.test(wkt)) {
        // Register China Lambert Conformal Conic projection
        const projName = 'CHINA_LCC';
        if (!proj4.defs(projName)) {
            // Standard China Lambert Conformal Conic parameters
            proj4.defs(projName, '+proj=lcc +lat_1=25 +lat_2=47 +lat_0=0 +lon_0=105 +x_0=0 +y_0=0 +ellps=krass +units=m +no_defs');
            console.log('已注册中国Lambert投影定义');
        }
        return projName;
    }

    // Common projections for China
    const projectionPatterns = [
        { pattern: /GCS_China_Geodetic_Coordinate_System_2000/i, epsg: 'EPSG:4490', name: 'CGCS2000' },
        { pattern: /CGCS_2000/i, epsg: 'EPSG:4490', name: 'CGCS2000' },
        { pattern: /Xian_1980/i, epsg: 'EPSG:2333', name: 'Xian 1980' },
        { pattern: /Beijing_1954/i, epsg: 'EPSG:2422', name: 'Beijing 1954' },
        { pattern: /GCS_WGS_1984/i, epsg: 'EPSG:4326', name: 'WGS84' },
        { pattern: /WGS[_\s]84/i, epsg: 'EPSG:4326', name: 'WGS84' }
    ];

    for (const proj of projectionPatterns) {
        if (proj.pattern.test(wkt)) {
            console.log(`识别到投影系统: ${proj.name} (${proj.epsg})`);
            
            // Register projection definition if not already defined
            if (proj.epsg === 'EPSG:4490' && !proj4.defs(proj.epsg)) {
                // CGCS2000 definition (similar to WGS84 but uses GRS80 ellipsoid)
                proj4.defs(proj.epsg, '+proj=longlat +ellps=GRS80 +no_defs');
                console.log('已注册 CGCS2000 投影定义');
            }
            
            return proj.epsg;
        }
    }

    // Try to extract EPSG code directly from WKT
    const epsgMatch = wkt.match(/EPSG[",\s]+(\d+)/i);
    if (epsgMatch) {
        const epsgCode = 'EPSG:' + epsgMatch[1];
        console.log('从WKT提取到EPSG代码:', epsgCode);
        return epsgCode;
    }

    console.warn('无法从WKT识别投影系统');
    return null;
}

/**
 * Update the local shapefile layer list UI
 */
function updateLocalShapefileLayerList() {
    // Remove existing layer list if any
    const existingList = document.getElementById('localShapefileLayerList');
    if (existingList) {
        existingList.remove();
    }

    const totalLayerCount = localShapefileLayers.length + analysisResultLayers.length;
    if (totalLayerCount === 0) {
        return;
    }

    // Check if panel is collapsed (store in window variable)
    if (typeof window.localShapefileLayerListCollapsed === 'undefined') {
        window.localShapefileLayerListCollapsed = false;
    }

    // Create layer list container
    const listContainer = document.createElement('div');
    listContainer.id = 'localShapefileLayerList';
    listContainer.style.cssText = `
        position: fixed;
        top: 80px;
        left: 10px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        padding: 12px;
        z-index: 1000;
        min-width: 220px;
        max-width: 340px;
        transition: all 0.3s ease;
    `;

    // Header with collapse button
    const header = document.createElement('div');
    header.style.cssText = `
        font-weight: bold;
        padding-bottom: 10px;
        border-bottom: ${window.localShapefileLayerListCollapsed ? 'none' : '1px solid #eee'};
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
    `;
    header.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">图层列表 (${totalLayerCount})</span>
        </span>
        <div style="display: flex; gap: 5px; align-items: center;">
            <button onclick="event.stopPropagation(); clearAllLayers()" style="
                background: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
            ">全部清除</button>
            <span id="layerListToggleIcon" style="
                display: inline-block;
                width: 20px;
                height: 20px;
                text-align: center;
                line-height: 20px;
                font-size: 12px;
                color: #666;
                transition: transform 0.3s ease;
                transform: ${window.localShapefileLayerListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
            ">▼</span>
        </div>
    `;
    header.onclick = function() {
        window.localShapefileLayerListCollapsed = !window.localShapefileLayerListCollapsed;
        updateLocalShapefileLayerList();
    };
    listContainer.appendChild(header);

    // Layer items (only show if not collapsed)
    if (!window.localShapefileLayerListCollapsed) {
        const itemsContainer = document.createElement('div');
        itemsContainer.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
            margin-top: 10px;
        `;

        // 显示本地Shapefile图层
        if (localShapefileLayers.length > 0) {
            const dataHeader = document.createElement('div');
            dataHeader.style.cssText = `
                font-size: 12px;
                color: #666;
                padding: 5px 0;
                border-bottom: 1px dashed #ddd;
                margin-bottom: 5px;
            `;
            dataHeader.textContent = '数据图层';
            itemsContainer.appendChild(dataHeader);

            localShapefileLayers.forEach((layerInfo, index) => {
                const item = createLayerListItem(layerInfo, index + 1, 'data');
                itemsContainer.appendChild(item);
            });
        }

        // 显示分析结果图层
        if (analysisResultLayers.length > 0) {
            const analysisHeader = document.createElement('div');
            analysisHeader.style.cssText = `
                font-size: 12px;
                color: #666;
                padding: 5px 0;
                border-bottom: 1px dashed #ddd;
                margin-bottom: 5px;
                margin-top: 10px;
            `;
            analysisHeader.textContent = '分析结果图层';
            itemsContainer.appendChild(analysisHeader);

            analysisResultLayers.forEach((layerInfo, index) => {
                const item = createLayerListItem(layerInfo, index + 1, 'analysis');
                itemsContainer.appendChild(item);
            });
        }

        listContainer.appendChild(itemsContainer);
    }

    document.body.appendChild(listContainer);
}

/**
 * 创建图层列表项
 * @param {Object} layerInfo - 图层信息
 * @param {number} index - 序号
 * @param {string} type - 图层类型 ('data' 或 'analysis')
 * @returns {HTMLElement}
 */
function createLayerListItem(layerInfo, index, type) {
    const item = document.createElement('div');
    const isAnalysis = type === 'analysis';

    item.style.cssText = `
        padding: 8px;
        margin-bottom: 5px;
        background: ${isAnalysis ? '#e3f2fd' : '#f5f5f5'};
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        border-left: 3px solid ${isAnalysis ? '#2196F3' : '#4CAF50'};
    `;

    const isVisible = layerInfo.layer.getVisible();

    let buttonsHtml = `
        <button onclick="toggleLayerVisibility('${layerInfo.id}', '${type}')" style="
            background: ${isVisible ? '#4CAF50' : '#ccc'};
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
        ">${isVisible ? '隐藏' : '显示'}</button>
    `;

    if (isAnalysis) {
        // 分析结果图层：显示导出和删除按钮
        buttonsHtml += `
            <button onclick="exportAnalysisLayer('${layerInfo.id}')" style="
                background: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
            ">导出</button>
            <button onclick="removeAnalysisLayer('${layerInfo.id}')" style="
                background: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
            ">删除</button>
        `;
    } else {
        // 数据图层：显示分析和删除按钮
        buttonsHtml += `
            <button onclick="analyzeLocalShapefileLayer('${layerInfo.id}')" style="
                background: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
            ">分析</button>
            <button onclick="removeLocalShapefileLayer('${layerInfo.id}')" style="
                background: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
            ">删除</button>
        `;
    }

    const subtitle = isAnalysis
        ? `${layerInfo.featureCount} 要素 | ${layerInfo.analysisType === 'connectivity' ? '连接度' : '整合度'}`
        : `${layerInfo.featureCount} 要素 ${layerInfo.segmentMode ? '(段模式)' : ''}`;

    item.innerHTML = `
        <div style="flex: 1; overflow: hidden;">
            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${index}. ${layerInfo.name}
            </div>
            <div style="font-size: 11px; color: #666;">
                ${subtitle}
            </div>
        </div>
        <div style="display: flex; gap: 5px; margin-left: 8px;">
            ${buttonsHtml}
        </div>
    `;

    return item;
}

/**
 * 切换图层可见性（通用）
 * @param {string} layerId - 图层ID
 * @param {string} type - 图层类型 ('data' 或 'analysis')
 */
function toggleLayerVisibility(layerId, type) {
    let layerInfo;
    if (type === 'data') {
        layerInfo = localShapefileLayers.find(l => l.id === layerId);
    } else {
        layerInfo = analysisResultLayers.find(l => l.id === layerId);
    }

    if (layerInfo && layerInfo.layer) {
        const newVisibility = !layerInfo.layer.getVisible();
        layerInfo.layer.setVisible(newVisibility);
        updateLocalShapefileLayerList();
    }
}

/**
 * 导出分析结果图层
 * @param {string} layerId - 分析图层ID
 */
function exportAnalysisLayer(layerId) {
    const layerInfo = analysisResultLayers.find(l => l.id === layerId);
    if (layerInfo && layerInfo.source) {
        // 临时设置当前分析图层为要导出的图层
        const originalSource = spatialAnalysisSource;
        const originalLayer = spatialAnalysisLayer;
        const originalFeatures = spatialFeaturesCache;

        spatialAnalysisSource = layerInfo.source;
        spatialAnalysisLayer = layerInfo.layer;
        spatialFeaturesCache = layerInfo.source.getFeatures().map(f => f.get('originalFeature')).filter(f => f);

        // 调用导出函数
        exportSpatialAnalysisResults();

        // 恢复原始状态
        spatialAnalysisSource = originalSource;
        spatialAnalysisLayer = originalLayer;
        spatialFeaturesCache = originalFeatures;
    }
}

/**
 * 删除分析结果图层
 * @param {string} layerId - 分析图层ID
 */
function removeAnalysisLayer(layerId) {
    const index = analysisResultLayers.findIndex(l => l.id === layerId);
    if (index >= 0) {
        const layerInfo = analysisResultLayers[index];

        // Remove from map
        if (layerInfo.layer) {
            map.removeLayer(layerInfo.layer);
        }

        // Remove from array
        analysisResultLayers.splice(index, 1);
        
        // Remove from IndexedDB
        if (typeof removeAnalysisLayerFromStorage === 'function') {
            removeAnalysisLayerFromStorage(layerId).catch(err => {
                console.warn('从IndexedDB删除分析图层失败:', err);
            });
        }

        // Update UI
        updateLocalShapefileLayerList();

        console.log('已删除分析图层:', layerInfo.name);
    }
}

/**
 * 清除所有图层（数据图层和分析图层）
 */
function clearAllLayers() {
    // 清除数据图层
    localShapefileLayers.forEach(layerInfo => {
        if (layerInfo.layer) {
            map.removeLayer(layerInfo.layer);
        }
    });
    localShapefileLayers = [];

    // 清除分析图层
    analysisResultLayers.forEach(layerInfo => {
        if (layerInfo.layer) {
            map.removeLayer(layerInfo.layer);
        }
    });
    analysisResultLayers = [];

    spatialFeaturesCache = [];
    spatialAdjacency = null;

    // Clear from IndexedDB
    if (isIndexedDBSupported()) {
        clearAllLayersFromStorage().catch(err => {
            console.warn('清除IndexedDB图层数据失败:', err);
        });
    }

    updateLocalShapefileLayerList();
    console.log('已清除所有图层');
}

/**
 * Toggle layer visibility
 * @param {string} layerId - Layer ID
 */
function toggleLocalShapefileLayer(layerId) {
    const layerInfo = localShapefileLayers.find(l => l.id === layerId);
    if (layerInfo && layerInfo.layer) {
        const newVisibility = !layerInfo.layer.getVisible();
        layerInfo.layer.setVisible(newVisibility);
        updateLocalShapefileLayerList();
    }
}

/**
 * Analyze a specific layer
 * @param {string} layerId - Layer ID
 */
function analyzeLocalShapefileLayer(layerId) {
    const layerInfo = localShapefileLayers.find(l => l.id === layerId);
    if (layerInfo) {
        // Set this layer's data as current
        spatialFeaturesCache = layerInfo.features;
        spatialAdjacency = null;
        window._originalFeatures = layerInfo.originalFeatures;
        window._segmentMode = layerInfo.segmentMode;

        showSpatialAnalysisDialog();
    }
}

/**
 * Remove a specific layer
 * @param {string} layerId - Layer ID
 */
function removeLocalShapefileLayer(layerId) {
    const index = localShapefileLayers.findIndex(l => l.id === layerId);
    if (index >= 0) {
        const layerInfo = localShapefileLayers[index];

        // Remove from map
        if (layerInfo.layer) {
            map.removeLayer(layerInfo.layer);
        }

        // Remove from array
        localShapefileLayers.splice(index, 1);

        // Remove from IndexedDB
        if (isIndexedDBSupported()) {
            removeLayerFromStorage(layerId).catch(err => {
                console.warn('从IndexedDB删除图层失败:', err);
            });
        }

        // Update UI
        updateLocalShapefileLayerList();

        console.log('已删除图层:', layerInfo.name);
    }
}

/**
 * Clear all local shapefile layers
 */
function clearAllLocalShapefileLayers() {
    localShapefileLayers.forEach(layerInfo => {
        if (layerInfo.layer) {
            map.removeLayer(layerInfo.layer);
        }
    });
    localShapefileLayers = [];
    spatialFeaturesCache = [];
    spatialAdjacency = null;

    // Clear from IndexedDB
    if (isIndexedDBSupported()) {
        clearAllLayersFromStorage().catch(err => {
            console.warn('清除IndexedDB图层数据失败:', err);
        });
    }

    updateLocalShapefileLayerList();
    console.log('已清除所有本地图层');
}
