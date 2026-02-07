/**
 * 设置面板功能
 */

/**
 * 显示设置面板
 */
async function showSettings() {
    // 检查设置面板是否已经存在
    if (document.querySelector('.setting_')) {
        return; // 如果已存在，则退出函数
    }
    
    // 创建设置元素
    const setting = document.createElement('div');
    setting.className = 'setting_'; // 直接使用CSS类名
    
    // 先显示加载状态
    setting.innerHTML = `<h3>图层设置</h3>` +
                     `<div class="settings-section">` +
                     `  <label class="settings-label">添加 GeoServer 图层:</label>` +
                     `  <select id="layerSelect" class="settings-select" disabled>` +
                     `    <option value="">正在加载图层列表...</option>` +
                     `  </select>` +
                     `  <button id="addLayerBtn" class="settings-button" disabled>从列表添加图层</button>` +
                     `  <div class="settings-divider">` +
                     `    <label class="settings-label-bold">或手动输入图层信息:</label>` +
                     `    <input type="text" id="manualWorkspace" class="settings-input" placeholder="工作空间 (如: WebGIS)" value="WebGIS">` +
                     `    <input type="text" id="manualLayerName" class="settings-input" placeholder="图层名称 (如: China_boundary)">` +
                     `    <button id="addManualLayerBtn" class="settings-button">手动添加图层</button>` +
                     `  </div>` +
                     `</div>` +
                     `<div class="settings-section-title">` +
                     `  <h4>已添加的图层:</h4>` +
                     `  <div id="addedLayersList" class="added-layers-list">` +
                     `    <p class="empty-message">暂无图层</p>` +
                     `  </div>` +
                     `</div>` +
                     `<button id="closeSettings" class="setting_-close">关闭</button>`;
    
    document.body.appendChild(setting);
    
    // 从 GeoServer 获取图层列表
    const layers = await fetchLayersFromGeoServer('WebGIS');
    
    // 生成图层选择选项
    let layerOptions = '<option value="">-- 请选择图层 --</option>';
    layers.forEach(layer => {
        const value = layer.workspace + ':' + layer.name;
        layerOptions += `<option value="${value}" data-workspace="${layer.workspace}" data-name="${layer.name}">${layer.displayName} (${value})</option>`;
    });

    // 生成已添加图层的复选框列表
    let addedLayersHTML = '';
    Object.keys(wmsLayers).forEach(layerName => {
        const layerInfo = wmsLayers[layerName];
        const isVisible = layerInfo.layer.getVisible();
        const opacity = layerInfo.layer.getOpacity();
        addedLayersHTML += `
            <div class="layer-item">
                <label>
                    <input type="checkbox" class="layer-toggle" data-layer="${layerName}" ${isVisible ? 'checked' : ''}
                           onchange="toggleWMSLayer('${layerName}', this.checked)">
                    <span>${layerInfo.fullName}</span>
                    <button onclick="removeWMSLayer('${layerName}'); updateSettingsPanel();" 
                            class="layer-remove-btn">移除</button>
                </label>
                <div class="layer-opacity-control">
                    <label>不透明度: 
                        <input type="range" min="0" max="1" step="0.1" value="${opacity}" 
                               onchange="setWMSLayerOpacity('${layerName}', parseFloat(this.value))">
                        <span>${Math.round(opacity * 100)}%</span>
                    </label>
                </div>
            </div>
        `;
    });

    // 更新设置面板内容
    const layerSelect = document.getElementById('layerSelect');
    const addLayerBtn = document.getElementById('addLayerBtn');
    const addManualLayerBtn = document.getElementById('addManualLayerBtn');
    const manualWorkspace = document.getElementById('manualWorkspace');
    const manualLayerName = document.getElementById('manualLayerName');
    const addedLayersList = document.getElementById('addedLayersList');
    const closeButton = document.getElementById('closeSettings');
    
    if (layerSelect) {
        if (layers.length === 0) {
            layerSelect.innerHTML = '<option value="">无法自动加载图层列表（CORS限制），请使用下方手动输入功能</option>';
        } else {
            layerSelect.innerHTML = layerOptions;
            layerSelect.disabled = false;
        }
    }
    if (addLayerBtn) {
        addLayerBtn.disabled = layers.length === 0;
    }
    if (addedLayersList) {
        addedLayersList.innerHTML = addedLayersHTML || '<p class="empty-message">暂无图层</p>';
    }
    
    // 添加图层按钮事件（从列表选择）
    if (addLayerBtn && layerSelect) {
        addLayerBtn.addEventListener('click', function() {
            const selectedOption = layerSelect.options[layerSelect.selectedIndex];
            if (selectedOption.value) {
                const workspace = selectedOption.getAttribute('data-workspace');
                const layerName = selectedOption.getAttribute('data-name');
                addWMSLayer(layerName, workspace);
                // 更新设置面板
                updateSettingsPanel();
            } else {
                alert('请先选择一个图层');
            }
        });
    }
    
    // 手动添加图层按钮事件
    if (addManualLayerBtn && manualWorkspace && manualLayerName) {
        addManualLayerBtn.addEventListener('click', function() {
            const workspace = manualWorkspace.value.trim();
            const layerName = manualLayerName.value.trim();
            
            if (!workspace) {
                alert('请输入工作空间名称');
                return;
            }
            if (!layerName) {
                alert('请输入图层名称');
                return;
            }
            
            // 添加图层
            addWMSLayer(layerName, workspace);
            // 清空输入框
            manualLayerName.value = '';
            // 更新设置面板
            updateSettingsPanel();
        });
    }
    
    // 定义移除弹窗的函数
    const removeSettings = function() {
        if (document.body.contains(setting)) {
            document.body.removeChild(setting);
        }
    };
    
    // 添加手动关闭事件
    closeButton.addEventListener('click', removeSettings);
}

/**
 * 更新设置面板中的已添加图层列表
 */
function updateSettingsPanel() {
    const addedLayersList = document.getElementById('addedLayersList');
    if (!addedLayersList) return;

    let addedLayersHTML = '';
    Object.keys(wmsLayers).forEach(layerName => {
        const layerInfo = wmsLayers[layerName];
        const isVisible = layerInfo.layer.getVisible();
        const opacity = layerInfo.layer.getOpacity();
        addedLayersHTML += `
            <div class="layer-item">
                <label>
                    <input type="checkbox" class="layer-toggle" data-layer="${layerName}" ${isVisible ? 'checked' : ''}
                           onchange="toggleWMSLayer('${layerName}', this.checked)">
                    <span>${layerInfo.fullName}</span>
                    <button onclick="removeWMSLayer('${layerName}'); updateSettingsPanel();" 
                            class="layer-remove-btn">移除</button>
                </label>
                <div class="layer-opacity-control">
                    <label>不透明度: 
                        <input type="range" min="0" max="1" step="0.1" value="${opacity}" 
                               onchange="setWMSLayerOpacity('${layerName}', parseFloat(this.value))">
                        <span>${Math.round(opacity * 100)}%</span>
                    </label>
                </div>
            </div>
        `;
    });

    addedLayersList.innerHTML = addedLayersHTML || '<p class="empty-message">暂无图层</p>';
}

/**
 * 设置按钮点击处理
 */
function Settting(){
    showSettings();
}

