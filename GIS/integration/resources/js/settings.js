/**
 * 设置面板功能
 */

/**
 * 显示设置面板
 */
function showSettings() {
    // 检查设置面板是否已经存在
    if (document.querySelector('.setting_')) {
        return;
    }


    // 创建设置元素
    const setting = document.createElement('div');
    setting.className = 'setting_';

    setting.innerHTML = `<h3>图层设置</h3>` +
                    `<div>实验功能，可能暂不可用</div>` +
                     `<div class="settings-section">` +
                     `  <h4>GeoServer 配置</h4>` +
                     `  <label class="settings-label">服务器地址:</label>` +
                     `  <input type="text" id="geoserverUrl" class="settings-input" placeholder="http://localhost:3001" value="${geoserverConfig.url}">` +
                     `  <label class="settings-label">工作空间 (可选):</label>` +
                     `  <input type="text" id="geoserverWorkspace" class="settings-input" placeholder="留空获取所有工作空间" value="${geoserverConfig.workspace}">` +
                     `  <button id="saveGeoServerConfig" class="settings-button">保存配置并刷新图层列表</button>` +
                     `</div>` +
                     `<div class="settings-section">` +
                     `  <label class="settings-label">添加 GeoServer 图层:</label>` +
                     `  <select id="layerSelect" class="settings-select" disabled>` +
                     `    <option value="">点击"保存配置"加载图层列表</option>` +
                     `  </select>` +
                     `  <button id="addLayerBtn" class="settings-button" disabled>从列表添加图层</button>` +
                     `  <div class="settings-divider">` +
                     `    <label class="settings-label-bold">或手动输入图层信息:</label>` +
                     `    <input type="text" id="manualWorkspace" class="settings-input" placeholder="工作空间 (如: test)" value="">` +
                     `    <input type="text" id="manualLayerName" class="settings-input" placeholder="图层名称 (如: test_polygon)">` +
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

    // 绑定关闭按钮事件
    document.getElementById('closeSettings').addEventListener('click', function() {
        if (document.body.contains(setting)) {
            document.body.removeChild(setting);
        }
    });

    // 绑定保存配置按钮事件
    document.getElementById('saveGeoServerConfig').addEventListener('click', async function() {
        const url = document.getElementById('geoserverUrl').value.trim();
        const workspace = document.getElementById('geoserverWorkspace').value.trim();

        if (!url) {
            alert('请输入GeoServer地址');
            return;
        }

        // 保存配置
        saveGeoServerConfig({ url, workspace });

        // 更新UI状态
        const layerSelect = document.getElementById('layerSelect');
        const addLayerBtn = document.getElementById('addLayerBtn');

        layerSelect.innerHTML = '<option value="">正在加载图层列表...</option>';
        layerSelect.disabled = true;
        addLayerBtn.disabled = true;

        try {
            // 添加20秒超时
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('请求超时(20秒)')), 20000);
            });
            const layers = await Promise.race([fetchLayersFromGeoServer(workspace), timeoutPromise]);

            if (layers.length === 0) {
                layerSelect.innerHTML = '<option value="">未找到图层，请检查配置</option>';
            } else {
                let options = '<option value="">-- 请选择图层 --</option>';
                layers.forEach(layer => {
                    const value = layer.workspace + ':' + layer.name;
                    options += `<option value="${value}" data-workspace="${layer.workspace}" data-name="${layer.name}">${layer.displayName} (${value})</option>`;
                });
                layerSelect.innerHTML = options;
                layerSelect.disabled = false;
                addLayerBtn.disabled = false;
            }

            alert('配置已保存');
        } catch (error) {
            console.error('获取图层列表失败:', error);
            layerSelect.innerHTML = `<option value="">错误: ${error.message}</option>`;
            alert('获取图层列表失败: ' + error.message);
        }
    });

    // 绑定添加图层按钮事件
    document.getElementById('addLayerBtn').addEventListener('click', function() {
        const select = document.getElementById('layerSelect');
        const option = select.options[select.selectedIndex];

        if (option && option.value) {
            addWMSLayer(option.getAttribute('data-name'), option.getAttribute('data-workspace'));
            updateSettingsPanel();
        } else {
            alert('请先选择一个图层');
        }
    });

    // 绑定手动添加图层按钮事件
    document.getElementById('addManualLayerBtn').addEventListener('click', function() {
        const workspace = document.getElementById('manualWorkspace').value.trim();
        const layerName = document.getElementById('manualLayerName').value.trim();

        if (!workspace || !layerName) {
            alert('请输入工作空间和图层名称');
            return;
        }

        addWMSLayer(layerName, workspace);
        document.getElementById('manualLayerName').value = '';
        updateSettingsPanel();
    });

    // 初始化已添加图层列表
    updateSettingsPanel();
}

/**
 * 更新设置面板中的已添加图层列表
 */
function updateSettingsPanel() {
    const container = document.getElementById('addedLayersList');
    if (!container) return;

    if (Object.keys(wmsLayers).length === 0) {
        container.innerHTML = '<p class="empty-message">暂无图层</p>';
        return;
    }

    let html = '';
    Object.keys(wmsLayers).forEach(layerName => {
        const info = wmsLayers[layerName];
        const visible = info.layer.getVisible();
        const opacity = info.layer.getOpacity();

        html += `
            <div class="layer-item">
                <label>
                    <input type="checkbox" ${visible ? 'checked' : ''} onchange="toggleWMSLayer('${layerName}', this.checked)">
                    <span>${info.fullName}</span>
                    <button onclick="removeWMSLayer('${layerName}'); updateSettingsPanel();" class="layer-remove-btn">移除</button>
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

    container.innerHTML = html;
}

/**
 * 设置按钮点击处理
 */
function Settting() {
    showSettings();
}
