/**
 * Perform spatial analysis on locally loaded data (no GeoServer fetch)
 * @param {string} analysisType - 'connectivity' or 'integration'
 */
async function performSpatialAnalysisLocal(analysisType) {
    try {
        console.log('开始本地空间分析:', analysisType);
        
        // Check if local data is available
        if (!spatialFeaturesCache || spatialFeaturesCache.length === 0) {
            throw new Error('没有本地数据，请先上传 Shapefile');
        }
        
        const features = spatialFeaturesCache;
        
        // 显示初始进度
        updateProgress(`开始分析本地数据 (${features.length} 个要素)...`, 5);
        
        // 移除之前的分析图层
        if (spatialAnalysisLayer) {
            map.removeLayer(spatialAnalysisLayer);
            spatialAnalysisLayer = null;
        }
        
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
                console.log('调用 calculateIntegrationWasm');
                results = await calculateIntegrationWasm(features, adjacencyList, updateProgress, 8);
                console.log('calculateIntegrationWasm 返回结果:', results.size, '个');
            } else {
                console.log('使用 JavaScript 计算整合度...');
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
        
        console.log('分析结果统计:', {
            count: values.length,
            min: autoMin,
            max: autoMax,
            sample: values.slice(0, 5)
        });
        
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
            
            // Debug: Log first few values
            if (index < 3) {
                console.log(`要素 ${index}: 值=${value}, 类型=${typeof value}`);
            }
            
            const color = valueToColor(value, minValue, maxValue);
            
            // Debug: Log first few colors
            if (index < 3) {
                console.log(`要素 ${index}: 颜色=${color}`);
            }
            
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
        
        // 创建图层
        spatialAnalysisLayer = new ol.layer.Vector({
            source: spatialAnalysisSource,
            name: 'spatialAnalysis'
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
        
        currentAnalysisType = analysisType;
        
        // 在进度窗口中显示完成信息
        const analysisName = analysisType === 'connectivity' ? '连接度' : '整合度';
        const dataSource = (useWasm && analysisType === 'connectivity') ? 'WASM 加速' : 'JavaScript';
        const details = `
            <div style="text-align: left; margin-top: 10px; font-size: 14px; color: #666;">
                <div><strong>数据源：</strong>本地 Shapefile</div>
                <div><strong>计算方式：</strong>${dataSource}</div>
                <div><strong>分析类型：</strong>${analysisName}</div>
                <div><strong>要素数量：</strong>${features.length}</div>
                <div><strong>颜色范围：</strong>${minValue.toFixed(2)} - ${maxValue.toFixed(2)}${(colorStretch && (colorStretch.min !== null || colorStretch.max !== null)) ? '（手动拉伸）' : '（自动）'}</div>
            </div>
            <div style="margin-top: 15px; font-size: 12px; color: #999;">
                窗口将在3秒后自动关闭
            </div>
        `;
        showCompletionProgress('✓ 空间分析完成！', details);
        
        // 延迟关闭进度窗口
        closeProgress(3000);
        
        console.log('本地空间分析完成');
        
    } catch (error) {
        console.error('本地空间分析失败:', error);
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
