/**
 * 本地标注管理模块
 * 使用 localStorage 存储标注数据，无需后端数据库
 */

// 本地标注存储键名
const LOCAL_MARKERS_KEY = 'gis_local_markers';
const LOCAL_MARKERS_VISIBLE_KEY = 'gis_local_markers_visible';

// 本地标注图层
var localMarkersLayer = null;
var localMarkersSource = null;
var localMarkersVector = {}; // 存储本地标注要素，key为标注ID
// isLocalMarkerMode 变量在 config.js 中定义
var localMarkerIdCounter = 0; // 本地标注ID计数器

/**
 * 初始化本地标注图层
 */
function initLocalMarkersLayer() {
    if (localMarkersLayer) {
        return;
    }

    // 创建本地标注数据源
    localMarkersSource = new ol.source.Vector();

    // 创建本地标注图层（使用不同颜色区分）
    localMarkersLayer = new ol.layer.Vector({
        source: localMarkersSource,
        name: 'local-markers',
        style: new ol.style.Style({
            image: new ol.style.Icon({
                anchor: [0.5, 1],
                src: 'data:image/svg+xml;base64,' + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
                        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 32 16 32s16-20.5 16-32C32 7.163 24.837 0 16 0z" fill="#0066FF" stroke="#FFFFFF" stroke-width="2"/>
                        <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
                    </svg>
                `),
                scale: 1
            })
        }),
        visible: true
    });

    // 添加到地图
    if (typeof map !== 'undefined' && map) {
        map.addLayer(localMarkersLayer);
        // 确保本地标注图层在最上层
        localMarkersLayer.setZIndex(100);
        console.log('本地标注图层已添加到地图');
    } else {
        console.warn('地图尚未初始化，本地标注图层将在地图初始化后添加');
    }

    console.log('本地标注图层初始化完成');
}

/**
 * 从 localStorage 加载本地标注
 */
function loadLocalMarkers() {
    try {
        const saved = localStorage.getItem(LOCAL_MARKERS_KEY);
        if (saved) {
            const markers = JSON.parse(saved);

            // 清空现有标注
            if (localMarkersSource) {
                localMarkersSource.clear();
            }
            localMarkersVector = {};

            // 找到最大ID用于计数器
            let maxId = 0;

            // 添加所有标注到地图
            markers.forEach(function(marker) {
                addLocalMarkerToMap(marker);
                if (marker.id > maxId) {
                    maxId = marker.id;
                }
            });

            localMarkerIdCounter = maxId;
            console.log('已从本地存储加载', markers.length, '个标注');
            return markers;
        }
    } catch (e) {
        console.warn('加载本地标注失败:', e);
    }
    return [];
}

/**
 * 保存本地标注到 localStorage
 */
function saveLocalMarkers() {
    try {
        const markers = [];
        for (var id in localMarkersVector) {
            if (localMarkersVector.hasOwnProperty(id)) {
                var feature = localMarkersVector[id];
                var props = feature.getProperties();
                markers.push({
                    id: props.id,
                    name: props.name,
                    description: props.description,
                    longitude: props.longitude,
                    latitude: props.latitude,
                    createdAt: props.createdAt
                });
            }
        }
        localStorage.setItem(LOCAL_MARKERS_KEY, JSON.stringify(markers));
        console.log('已保存', markers.length, '个标注到本地存储');
    } catch (e) {
        console.warn('保存本地标注失败:', e);
        showPopup('保存标注失败: ' + e.message);
    }
}

/**
 * 在地图上添加本地标注
 * @param {Object} markerData - 标注数据
 */
function addLocalMarkerToMap(markerData) {
    // 确保图层已初始化
    if (!localMarkersLayer) {
        initLocalMarkersLayer();
    }

    // 再次检查图层是否成功初始化
    if (!localMarkersLayer || !localMarkersSource) {
        console.error('本地标注图层初始化失败，无法添加标注');
        return;
    }

    // 将WGS84坐标转换为地图投影坐标
    const coordinate = ol.proj.fromLonLat([markerData.longitude, markerData.latitude]);

    // 创建标注要素
    const feature = new ol.Feature({
        geometry: new ol.geom.Point(coordinate),
        id: markerData.id,
        name: markerData.name,
        description: markerData.description,
        longitude: markerData.longitude,
        latitude: markerData.latitude,
        createdAt: markerData.createdAt || new Date().toISOString(),
        isLocal: true // 标记为本地标注
    });

    // 添加到数据源
    localMarkersSource.addFeature(feature);

    // 存储引用
    localMarkersVector[markerData.id] = feature;

    console.log('本地标注已添加到地图:', markerData.name, coordinate);
}

/**
 * 在指定坐标添加本地标注
 * @param {Array<number>} coordinate - 坐标 [x, y] (地图投影)
 */
function addLocalMarkerAtCoordinate(coordinate) {
    // 将坐标转换为WGS84地理坐标用于存储
    const lonLat = ol.proj.toLonLat(coordinate);
    const longitude = lonLat[0];
    const latitude = lonLat[1];

    // 弹出输入框让用户输入标注信息
    showLocalMarkerDialog(longitude, latitude);
}

/**
 * 显示本地标注添加对话框
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 */
function showLocalMarkerDialog(longitude, latitude) {
    // 创建对话框
    var dialog = document.createElement('div');
    dialog.className = 'local-marker-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay" onclick="closeLocalMarkerDialog()"></div>
        <div class="dialog-content">
            <h3>添加本地标注</h3>
            <div class="form-group">
                <label>标注名称:</label>
                <input type="text" id="localMarkerName" placeholder="请输入标注名称" autofocus>
            </div>
            <div class="form-group">
                <label>标注描述:</label>
                <textarea id="localMarkerDesc" placeholder="请输入标注描述（可选）"></textarea>
            </div>
            <div class="form-group">
                <label>坐标:</label>
                <span class="coordinate-display">${longitude.toFixed(6)}, ${latitude.toFixed(6)}</span>
            </div>
            <div class="dialog-buttons">
                <button onclick="saveLocalMarker(${longitude}, ${latitude})" class="btn-primary">保存</button>
                <button onclick="closeLocalMarkerDialog()" class="btn-secondary">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // 聚焦到名称输入框
    setTimeout(function() {
        var nameInput = document.getElementById('localMarkerName');
        if (nameInput) nameInput.focus();
    }, 100);
}

/**
 * 关闭本地标注对话框
 */
function closeLocalMarkerDialog() {
    var dialog = document.querySelector('.local-marker-dialog');
    if (dialog) {
        dialog.remove();
    }
}

/**
 * 保存本地标注
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 */
function saveLocalMarker(longitude, latitude) {
    var nameInput = document.getElementById('localMarkerName');
    var descInput = document.getElementById('localMarkerDesc');

    var name = nameInput ? nameInput.value.trim() : '';
    var description = descInput ? descInput.value.trim() : '';

    if (!name) {
        alert('请输入标注名称');
        return;
    }

    // 生成新ID
    localMarkerIdCounter++;

    // 创建标注数据
    var markerData = {
        id: localMarkerIdCounter,
        name: name,
        description: description || null,
        longitude: longitude,
        latitude: latitude,
        createdAt: new Date().toISOString()
    };

    // 添加到地图
    addLocalMarkerToMap(markerData);

    // 保存到本地存储
    saveLocalMarkers();

    // 关闭对话框
    closeLocalMarkerDialog();

    showPopup('本地标注 "' + name + '" 添加成功！');
    console.log('本地标注保存成功:', markerData);
}

/**
 * 显示本地标注信息
 * @param {ol.Feature} feature - 标注要素
 */
function showLocalMarkerInfo(feature) {
    var props = feature.getProperties();
    var createdDate = props.createdAt ? new Date(props.createdAt).toLocaleString('zh-CN') : '未知';

    var info = document.createElement('div');
    info.className = 'marker-info local-marker-info';
    info.innerHTML = `
        <h3>${props.name || '未命名标注'}</h3>
        ${props.description ? '<p class="description">' + props.description + '</p>' : ''}
        <p><strong>坐标:</strong> ${props.longitude.toFixed(6)}, ${props.latitude.toFixed(6)}</p>
        <p><strong>创建时间:</strong> ${createdDate}</p>
        <p class="local-badge">本地存储</p>
        <div class="marker-actions">
            <button onclick="editLocalMarker(${props.id})" class="marker-edit-btn">编辑</button>
            <button onclick="deleteLocalMarker(${props.id})" class="marker-delete-btn">删除</button>
        </div>
    `;

    showPopup(info.outerHTML);
}

/**
 * 编辑本地标注
 * @param {number} markerId - 标注ID
 */
function editLocalMarker(markerId) {
    var feature = localMarkersVector[markerId];
    if (!feature) {
        alert('标注不存在');
        return;
    }

    var props = feature.getProperties();

    // 关闭当前弹窗
    closeCurrentPopup();

    // 创建编辑对话框
    var dialog = document.createElement('div');
    dialog.className = 'local-marker-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay" onclick="closeLocalMarkerDialog()"></div>
        <div class="dialog-content">
            <h3>编辑本地标注</h3>
            <div class="form-group">
                <label>标注名称:</label>
                <input type="text" id="localMarkerName" value="${props.name || ''}" autofocus>
            </div>
            <div class="form-group">
                <label>标注描述:</label>
                <textarea id="localMarkerDesc">${props.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>坐标:</label>
                <span class="coordinate-display">${props.longitude.toFixed(6)}, ${props.latitude.toFixed(6)}</span>
            </div>
            <div class="dialog-buttons">
                <button onclick="updateLocalMarker(${markerId})" class="btn-primary">更新</button>
                <button onclick="closeLocalMarkerDialog()" class="btn-secondary">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
}

/**
 * 更新本地标注
 * @param {number} markerId - 标注ID
 */
function updateLocalMarker(markerId) {
    var nameInput = document.getElementById('localMarkerName');
    var descInput = document.getElementById('localMarkerDesc');

    var name = nameInput ? nameInput.value.trim() : '';
    var description = descInput ? descInput.value.trim() : '';

    if (!name) {
        alert('请输入标注名称');
        return;
    }

    var feature = localMarkersVector[markerId];
    if (feature) {
        // 更新属性
        feature.set('name', name);
        feature.set('description', description || null);

        // 保存到本地存储
        saveLocalMarkers();

        // 关闭对话框
        closeLocalMarkerDialog();

        showPopup('标注 "' + name + '" 更新成功！');
        console.log('本地标注更新成功:', markerId);
    }
}

/**
 * 删除本地标注
 * @param {number} markerId - 标注ID
 */
function deleteLocalMarker(markerId) {
    if (!confirm('确定要删除这个本地标注吗？')) {
        return;
    }

    var feature = localMarkersVector[markerId];
    if (feature) {
        var name = feature.get('name');

        // 从数据源移除
        localMarkersSource.removeFeature(feature);

        // 删除引用
        delete localMarkersVector[markerId];

        // 保存到本地存储
        saveLocalMarkers();

        // 关闭弹窗
        closeCurrentPopup();

        showPopup('标注 "' + name + '" 已删除');
        console.log('本地标注删除成功:', markerId);
    }
}

/**
 * 切换本地标注添加模式
 * @returns {boolean} 当前是否处于添加模式
 */
function toggleLocalMarkerMode() {
    // 检查地图是否已初始化
    if (typeof map === 'undefined' || !map) {
        alert('地图尚未初始化，请稍后再试');
        return false;
    }

    isLocalMarkerMode = !isLocalMarkerMode;
    var btn = document.getElementById('addLocalMarkerBtn');

    if (isLocalMarkerMode) {
        // 确保图层已初始化
        if (!localMarkersLayer) {
            initLocalMarkersLayer();
        }

        map.getViewport().style.cursor = 'crosshair';
        if (btn) {
            btn.textContent = '退出本地标注';
            btn.style.background = '#0066FF';
        }
        showPopup('点击地图添加本地标注，数据将保存在浏览器中');
    } else {
        map.getViewport().style.cursor = '';
        if (btn) {
            btn.textContent = '本地标注';
            btn.style.background = '';
        }
    }

    return isLocalMarkerMode;
}

/**
 * 切换本地标注图层显示/隐藏
 */
function toggleLocalMarkersVisibility() {
    if (localMarkersLayer) {
        var visible = !localMarkersLayer.getVisible();
        localMarkersLayer.setVisible(visible);
        localStorage.setItem(LOCAL_MARKERS_VISIBLE_KEY, visible);

        var btn = document.getElementById('toggleLocalMarkersBtn');
        if (btn) {
            btn.textContent = visible ? '隐藏本地标注' : '显示本地标注';
        }

        showPopup(visible ? '本地标注已显示' : '本地标注已隐藏');
    }
}

/**
 * 导出本地标注为 GeoJSON
 */
function exportLocalMarkers() {
    var features = [];
    for (var id in localMarkersVector) {
        if (localMarkersVector.hasOwnProperty(id)) {
            var feature = localMarkersVector[id];
            var props = feature.getProperties();
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [props.longitude, props.latitude]
                },
                properties: {
                    name: props.name,
                    description: props.description,
                    createdAt: props.createdAt
                }
            });
        }
    }

    var geojson = {
        type: 'FeatureCollection',
        features: features
    };

    var blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'local-markers-' + new Date().toISOString().slice(0, 10) + '.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showPopup('已导出 ' + features.length + ' 个标注');
}

/**
 * 导入 GeoJSON 标注
 * @param {File} file - GeoJSON 文件
 */
function importLocalMarkers(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var geojson = JSON.parse(e.target.result);
            var count = 0;

            if (geojson.type === 'FeatureCollection' && geojson.features) {
                geojson.features.forEach(function(feature) {
                    if (feature.geometry && feature.geometry.type === 'Point') {
                        var coords = feature.geometry.coordinates;
                        localMarkerIdCounter++;

                        var markerData = {
                            id: localMarkerIdCounter,
                            name: feature.properties.name || '导入标注 ' + localMarkerIdCounter,
                            description: feature.properties.description || null,
                            longitude: coords[0],
                            latitude: coords[1],
                            createdAt: feature.properties.createdAt || new Date().toISOString()
                        };

                        addLocalMarkerToMap(markerData);
                        count++;
                    }
                });

                saveLocalMarkers();
                showPopup('成功导入 ' + count + ' 个标注');
            }
        } catch (err) {
            alert('导入失败: ' + err.message);
        }
    };
    reader.readAsText(file);
}

/**
 * 清空所有本地标注
 */
function clearAllLocalMarkers() {
    if (!confirm('确定要清空所有本地标注吗？此操作不可恢复！')) {
        return;
    }

    if (localMarkersSource) {
        localMarkersSource.clear();
    }
    localMarkersVector = {};
    localMarkerIdCounter = 0;

    localStorage.removeItem(LOCAL_MARKERS_KEY);

    showPopup('所有本地标注已清空');
}

/**
 * 显示本地标注管理对话框
 */
function showLocalMarkersManager() {
    var markers = [];
    for (var id in localMarkersVector) {
        if (localMarkersVector.hasOwnProperty(id)) {
            var feature = localMarkersVector[id];
            var props = feature.getProperties();
            markers.push({
                id: props.id,
                name: props.name,
                description: props.description,
                longitude: props.longitude,
                latitude: props.latitude,
                createdAt: props.createdAt
            });
        }
    }

    // 按创建时间排序
    markers.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var listHtml = markers.map(function(m) {
        return `
            <div class="marker-list-item">
                <div class="marker-info">
                    <strong>${m.name}</strong>
                    <span class="marker-coords">${m.longitude.toFixed(4)}, ${m.latitude.toFixed(4)}</span>
                </div>
                <div class="marker-actions">
                    <button onclick="zoomToLocalMarker(${m.id})" title="定位">📍</button>
                    <button onclick="editLocalMarker(${m.id})" title="编辑">✏️</button>
                    <button onclick="deleteLocalMarker(${m.id})" title="删除">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    var dialog = document.createElement('div');
    dialog.className = 'local-marker-dialog manager-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay" onclick="closeLocalMarkerDialog()"></div>
        <div class="dialog-content">
            <h3>本地标注管理 (${markers.length}个)</h3>
            <div class="marker-list">
                ${listHtml || '<p class="empty-message">暂无本地标注</p>'}
            </div>
            <div class="dialog-buttons">
                <button onclick="exportLocalMarkers()" class="btn-secondary">导出 GeoJSON</button>
                <label class="btn-secondary file-input-label">
                    导入 GeoJSON
                    <input type="file" accept=".json,.geojson" onchange="handleImportFile(this)" style="display:none">
                </label>
                <button onclick="clearAllLocalMarkers()" class="btn-danger">清空全部</button>
                <button onclick="closeLocalMarkerDialog()" class="btn-primary">关闭</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
}

/**
 * 处理导入文件
 * @param {HTMLInputElement} input - 文件输入元素
 */
function handleImportFile(input) {
    if (input.files && input.files[0]) {
        importLocalMarkers(input.files[0]);
        closeLocalMarkerDialog();
    }
}

/**
 * 定位到指定标注
 * @param {number} markerId - 标注ID
 */
function zoomToLocalMarker(markerId) {
    var feature = localMarkersVector[markerId];
    if (feature && map) {
        var geometry = feature.getGeometry();
        var coordinate = geometry.getCoordinates();

        map.getView().animate({
            center: coordinate,
            zoom: 16,
            duration: 500
        });

        closeLocalMarkerDialog();
    }
}

/**
 * 初始化本地标注系统
 */
function initLocalMarkers() {
    // 检查地图是否已初始化
    if (typeof map === 'undefined' || !map) {
        console.warn('地图尚未初始化，延迟初始化本地标注系统');
        // 延迟重试
        setTimeout(initLocalMarkers, 200);
        return;
    }

    // 初始化图层
    initLocalMarkersLayer();

    // 加载已保存的标注
    loadLocalMarkers();

    // 恢复显示状态
    var visible = localStorage.getItem(LOCAL_MARKERS_VISIBLE_KEY);
    if (visible !== null && localMarkersLayer) {
        localMarkersLayer.setVisible(visible === 'true');
    }

    console.log('本地标注系统初始化完成');
}
