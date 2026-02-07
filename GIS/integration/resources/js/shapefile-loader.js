/**
 * Shapefile Loader
 * Client-side shapefile parsing using shapefile.js library
 */

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
        
        // Read .shp file
        const shpBuffer = await readFileAsArrayBuffer(shpFile);
        
        // Read .dbf file if provided
        let dbfBuffer = null;
        if (dbfFile) {
            dbfBuffer = await readFileAsArrayBuffer(dbfFile);
        }
        
        // Parse shapefile using shapefile.js
        // The library expects ArrayBuffer for both .shp and .dbf
        const geojson = await shapefile.read(shpBuffer, dbfBuffer);
        
        console.log('Shapefile 解析成功，共', geojson.features.length, '个要素');
        return geojson;
    } catch (error) {
        console.error('Shapefile 解析失败:', error);
        throw error;
    }
}

/**
 * Load shapefile from ZIP file
 * @param {File} zipFile - .zip file containing shapefile components
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function loadShapefileFromZip(zipFile) {
    try {
        console.log('正在解压 ZIP 文件...');
        
        const zipBuffer = await readFileAsArrayBuffer(zipFile);
        const zip = await JSZip.loadAsync(zipBuffer);
        
        // Find .shp and .dbf files
        let shpFile = null;
        let dbfFile = null;
        
        for (const [filename, file] of Object.entries(zip.files)) {
            const lowerName = filename.toLowerCase();
            if (lowerName.endsWith('.shp')) {
                shpFile = await file.async('arraybuffer');
            } else if (lowerName.endsWith('.dbf')) {
                dbfFile = await file.async('arraybuffer');
            }
        }
        
        if (!shpFile) {
            throw new Error('ZIP 文件中未找到 .shp 文件');
        }
        
        console.log('ZIP 解压完成，开始解析 Shapefile...');
        
        // Parse shapefile
        const geojson = await shapefile.read(shpFile, dbfFile);
        
        console.log('Shapefile 解析成功，共', geojson.features.length, '个要素');
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
            
            if (zipInput.files.length > 0) {
                // Load from ZIP
                geojson = await loadShapefileFromZip(zipInput.files[0]);
            } else if (shpInput.files.length > 0) {
                // Load from individual files
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
            
            // Load shapefile data with segment mode option
            await loadLocalShapefile(geojson, segmentMode);
            
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
 */
async function loadLocalShapefile(geojson, splitToSegments = false) {
    try {
        console.log('正在加载本地 Shapefile 数据...');
        
        // Clear existing analysis layer
        if (spatialAnalysisLayer) {
            map.removeLayer(spatialAnalysisLayer);
            spatialAnalysisLayer = null;
        }
        
        // Store original features
        const originalFeatures = geojson.features;
        
        // Optionally split to segments
        let displayFeatures = originalFeatures;
        if (splitToSegments) {
            displayFeatures = convertFeaturesToSegments(originalFeatures);
            console.log(`段模式: ${originalFeatures.length} 条线 → ${displayFeatures.length} 个段`);
        }
        
        // Create vector source and layer
        const source = new ol.source.Vector();
        const geoJsonFormat = new ol.format.GeoJSON();
        
        // Add features to map
        displayFeatures.forEach(feature => {
            const olFeature = geoJsonFormat.readFeature(feature, {
                dataProjection: 'EPSG:4326',
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
        });
        
        // Create layer
        const layer = new ol.layer.Vector({
            source: source,
            name: 'localShapefile'
        });
        
        map.addLayer(layer);
        
        // Zoom to layer extent
        const extent = source.getExtent();
        if (extent && !ol.extent.isEmpty(extent)) {
            map.getView().fit(extent, {
                padding: [50, 50, 50, 50],
                duration: 1000
            });
        }
        
        // Cache data for spatial analysis
        spatialFeaturesCache = displayFeatures;
        spatialAdjacency = null; // Reset adjacency cache
        
        // Store original features and mode
        window._originalFeatures = originalFeatures;
        window._segmentMode = splitToSegments;
        
        const modeText = splitToSegments ? '（段模式）' : '（线模式）';
        showPopup(`成功加载 ${displayFeatures.length} 个要素${modeText}`);
        console.log('本地 Shapefile 加载完成');
        
        // Automatically show spatial analysis dialog after a delay
        // This allows the success popup to be closed first
        setTimeout(() => {
            // Close the success popup before showing analysis dialog
            if (currentPopup && document.body.contains(currentPopup)) {
                document.body.removeChild(currentPopup);
                currentPopup = null;
            }
            if (popupTimer) {
                clearTimeout(popupTimer);
                popupTimer = null;
            }
            
            showSpatialAnalysisDialog();
        }, 2000); // Increased to 2 seconds to give user time to read message
        
    } catch (error) {
        console.error('加载本地 Shapefile 失败:', error);
        showPopup('加载失败: ' + error.message);
    }
}
