/**
 * GeoServer 相关功能
 */

/**
 * 从 GeoServer 获取图层列表
 * @param {string} workspace - 工作空间名称（可选，默认使用配置中的workspace）
 * @returns {Promise<Array>} 图层列表
 */
async function fetchLayersFromGeoServer(workspace) {
    // 使用传入的workspace或配置中的workspace
    const targetWorkspace = workspace || geoserverConfig.workspace || '';

    // 构建GeoServer基础URL
    const baseUrl = geoserverConfig.url.replace(/\/$/, ''); // 移除末尾的斜杠

    // 构建GetCapabilities URL
    let capabilitiesUrl;
    if (targetWorkspace) {
        capabilitiesUrl = `${baseUrl}/${targetWorkspace}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
    } else {
        // 不指定工作空间，获取所有图层
        capabilitiesUrl = `${baseUrl}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
    }

    console.log('正在从GeoServer获取图层列表:', capabilitiesUrl);

    // 尝试直接访问（公开的GeoServer服务通常支持CORS）
    let response;
    let xmlText;

    try {
        response = await fetch(capabilitiesUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        xmlText = await response.text();
        console.log('✓ 成功获取图层列表');
    } catch (fetchError) {
        console.error('获取图层列表失败:', fetchError);
        throw new Error(`无法连接到GeoServer: ${fetchError.message}`);
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

            // 如果名称包含冒号，解析工作空间前缀
            let actualLayerName = layerName;
            let actualWorkspace = targetWorkspace;

            if (layerName.includes(':')) {
                const parts = layerName.split(':');
                if (parts.length === 2) {
                    actualWorkspace = parts[0];
                    actualLayerName = parts[1];
                }
            }

            // 如果指定了工作空间，只显示该工作空间的图层
            if (targetWorkspace && actualWorkspace !== targetWorkspace) {
                console.log('跳过其他工作空间的图层:', layerName, '(工作空间:', actualWorkspace, ')');
                continue;
            }

            // 检查是否有 BoundingBox 或 SRS（实际图层通常有这些）
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
                        // 解析工作空间
                        let ws = targetWorkspace;
                        let ln = name;
                        if (name.includes(':')) {
                            const parts = name.split(':');
                            ws = parts[0];
                            ln = parts[1];
                        }

                        // 如果指定了工作空间，只显示该工作空间的图层
                        if (targetWorkspace && ws !== targetWorkspace) {
                            continue;
                        }

                        const fullName = ws + ':' + ln;
                        const exists = layers.some(l => l.fullName === fullName);
                        if (!exists) {
                            const titleElements = parentLayer.getElementsByTagName('Title');
                            const displayName = titleElements.length > 0 ? titleElements[0].textContent.trim() : ln;

                            layers.push({
                                workspace: ws,
                                name: ln,
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
            console.warn('   1. 检查 GeoServer 地址是否正确');
            console.warn('   2. 在设置面板中修改 GeoServer 地址');
            console.warn('   3. 或在 GeoServer 服务器端配置 CORS 支持');
        }
        // 如果获取失败，返回预定义的图层列表
        const fallbackLayers = geoserverConfig.fallbackLayers || [];
        if (fallbackLayers.length > 0) {
            console.log('使用配置的备用图层列表（共', fallbackLayers.length, '个图层）');
            fetchedLayers = fallbackLayers;
            return fallbackLayers;
        }
        fetchedLayers = [];
        return [];
    }
}

/**
 * 获取图层列表（优先使用从 GeoServer 获取的，失败则使用预定义的）
 * @returns {Array} 图层列表
 */
function getAvailableLayers() {
    return fetchedLayers.length > 0 ? fetchedLayers : availableLayers;
}
