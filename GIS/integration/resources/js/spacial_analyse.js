/**
 * 空间句法分析模块
 * 实现连接度和整合度计算及可视化
 * 使用 WASM 加速计算（当可用时），否则回退到 JavaScript 实现
 */

// 全局变量
var spatialAnalysisLayer = null;
var spatialAnalysisSource = null;
var currentAnalysisType = null; // 'connectivity' 或 'integration'
var progressPopup = null; // 进度显示弹窗
var spatialFeaturesCache = []; // 缓存当前分析的 GeoJSON features
var spatialAdjacency = null;   // 缓存邻接表（含权重）
var colorStretch = { min: null, max: null }; // 手动颜色拉伸范围
var spatialNodeCount = 0;      // 缓存当前分析的节点/线条总数
var spatialIntegrationMode = 'angle'; // 'topo' | 'angle'
var progressCloseTimer = null; // 进度窗口关闭定时器
var useWasmAcceleration = true; // 是否使用 WASM 加速（自动检测）

/**
 * 从 GeoServer 获取矢量线图层数据（使用 WFS）
 * @param {string} workspace - 工作空间名称
 * @param {string} layerName - 图层名称
 * @returns {Promise<Array>} 线段要素数组
 */
async function fetchVectorLayerFromGeoServer(workspace, layerName) {
    try {
        const fullLayerName = workspace + ':' + layerName;
        
        // 使用配置的GeoServer地址
        const baseUrl = geoserverConfig.url.replace(/\/$/, '');
        const wfsUrl = `${baseUrl}/${workspace}/wfs?` +
            `service=WFS&version=1.1.0&request=GetFeature&` +
            `typeName=${encodeURIComponent(fullLayerName)}&` +
            `outputFormat=application/json&` +
            `srsName=EPSG:4326`;

        console.log('正在从 GeoServer 获取矢量数据:', wfsUrl);
        const response = await fetch(wfsUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const geojson = await response.json();
        console.log('成功获取矢量数据，共', geojson.features.length, '个要素');
        
        return geojson.features;
    } catch (error) {
        console.error('获取矢量数据失败:', error);
        throw error;
    }
}

/**
 * 判断两条线段是否相交
 * @param {Array} line1 - 第一条线段 [[x1, y1], [x2, y2]]
 * @param {Array} line2 - 第二条线段 [[x3, y3], [x4, y4]]
 * @returns {boolean} 是否相交
 */
function doLinesIntersect(line1, line2) {
    const [p1, p2] = line1;
    const [p3, p4] = line2;
    
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;
    const [x4, y4] = p4;
    
    // 计算方向向量
    const d1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
    const d2 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
    const d3 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    const d4 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
    
    // 检查是否相交（使用叉积判断）
    // 允许端点重合的情况
    const tolerance = 1e-10;
    if (Math.abs(d1) < tolerance || Math.abs(d2) < tolerance || 
        Math.abs(d3) < tolerance || Math.abs(d4) < tolerance) {
        // 检查端点是否在线段上
        return isPointOnLine(p1, line2, 1e-6) || isPointOnLine(p2, line2, 1e-6) ||
               isPointOnLine(p3, line1, 1e-6) || isPointOnLine(p4, line1, 1e-6);
    }
    
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * 判断点是否在线段上
 * @param {Array} point - 点 [x, y]
 * @param {Array} line - 线段 [[x1, y1], [x2, y2]]
 * @param {number} tolerance - 容差
 * @returns {boolean} 是否在线段上
 */
function isPointOnLine(point, line, tolerance = 1e-6) {
    const [p1, p2] = line;
    const [px, py] = point;
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    
    // 计算点到线段的距离
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return false;
    
    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy) < tolerance;
}

/**
 * 计算两条线段的交点
 * @param {Array} line1 - 第一条线段
 * @param {Array} line2 - 第二条线段
 * @returns {Array|null} 交点坐标或 null
 */
function getLineIntersection(line1, line2) {
    const [p1, p2] = line1;
    const [p3, p4] = line2;
    
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;
    const [x4, y4] = p4;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // 平行线
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    }
    
    return null;
}

/**
 * 从 GeoJSON 要素提取线段坐标
 * @param {Object} feature - GeoJSON 要素
 * @returns {Array} 线段数组，每个线段是 [[x1, y1], [x2, y2]]
 */
function extractLinesFromFeature(feature) {
    const geometry = feature.geometry;
    const lines = [];
    
    if (geometry.type === 'LineString') {
        const coordinates = geometry.coordinates;
        for (let i = 0; i < coordinates.length - 1; i++) {
            lines.push([coordinates[i], coordinates[i + 1]]);
        }
    } else if (geometry.type === 'MultiLineString') {
        geometry.coordinates.forEach(lineString => {
            for (let i = 0; i < lineString.length - 1; i++) {
                lines.push([lineString[i], lineString[i + 1]]);
            }
        });
    }
    
    return lines;
}

/**
 * 显示进度
 * @param {string} message - 进度消息
 * @param {number} percent - 进度百分比 (0-100)
 */
function updateProgress(message, percent) {
    // 使用 requestAnimationFrame 确保 UI 更新
    requestAnimationFrame(() => {
        if (!progressPopup) {
            // 创建进度弹窗
            progressPopup = document.createElement('div');
            progressPopup.className = 'popup_';
            progressPopup.id = 'progress-popup';
            progressPopup.style.width = '400px';
            progressPopup.innerHTML = `
                <span class="close" onclick="closeProgress(0)">&times;</span>
                <div style="padding: 20px;">
                    <h3 style="margin-top: 0;">空间分析进行中</h3>
                    <div id="progressMessage" style="margin-bottom: 15px; color: #333; min-height: 20px;">${message}</div>
                    <div style="width: 100%; background-color: #e0e0e0; border-radius: 10px; overflow: hidden; margin-bottom: 10px; height: 25px;">
                        <div id="progressBar" style="width: ${Math.max(0, Math.min(100, percent))}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s ease; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;"></div>
                    </div>
                    <div id="progressPercent" style="text-align: center; color: #666; font-weight: bold; margin-top: 5px;">${Math.max(0, Math.min(100, percent)).toFixed(1)}%</div>
                </div>
            `;
            document.body.appendChild(progressPopup);
            currentPopup = progressPopup;
        } else {
            // 更新进度
            const messageEl = document.getElementById('progressMessage');
            const barEl = document.getElementById('progressBar');
            const percentEl = document.getElementById('progressPercent');
            
            const clampedPercent = Math.max(0, Math.min(100, percent));
            
            if (messageEl) messageEl.textContent = message;
            if (barEl) {
                barEl.style.width = clampedPercent + '%';
                // 在进度条上显示百分比（如果足够宽）
                if (clampedPercent > 15) {
                    barEl.textContent = clampedPercent.toFixed(0) + '%';
                } else {
                    barEl.textContent = '';
                }
            }
            if (percentEl) percentEl.textContent = clampedPercent.toFixed(1) + '%';
        }
    });
}

/**
 * 显示完成状态（在进度窗口中）
 * @param {string} message - 完成消息
 * @param {string} details - 详细信息（HTML格式）
 */
function showCompletionProgress(message, details) {
    if (!progressPopup) return;
    
    requestAnimationFrame(() => {
        const messageEl = document.getElementById('progressMessage');
        const barEl = document.getElementById('progressBar');
        const percentEl = document.getElementById('progressPercent');
        const titleEl = progressPopup.querySelector('h3');
        
        if (titleEl) {
            titleEl.textContent = '空间分析完成';
            titleEl.style.color = '#4CAF50';
        }
        
        if (messageEl) {
            messageEl.innerHTML = `<div style="color: #4CAF50; font-weight: bold; margin-bottom: 10px;">${message}</div>${details || ''}`;
        }
        
        if (barEl) {
            barEl.style.width = '100%';
            barEl.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            barEl.textContent = '100%';
        }
        
        if (percentEl) {
            percentEl.textContent = '100.0%';
            percentEl.style.color = '#4CAF50';
        }
    });
}

/**
 * 关闭进度显示（延迟关闭）
 * @param {number} delayMs - 延迟时间（毫秒），默认3000ms
 */
function closeProgress(delayMs = 3000) {
    if (progressCloseTimer) {
        clearTimeout(progressCloseTimer);
        progressCloseTimer = null;
    }
    const doClose = () => {
        const el = document.getElementById('progress-popup') || progressPopup;
        if (el && document.body.contains(el)) {
            document.body.removeChild(el);
        }
        progressPopup = null;
        if (currentPopup === el) currentPopup = null;
    };
    if (delayMs > 0) {
        progressCloseTimer = setTimeout(doClose, delayMs);
    } else {
        doClose();
    }
}

// 注意：算法实现已迁移到 connection.js 和 integration.js
// 本文件仅保留 UI 和可视化相关逻辑
// delay() 函数请使用 integration.js 中定义的版本

/**
 * 将值映射到颜色（蓝到红）
 * 使用分位数缩放确保颜色均匀分布
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @param {Array<number>} sortedValues - 排序后的所有值数组（用于分位数计算）
 * @returns {string} RGB颜色字符串
 */
function valueToColor(value, min, max, sortedValues) {
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
 * 执行空间分析并可视化
 * @param {string} workspace - 工作空间名称
 * @param {string} layerName - 图层名称
 * @param {string} analysisType - 分析类型：'connectivity' 或 'integration'
 */
async function performSpatialAnalysis(workspace, layerName, analysisType) {
    try {
        console.log('开始空间分析:', workspace, layerName, analysisType);
        
        // 显示初始进度
        updateProgress('正在从 GeoServer 获取数据...', 0);
        
        // 不再移除之前的分析图层，每次分析创建新的独立图层
        // 旧代码: if (spatialAnalysisLayer) { map.removeLayer(spatialAnalysisLayer); }
        
        // 获取矢量数据
        const features = await fetchVectorLayerFromGeoServer(workspace, layerName);
        
        if (features.length === 0) {
            closeProgress(0); // 立即关闭
            throw new Error('未获取到任何要素数据');
        }
        
        updateProgress(`数据加载完成，共 ${features.length} 个要素，开始预处理...`, 5);
        
        // 使用 setTimeout 确保进度条能够更新
        await new Promise(resolve => setTimeout(resolve, 100));

        // 检查是否使用 WASM 加速
        let adjacencyList;
        const useWasm = useWasmAcceleration && isWasmInitialized();
        
        if (useWasm) {
            console.log('使用 WASM 加速计算邻接表...');
            updateProgress('使用 WASM 加速计算中...', 10);
            adjacencyList = buildAdjacencyListWasm(features, spatialIntegrationMode, 8);
            updateProgress('WASM 邻接表计算完成', 30);
        } else {
            console.log('使用 JavaScript 回退实现...');
            // 回退到原有的 JavaScript 实现
            const { adjacencyList: adjList, cachedLines } = await buildAdjacencySimple(features, updateProgress, 8, spatialIntegrationMode);
            adjacencyList = adjList;
        }
        
        spatialFeaturesCache = features;
        spatialAdjacency = adjacencyList;
        spatialNodeCount = adjacencyList.length;
        
        // 计算连接度或整合度
        let results;
        if (analysisType === 'connectivity') {
            if (useWasm) {
                updateProgress('使用 WASM 计算连接度...', 35);
                const connectivity = calculateConnectivityWasm(adjacencyList, features.length);
                results = new Map();
                connectivity.forEach((value, index) => results.set(index, value));
                updateProgress('连接度计算完成', 95);
            } else {
                results = await calculateConnectivity(features, updateProgress, adjacencyList);
            }
        } else if (analysisType === 'integration') {
            if (useWasm) {
                updateProgress('使用 WASM 计算整合度...', 40);
                results = await calculateIntegrationWasm(features, adjacencyList, updateProgress);
            } else {
                results = await calculateIntegration(features, 8, updateProgress, adjacencyList, spatialIntegrationMode);
            }
        } else {
            closeProgress(0); // 立即关闭
            throw new Error('未知的分析类型: ' + analysisType);
        }
        
        updateProgress('正在生成可视化结果...', 98);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 计算最小值和最大值（支持手动颜色拉伸）
        const values = Array.from(results.values());
        const autoMin = Math.min(...values);
        const autoMax = Math.max(...values);
        let minValue = autoMin;
        let maxValue = autoMax;

        if (colorStretch) {
            if (colorStretch.min !== null) minValue = colorStretch.min;
            if (colorStretch.max !== null) maxValue = colorStretch.max;
            // 防止非法范围
            if (maxValue <= minValue) {
                minValue = autoMin;
                maxValue = autoMax;
            }
        }
        
        console.log('分析结果范围:', minValue, '到', maxValue);
        
        // 对数值进行排序，用于分位数缩放
        const sortedValues = values.slice().sort((a, b) => a - b);
        console.log('使用分位数缩放，共', sortedValues.length, '个要素');
        
        // 创建矢量图层
        spatialAnalysisSource = new ol.source.Vector();
        
        // 添加要素到图层
        const geoJsonFormat = new ol.format.GeoJSON();
        const totalFeatures = features.length;
        
        features.forEach((feature, index) => {
            if (index % Math.max(1, Math.floor(totalFeatures / 10)) === 0) {
                const percent = 98 + (index / totalFeatures) * 1.5;
                updateProgress(`正在渲染要素... (${index + 1}/${totalFeatures})`, Math.min(99.5, percent));
            }
            
            const value = results.get(index);
            const color = valueToColor(value, minValue, maxValue, sortedValues);
            
            try {
                // 创建 OpenLayers 要素
                const olFeature = geoJsonFormat.readFeature(feature, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: map.getView().getProjection()
                });
                
                // 设置属性
                olFeature.set('connectivity', analysisType === 'connectivity' ? value : undefined);
                olFeature.set('integration', analysisType === 'integration' ? value : undefined);
                olFeature.set('originalFeature', feature);
                
                // 设置样式
                olFeature.setStyle(new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 3
                    })
                }));
                
                spatialAnalysisSource.addFeature(olFeature);
            } catch (error) {
                console.warn('处理要素失败:', index, error);
            }
        });
        
        // 生成唯一的分析图层ID
        analysisResultLayerCounter++;
        const analysisLayerId = 'analysisResult_' + analysisResultLayerCounter;

        // 创建图层
        spatialAnalysisLayer = new ol.layer.Vector({
            source: spatialAnalysisSource,
            name: analysisLayerId
        });

        // 添加到地图
        map.addLayer(spatialAnalysisLayer);

        // 注册点击事件：单击线段显示其连接度/整合度（不再重算）
        if (!spatialAnalysisLayer._integrationClickHandler) {
            spatialAnalysisLayer._integrationClickHandler = function(evt) {
                const feature = map.forEachFeatureAtPixel(evt.pixel, function(f, layer) {
                    return layer === spatialAnalysisLayer ? f : null;
                });
                if (!feature) return;
                const idx = spatialAnalysisSource.getFeatures().indexOf(feature);
                const conn = feature.get('connectivity');
                const integ = feature.get('integration');
                const modeLabel = spatialIntegrationMode === 'topo' ? '拓扑深度' : '角度+长度加权';
                let html = `<div style="text-align:left;margin-top:4px;color:#666;">`;
                html += `<div><strong>线段索引：</strong>${idx}</div>`;
                if (conn !== undefined) html += `<div><strong>连接度：</strong>${conn}</div>`;
                if (integ !== undefined) html += `<div><strong>整合度（${modeLabel}）：</strong>${Number(integ).toFixed(4)}</div>`;
                html += `</div>`;
                showPopup(html);
            };
            map.on('singleclick', spatialAnalysisLayer._integrationClickHandler);
        }

        // 缩放到图层范围
        const extent = spatialAnalysisSource.getExtent();
        if (extent && !ol.extent.isEmpty(extent)) {
            map.getView().fit(extent, {
                padding: [50, 50, 50, 50],
                duration: 1000
            });
        }

        // 保存分析结果图层信息
        const sourceName = layerName || 'Unknown';
        const analysisTypeName = analysisType === 'connectivity' ? '连接度' : '整合度';
        const analysisLayerInfo = {
            id: analysisLayerId,
            name: `${sourceName} - ${analysisTypeName}`,
            layer: spatialAnalysisLayer,
            source: spatialAnalysisSource,
            features: features, // 添加features用于持久化
            analysisType: analysisType,
            results: results, // 添加results用于持久化
            featureCount: features.length,
            minValue: minValue,
            maxValue: maxValue,
            sortedValues: sortedValues, // 添加sortedValues用于持久化
            sourceLayerName: sourceName, // 源图层名称
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
        if (typeof updateLocalShapefileLayerList === 'function') {
            updateLocalShapefileLayerList();
        }

        currentAnalysisType = analysisType;
        
        // 在进度窗口中显示完成信息
        const analysisName = analysisType === 'connectivity' ? '连接度' : '整合度';
        const details = `
            <div style="text-align: left; margin-top: 10px; font-size: 14px; color: #666;">
                <div><strong>分析类型：</strong>${analysisName}</div>
                <div><strong>要素数量：</strong>${features.length}</div>
                <div><strong>颜色范围：</strong>${minValue.toFixed(2)} - ${maxValue.toFixed(2)}${(colorStretch && (colorStretch.min !== null || colorStretch.max !== null)) ? '（手动拉伸）' : '（自动）'}</div>
            </div>
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="exportSpatialAnalysisResults(); closeProgress(0);" style="padding: 8px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    导出为Shapefile
                </button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #999;">
                窗口将在5秒后自动关闭
            </div>
        `;
        showCompletionProgress('✓ 空间分析完成！', details);
        
        // 延迟关闭进度窗口
        closeProgress(5000);
        
        console.log('空间分析完成');
        
    } catch (error) {
        console.error('空间分析失败:', error);
        // 在进度窗口中显示错误信息
        if (progressPopup) {
            const titleEl = progressPopup.querySelector('h3');
            const messageEl = document.getElementById('progressMessage');
            const barEl = document.getElementById('progressBar');
            
            if (titleEl) {
                titleEl.textContent = '空间分析失败';
                titleEl.style.color = '#f44336';
            }
            
            if (messageEl) {
                messageEl.innerHTML = `<div style="color: #f44336; font-weight: bold;">${error.message}</div>`;
            }
            
            if (barEl) {
                barEl.style.background = 'linear-gradient(90deg, #f44336, #e57373)';
            }
            
            // 延迟关闭
            closeProgress(3000);
        } else {
            // 如果没有进度窗口，显示普通弹窗
            showPopup('空间分析失败：' + error.message);
        }
    }
}

/**
 * 显示空间分析对话框
 */
function showSpatialAnalysisDialog() {
    // Check if local shapefile data is loaded
    const hasLocalData = spatialFeaturesCache && spatialFeaturesCache.length > 0;
    
    // 获取可用图层列表（如果 GeoServer 功能可用）
    let layers = [];
    if (typeof getAvailableLayers === 'function') {
        layers = getAvailableLayers();
    }
    
    // 创建对话框HTML（增加颜色拉伸输入和本地数据选项）
    let dataSourceOptions = '';
    
    if (hasLocalData) {
        dataSourceOptions += `<option value="local">本地数据 (${spatialFeaturesCache.length} 个要素)</option>`;
    }
    
    layers.forEach(layer => {
        dataSourceOptions += `<option value="${layer.workspace}:${layer.name}">GeoServer: ${layer.displayName}</option>`;
    });
    
    if (!hasLocalData && layers.length === 0) {
        showPopup('没有可用的数据源，请先上传本地 Shapefile');
        return;
    }
    
    const dialogHtml = `
        <div style="padding: 20px;">
            <h3 style="margin-top: 0;">空间句法分析</h3>
            <div style="margin-bottom: 15px;">
                <label>数据源：</label>
                <select id="spatialAnalysisDataSource" style="width: 100%; padding: 5px; margin-top: 5px;">
                    ${dataSourceOptions}
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label>分析类型：</label>
                <select id="spatialAnalysisType" style="width: 100%; padding: 5px; margin-top: 5px;">
                    <option value="connectivity">连接度 (Connectivity)</option>
                    <option value="integration">整合度 (Integration)</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label>整合度模式：</label>
                <select id="spatialIntegrationMode" style="width: 100%; padding: 5px; margin-top: 5px;">
                    <option value="topo">拓扑深度（每跨一线+1，不计角度/长度）</option>
                    <option value="angle" selected>角度+长度加权（angle*tulip_bins*0.5 + length*0.001）</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label>WASM 线程数：</label>
                <div style="display:flex; gap:8px; margin-top:5px; align-items: center;">
                    <input id="wasmThreadCount" type="number" min="1" max="16" value="${wasmThreadCount}" style="width: 80px; padding:5px;">
                    <span style="font-size:12px;color:#777;">（1-16，推荐: ${navigator.hardwareConcurrency || 4}）</span>
                </div>
                <div style="font-size:12px;color:#777;margin-top:4px;">CPU 核心数: ${navigator.hardwareConcurrency || '未知'}，当前配置: ${wasmThreadCount} 线程</div>
            </div>
            <div style="margin-bottom: 15px;">
                <label>
                    <input type="checkbox" id="useWebGPU" ${isWebGPUAvailable() ? '' : 'disabled'}>
                    使用 WebGPU 加速（实验性）
                </label>
                <div style="font-size:12px;color:#777;margin-top:4px;">
                    ${isWebGPUAvailable() ? 'WebGPU 可用，仅用于整合度计算' : 'WebGPU 不可用，需要 Chrome 113+ 或 Edge 113+'}
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <label>颜色拉伸（可选）：</label>
                <div style="display:flex; gap:8px; margin-top:5px;">
                    <input id="colorStretchMin" type="number" step="0.0001" placeholder="最小值" style="flex:1; padding:5px;">
                    <input id="colorStretchMax" type="number" step="0.0001" placeholder="最大值" style="flex:1; padding:5px;">
                </div>
                <div style="font-size:12px;color:#777;margin-top:4px;">留空则按数据范围自动拉伸</div>
            </div>
            <div style="text-align: right; margin-top: 20px;">
                <button id="spatialAnalysisCancel" style="padding: 8px 15px; margin-right: 10px; cursor: pointer;">取消</button>
                <button id="spatialAnalysisStart" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; cursor: pointer;">开始分析</button>
            </div>
        </div>
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'popup_';
    dialog.style.width = '400px';
    dialog.innerHTML = dialogHtml;
    document.body.appendChild(dialog);
    currentPopup = dialog;
    
    // 绑定事件
    document.getElementById('spatialAnalysisCancel').onclick = function() {
        if (dialog && document.body.contains(dialog)) {
            document.body.removeChild(dialog);
            currentPopup = null;
        }
    };
    
    document.getElementById('spatialAnalysisStart').onclick = function() {
        const dataSourceSelect = document.getElementById('spatialAnalysisDataSource');
        const typeSelect = document.getElementById('spatialAnalysisType');
        const modeSelect = document.getElementById('spatialIntegrationMode');
        const threadCountInput = document.getElementById('wasmThreadCount');
        const useWebGPUCheckbox = document.getElementById('useWebGPU');
        const stretchMinInput = document.getElementById('colorStretchMin');
        const stretchMaxInput = document.getElementById('colorStretchMax');
        
        const selectedDataSource = dataSourceSelect.value;
        const analysisType = typeSelect.value;
        spatialIntegrationMode = modeSelect ? modeSelect.value : 'angle';
        
        // Save WebGPU preference
        const enableWebGPU = useWebGPUCheckbox ? useWebGPUCheckbox.checked : false;
        try {
            localStorage.setItem('enableWebGPU', enableWebGPU ? '1' : '0');
        } catch (e) {
            console.warn('无法保存 WebGPU 配置:', e);
        }
        
        // Update thread count configuration
        const threadCount = parseInt(threadCountInput.value, 10);
        if (threadCount >= 1 && threadCount <= 16) {
            saveThreadCount(threadCount);
            console.log('WASM 线程数已更新为:', threadCount);
        }
        
        const stretchMin = stretchMinInput.value.trim() === '' ? null : Number(stretchMinInput.value);
        const stretchMax = stretchMaxInput.value.trim() === '' ? null : Number(stretchMaxInput.value);

        colorStretch = {
            min: isNaN(stretchMin) ? null : stretchMin,
            max: isNaN(stretchMax) ? null : stretchMax
        };
        
        // 关闭对话框
        if (dialog && document.body.contains(dialog)) {
            document.body.removeChild(dialog);
            currentPopup = null;
        }
        
        // 开始分析
        if (selectedDataSource === 'local') {
            // Use local cached data
            performSpatialAnalysisLocal(analysisType);
        } else {
            // Use GeoServer data
            const [workspace, layerName] = selectedDataSource.split(':');
            performSpatialAnalysis(workspace, layerName, analysisType);
        }
    };
}

/**
 * 清除空间分析结果
 */
function clearSpatialAnalysis() {
    if (spatialAnalysisLayer) {
        map.removeLayer(spatialAnalysisLayer);
        spatialAnalysisLayer = null;
        spatialAnalysisSource = null;
        currentAnalysisType = null;
        console.log('已清除空间分析结果');
        showPopup('已清除空间分析结果');
    } else {
        showPopup('没有可清除的分析结果');
    }
}


