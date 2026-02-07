/**
 * GeoServer 相关功能
 */

/**
 * 从 GeoServer 获取图层列表
 * @param {string} workspace - 工作空间名称
 * @returns {Promise<Array>} 图层列表
 */
async function fetchLayersFromGeoServer(workspace) {
    // 优先使用代理，避免跨域问题
    // 使用相对于当前页面的路径
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const proxyUrl = basePath + `api/geoserver_proxy.php?workspace=${encodeURIComponent(workspace)}`;
    const directUrl = `http://gis.kjjfpt.top/geoserver/${workspace}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
    
    let response;
    let xmlText;
    let useProxy = true;
    
    try {
        // 首先尝试使用代理
        console.log('正在通过代理从 GeoServer 获取图层列表...', proxyUrl);
        response = await fetch(proxyUrl);
        
        if (!response.ok) {
            // 如果是 404，尝试获取错误信息
            let errorMsg = `代理请求失败: HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ' - ' + (errorData.error || errorData.message || '');
                if (errorData.tried_urls) {
                    console.warn('代理尝试的 URL:', errorData.tried_urls);
                }
            } catch (e) {
                // 忽略 JSON 解析错误
            }
            throw new Error(errorMsg);
        }
        
        // 检查返回的是否是 JSON 错误
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            const errorMsg = errorData.error || errorData.message || '代理返回错误';
            if (errorData.tried_urls) {
                console.warn('代理尝试的 URL:', errorData.tried_urls);
            }
            throw new Error(errorMsg);
        }
        
        xmlText = await response.text();
        console.log('✓ 通过代理成功获取图层列表');
    } catch (proxyError) {
        console.warn('代理请求失败，尝试直接访问 GeoServer:', proxyError.message);
        useProxy = false;
        
        try {
            // 如果代理失败，尝试直接访问（可能已配置 CORS）
            console.log('尝试直接访问 GeoServer...', directUrl);
            response = await fetch(directUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            xmlText = await response.text();
            console.log('✓ 直接访问成功获取图层列表');
        } catch (directError) {
            // 如果直接访问也失败，抛出错误
            throw new Error(`获取图层列表失败（代理和直接访问都失败）: ${directError.message}`);
        }
    }
    
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // 检查是否有解析错误
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML 解析错误: ' + parserError.textContent);
        }
        
        // 解析 WMS GetCapabilities XML
        // GeoServer 的 GetCapabilities 中，图层名称通常不包含工作空间前缀
        // 需要查找所有 Layer 元素，并检查其 Name 子元素
        const layers = [];
        const processedNames = new Set(); // 用于去重
        
        // 样式名称列表（需要排除）
        const styleNames = new Set(['polygon', 'raster', 'line', 'point', 'ogc:wms']);
        
        // 已知的其他工作空间示例图层（需要排除）
        // 这些是 GeoServer 默认示例数据，不属于 WebGIS 工作空间
        const otherWorkspaceLayers = new Set([
            'spearfish', 'tasmania', 'tiger-ny', 'tiger_ny',
            'sf', 'sf:archsites', 'sf:bugsites', 'sf:restricted',
            'topp', 'topp:states', 'topp:tasmania_roads', 'topp:tasmania_state_boundaries',
            'cite', 'cite:BasicPolygons', 'cite:Lakes', 'cite:Polygons'
        ]);
        
        // 查找所有 Layer 元素
        const allLayers = xmlDoc.getElementsByTagName('Layer');
        
        for (let i = 0; i < allLayers.length; i++) {
            const layerNode = allLayers[i];
            
            // 查找 Name 元素（直接子元素）
            let nameElement = null;
            for (let j = 0; j < layerNode.childNodes.length; j++) {
                const child = layerNode.childNodes[j];
                if (child.nodeName === 'Name' && child.textContent) {
                    nameElement = child;
                    break;
                }
            }
            
            if (!nameElement) {
                continue; // 跳过没有名称的图层
            }
            
            const layerName = nameElement.textContent.trim();
            
            // 跳过空名称、服务名称和样式名称
            if (!layerName || 
                styleNames.has(layerName.toLowerCase()) ||
                layerName.toLowerCase().includes('style') ||
                layerName.toLowerCase().startsWith('default-')) {
                continue;
            }
            
            // 跳过已知的其他工作空间图层
            if (otherWorkspaceLayers.has(layerName.toLowerCase()) || 
                otherWorkspaceLayers.has(layerName)) {
                console.log('跳过其他工作空间的图层:', layerName);
                continue;
            }
            
            // 如果名称包含冒号，检查工作空间前缀
            let actualLayerName = layerName;
            let actualWorkspace = workspace;
            
            if (layerName.includes(':')) {
                const parts = layerName.split(':');
                if (parts.length === 2) {
                    if (parts[0] === workspace) {
                        actualLayerName = parts[1];
                    } else {
                        // 不是当前工作空间，跳过
                        console.log('跳过其他工作空间的图层:', layerName, '(工作空间:', parts[0], ')');
                        continue;
                    }
                }
            }
            
            // 对于没有工作空间前缀的图层名称，需要额外验证
            // 检查图层的层级结构：如果父 Layer 有多个子 Layer，且当前 Layer 不在正确的层级，可能不属于当前工作空间
            // 更可靠的方法：检查图层的父级结构
            // 如果图层的父 Layer 有多个子 Layer，且这些子 Layer 的名称都不包含当前工作空间，则可能不属于当前工作空间
            
            // 检查是否有 BoundingBox 或 SRS（实际图层通常有这些）
            // 这是判断是否是实际图层的关键
            let hasBoundingBox = false;
            let hasSRS = false;
            for (let j = 0; j < layerNode.childNodes.length; j++) {
                const child = layerNode.childNodes[j];
                if (child.nodeName === 'BoundingBox' || child.nodeName === 'LatLonBoundingBox') {
                    hasBoundingBox = true;
                }
                if (child.nodeName === 'SRS') {
                    hasSRS = true;
                }
            }
            
            // 如果既没有 BoundingBox 也没有 SRS，可能是父容器或样式，跳过
            if (!hasBoundingBox && !hasSRS) {
                continue;
            }
            
            // 去重检查
            const fullName = actualWorkspace + ':' + actualLayerName;
            if (processedNames.has(fullName)) {
                continue;
            }
            
            // 获取图层的 Title（显示名称）
            let titleElement = null;
            for (let j = 0; j < layerNode.childNodes.length; j++) {
                const child = layerNode.childNodes[j];
                if (child.nodeName === 'Title' && child.textContent) {
                    titleElement = child;
                    break;
                }
            }
            const displayName = titleElement ? titleElement.textContent.trim() : actualLayerName;
            
            // 添加到列表
            layers.push({
                workspace: actualWorkspace,
                name: actualLayerName,
                displayName: displayName || actualLayerName,
                fullName: fullName
            });
            
            processedNames.add(fullName);
        }
        
        // 如果还是没找到，尝试更简单的方法：查找所有 Name，但排除明显的非图层名称
        if (layers.length === 0) {
            console.warn('使用备用方法查找图层...');
            const allNameElements = xmlDoc.getElementsByTagName('Name');
            const skipNames = ['OGC:WMS', 'default-style', 'polygon', 'raster', 'line', 'point'];
            
            for (let i = 0; i < allNameElements.length; i++) {
                const nameElement = allNameElements[i];
                const name = nameElement.textContent.trim();
                
                // 跳过明显的非图层名称
                if (!name || skipNames.some(skip => name.toLowerCase().includes(skip.toLowerCase()))) {
                    continue;
                }
                
                // 检查父元素是否是 Layer
                const parentLayer = nameElement.closest ? nameElement.closest('Layer') : 
                                   (nameElement.parentElement && nameElement.parentElement.tagName === 'Layer' ? nameElement.parentElement : null);
                
                if (parentLayer) {
                    // 检查是否有子 Layer（如果有，可能是父图层）
                    const hasChildLayers = parentLayer.getElementsByTagName('Layer').length > 1;
                    if (!hasChildLayers) {
                        const fullName = workspace + ':' + name;
                        const exists = layers.some(l => l.fullName === fullName);
                        if (!exists) {
                            const titleElements = parentLayer.getElementsByTagName('Title');
                            const displayName = titleElements.length > 0 ? titleElements[0].textContent.trim() : name;
                            
                            layers.push({
                                workspace: workspace,
                                name: name,
                                displayName: displayName,
                                fullName: fullName
                            });
                        }
                    }
                }
            }
        }
        
        console.log('成功获取图层列表，共', layers.length, '个图层:', layers);
        if (layers.length === 0) {
            console.warn('警告：未找到任何图层，请检查 GeoServer 配置或工作空间名称');
        }
        fetchedLayers = layers;
        return layers;
    } catch (error) {
        console.error('从 GeoServer 获取图层列表失败:', error);
        // 检查是否是 CORS 错误
        if (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch') || error.message.includes('网络') || error.name === 'TypeError')) {
            console.warn('⚠️ 网络或跨域问题：无法获取 GeoServer 图层列表');
            console.warn('💡 解决方案：');
            console.warn('   1. 检查代理服务器 api/geoserver_proxy.php 是否正常工作');
            console.warn('   2. 在设置面板中使用"手动输入图层信息"功能添加图层');
            console.warn('   3. 或在 GeoServer 服务器端配置 CORS 支持（Jetty 配置）');
        }
        // 如果获取失败，返回预定义的图层列表
        console.log('使用预定义的图层列表（共', availableLayers.length, '个图层）');
        fetchedLayers = []; // 清空获取的图层列表
        return availableLayers;
    }
}

/**
 * 获取图层列表（优先使用从 GeoServer 获取的，失败则使用预定义的）
 * @returns {Array} 图层列表
 */
function getAvailableLayers() {
    return fetchedLayers.length > 0 ? fetchedLayers : availableLayers;
}

