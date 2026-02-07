/**
 * 工具函数
 */

/**
 * 创建并显示弹出窗口
 * @param {string} content_ - 弹出窗口内容
 */
// 弹窗管理：防止重复弹窗
var popupTimer = null;
var currentPopup = null;

function showPopup(content_) {
    // 如果已有弹窗，先清除
    if (currentPopup && document.body.contains(currentPopup)) {
        document.body.removeChild(currentPopup);
        currentPopup = null;
    }
    
    // 清除之前的定时器
    if (popupTimer) {
        clearTimeout(popupTimer);
        popupTimer = null;
    }
    
    // 创建弹出窗口元素
    const popup = document.createElement('div');
    popup.className = 'popup_'; // 直接使用CSS类名
    currentPopup = popup; // 保存引用
    
    // 设置弹出窗口内容，添加倒计时提示
    popup.innerHTML = content_ + 
                     `<div class="popup_-timer">10秒后自动关闭</div>` +
                     `<button id="closePopup" class="popup_-close">关闭</button>`;
    
    // 添加关闭按钮事件
    document.body.appendChild(popup);
    const closeButton = document.getElementById('closePopup');
    
    // 定义移除弹窗的函数
    const removePopup = function() {
        if (currentPopup && document.body.contains(currentPopup)) {
            document.body.removeChild(currentPopup);
            currentPopup = null;
        }
        if (popupTimer) {
            clearTimeout(popupTimer);
            popupTimer = null;
        }
    };
    
    // 添加手动关闭事件（只绑定一次）
    closeButton.onclick = removePopup;
    
    // 设置10秒后自动关闭的定时器
    popupTimer = setTimeout(removePopup, 10000);
}

/**
 * 显示关于信息
 */
function showAbout() {
    console.log('显示关于信息...');
    const message_ = `<h3>GIS地图应用 v1.0</h3><p>这是一个基于 OpenLayers 的GIS地图演示应用。</p><p>底图：百度地图</p><p>支持从 GeoServer 添加 WMS 图层叠加显示。</p><p>作者：吴陶然（合肥工业大学）</p>`;
    showPopup(message_);
}

/**
 * 显示地图函数（兼容性函数）
 */
function showMap() {
    // 已由 initMap 处理
}

