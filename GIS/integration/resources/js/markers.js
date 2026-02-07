/**
 * 标注管理功能
 */

/**
 * 在指定坐标添加标注
 * @param {Array<number>} coordinate - 坐标 [x, y] (百度投影)
 */
function addMarkerAtCoordinate(coordinate) {
    // 将坐标从百度投影转换为BD-09地理坐标
    const bd09Coord = ol.proj.toLonLat(coordinate, ol.proj.get('BD-09'));
    // 将BD-09转换为WGS84用于数据库存储
    const wgs84Coord = bd09ToWgs84(bd09Coord[0], bd09Coord[1]);
    const longitude = wgs84Coord[0];
    const latitude = wgs84Coord[1];
    
    // 弹出输入框让用户输入标注名称
    const name = prompt('请输入标注名称:');
    if (!name || name.trim() === '') {
        return;
    }
    
    const description = prompt('请输入标注描述（可选，直接回车跳过）:') || null;
    
    // 创建标注并保存到数据库
    saveMarkerToDatabase(name.trim(), description ? description.trim() : null, longitude, latitude);
}

/**
 * 保存标注到数据库
 * @param {string} name - 标注名称
 * @param {string|null} description - 标注描述
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 */
async function saveMarkerToDatabase(name, description, longitude, latitude) {
    try {
        const response = await fetch('api/markers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                longitude: longitude,
                latitude: latitude
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 在地图上添加标注
            addMarkerToMap(result.data);
            showPopup(`标注 "${name}" 添加成功！`);
            console.log('标注保存成功:', result.data);
        } else {
            alert('保存标注失败: ' + result.message);
        }
    } catch (error) {
        console.error('保存标注时出错:', error);
        alert('保存标注时出错: ' + error.message);
    }
}

/**
 * 在地图上添加标注点
 * @param {Object} markerData - 标注数据
 */
function addMarkerToMap(markerData) {
    // 数据库存储的是WGS84坐标，需要转换为BD-09用于显示
    // 使用更准确的转换算法
    const bd09Coord = wgs84ToBd09(markerData.longitude, markerData.latitude);
    
    // 将BD-09地理坐标转换为BD-09投影坐标（用于地图显示）
    const baiduProjection = ol.proj.get('BD-09');
    const coordinate = ol.proj.fromLonLat([bd09Coord[0], bd09Coord[1]], baiduProjection);
    
    // 调试信息
    console.log('添加标注到地图:', {
        name: markerData.name,
        wgs84: [markerData.longitude, markerData.latitude],
        bd09: bd09Coord,
        coordinate: coordinate
    });
    
    // 创建标注要素
    const feature = new ol.Feature({
        geometry: new ol.geom.Point(coordinate),
        id: markerData.id,
        name: markerData.name,
        description: markerData.description,
        longitude: markerData.longitude,
        latitude: markerData.latitude
    });
    
    // 添加到数据源
    markersSource.addFeature(feature);
    
    // 存储引用
    markersVector[markerData.id] = feature;
    
    console.log('标注已添加到地图:', markerData.name);
}

/**
 * 显示标注信息
 * @param {ol.Feature} feature - 标注要素
 */
function showMarkerInfo(feature) {
    const props = feature.getProperties();
    const info = `
        <div class="marker-info">
            <h3>${props.name || '未命名标注'}</h3>
            ${props.description ? `<p>${props.description}</p>` : ''}
            <p><strong>坐标:</strong> ${props.longitude.toFixed(6)}, ${props.latitude.toFixed(6)}</p>
            <button onclick="deleteMarker(${props.id})" class="marker-delete-btn">删除标注</button>
        </div>
    `;
    showPopup(info);
}

/**
 * 从数据库加载所有标注
 * @returns {Promise<Array>} 标注列表
 */
async function loadMarkersFromDatabase() {
    try {
        const response = await fetch('api/markers.php?action=list');
        const result = await response.json();
        
        if (result.success) {
            // 清空现有标注
            markersSource.clear();
            markersVector = {};
            
            // 添加所有标注到地图
            result.data.forEach(marker => {
                addMarkerToMap(marker);
            });
            
            console.log('已加载', result.data.length, '个标注');
            return result.data;
        } else {
            console.error('加载标注失败:', result.message);
            return [];
        }
    } catch (error) {
        console.error('加载标注时出错:', error);
        return [];
    }
}

/**
 * 删除标注
 * @param {number} markerId - 标注ID
 */
async function deleteMarker(markerId) {
    if (!confirm('确定要删除这个标注吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`api/markers.php?id=${markerId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 从地图上移除标注
            if (markersVector[markerId]) {
                markersSource.removeFeature(markersVector[markerId]);
                delete markersVector[markerId];
            }
            showPopup('标注已删除');
            console.log('标注删除成功');
        } else {
            alert('删除标注失败: ' + result.message);
        }
    } catch (error) {
        console.error('删除标注时出错:', error);
        alert('删除标注时出错: ' + error.message);
    }
}

/**
 * 切换添加标注模式
 * @returns {boolean} 当前是否处于添加模式
 */
function toggleAddMarkerMode() {
    isAddingMarker = !isAddingMarker;
    const btn = document.getElementById('addMarkerBtn');
    
    if (isAddingMarker) {
        map.getViewport().style.cursor = 'crosshair';
        if (btn) {
            btn.textContent = '退出添加模式';
            btn.style.background = '#ff4444';
        }
        showPopup('点击地图添加标注，再次点击"添加标注"按钮退出添加模式');
    } else {
        map.getViewport().style.cursor = '';
        if (btn) {
            btn.textContent = '添加标注';
            btn.style.background = '';
        }
    }
    return isAddingMarker;
}

