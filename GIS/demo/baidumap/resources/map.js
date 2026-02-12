// 移除CSS导入语句
// import popup_ from './resources/css/popup.css';

var map;
var point
// GIS地图初始化和显示的JavaScript代码
function initMap() {
    console.log('初始化GIS地图...');
    
    // 这里可以添加地图初始化代码
    // 例如使用Leaflet、OpenLayers或其他GIS库
    
    // 简单示例：给地图容器添加一些基本内容
    //const mapFrame = document.getElementById('mapFrame');
    //if (mapFrame) {
    //    mapFrame.innerHTML = '<h2>GIS地图将在这里显示，请点击“显示地图”按钮。</h2><h2>↓↓↓</h2></div><h2>↓↓↓</h2></div><h2>↓↓↓</h2>';
    //}
    // setTimeout(() => {
    //     // 显示弹出窗口
    //     message_ = `
    //     <h3>GIS地图信息</h3>
    //     <p>这是一个GIS地图应用的弹出窗口。</p>
    // `;
    //     showPopup(message_);
    //     }, 1000)
    // 每隔 2 秒执行一次任务
    // setInterval(() => {
    //     showPopup();
    // }, 2000);
  
    
    console.log('GIS地图初始化完成');
}
// 创建并显示弹出窗口的函数
// 修改showPopup函数，直接使用CSS类名
function showPopup(content_) {
    // 检查设置面板是否已经存在
    if (document.querySelector('.popup_ ')) {
        return; // 如果已存在，则退出函数
    }
    // 创建弹出窗口元素
    const popup = document.createElement('div');
    popup.className = 'popup_'; // 直接使用CSS类名
    
    // 设置弹出窗口内容，添加倒计时提示
    popup.innerHTML = content_ + 
                     `<div class="popup_-timer">10秒后自动关闭</div>` +
                     `<button id="closePopup" class="popup_-close">关闭</button>`;
    
    // 添加关闭按钮事件
    document.body.appendChild(popup);
    const closeButton = document.getElementById('closePopup');
    
    // 定义移除弹窗的函数
    const removePopup = function() {
        if (document.body.contains(popup)) {
            document.body.removeChild(popup);
        }
    };
    
    // 添加手动关闭事件
    closeButton.addEventListener('click', removePopup);
    
    // 设置10秒后自动关闭的定时器
    const autoCloseTimer = setTimeout(removePopup, 10000);
    
    
    
    // 当手动关闭时，清除自动关闭和倒计时的定时器
    closeButton.addEventListener('click', function() {
        clearTimeout(autoCloseTimer);
    });
}

function showSettings() {
    // 检查设置面板是否已经存在
    if (document.querySelector('.Setting_')) {
        return; // 如果已存在，则退出函数
    }
    
    // 创建设置元素
    const setting = document.createElement('div');
    setting.className = 'setting_'; // 直接使用CSS类名
    
    // 设置弹出窗口内容 - 添加图层开关
    setting.innerHTML = `<h3>设置界面</h3>` +
                     `<p>图层设置</p>` +
                     `<div class="setting-options">` +
                     `  <label class="toggle-label">` +
                     `    <input type="checkbox" id="layer1Toggle" checked> 普通地图` +
                     `  </label>` +
                     `  <label class="toggle-label">` +
                     `    <input type="checkbox" id="layer2Toggle"> 卫星地图` +
                     `  </label>` +
                     `<p>视角设置</p>` +
                     `  <label class="toggle-label">` +
                    `    <input type="checkbox" id="layer3Toggle"> 3D地图` +
                    `  </label>` +
                    `  <label class="toggle-label">` +
                    `    <input type="checkbox" id="layer4Toggle">4Toggle` +
                    `  </label>` +
                     `</div>` +
                     `<button id="closeSettings" class="setting_-close">关闭</button>`;
    
    // 添加关闭按钮事件
    document.body.appendChild(setting);
    const closeButton = document.getElementById('closeSettings');
    
    // 添加开关事件监听
    const setupToggleListeners = () => {
        const layer1Toggle = document.getElementById('layer1Toggle');
        const layer2Toggle = document.getElementById('layer2Toggle');
        const layer3Toggle = document.getElementById('layer3Toggle');
        const layer4Toggle = document.getElementById('layer4Toggle');

        if (layer1Toggle) {
            layer1Toggle.addEventListener('change', function() {
                console.log('普通地图切换状态:', this.checked ? '开启' : '关闭');                
                     
                      map.setMapType(BMAP_NORMAL_MAP);
                      layer2Toggle.checked = false;
                // 这里可以添加实际切换图层的代码
            });
        }
        
        if (layer2Toggle) {
            layer2Toggle.addEventListener('change', function() {
                console.log('卫星地图切换状态:', this.checked ? '开启' : '关闭');
                // 这里可以添加实际切换图层的代码
                //mapType.value = 'BMAP_SATELLITE_MAP'
                map.setMapType(BMAP_SATELLITE_MAP);
                layer1Toggle.checked = false;

            });
        }
        
        if (layer3Toggle) {
            layer3Toggle.addEventListener('change', function() {
                console.log('3D地图切换状态:', this.checked ? '开启' : '关闭');
                // 问题出在 if (layer3Toggle.checked = true) 这里使用了赋值运算符=，而不是比较运算符==或===，导致每次切换都会把checked设为true，取消无效
                if(layer3Toggle.checked === true){
                    // 这里可以添加实际切换图层的代码
                   // map.centerAndZoom(point, 19);
                   // map.enableScrollWheelZoom(true);
                    map.setHeading(64.5);
                    map.setTilt(73);
                }
                else{
                    //map.centerAndZoom(point, 15);
                    //map.enableScrollWheelZoom(true);
                    map.setHeading(0);
                    map.setTilt(0);
                    //layer3Toggle.checked = false;
                }
            });
        }
        if (layer4Toggle) {layer4Toggle.addEventListener('change', function() {
            console.log('4Toggle切换状态:', this.checked ? '开启' : '关闭');
            // 问题出在 if (layer3Toggle.checked = true) 这里使用了赋值运算符=，而不是比较运算符==或===，导致每次切换都会把checked设为true，取消无效
            if(layer4Toggle.checked === true){
              
            }
            else{
           

            }
        });
        }
    };
    
    // 设置开关监听器
    setupToggleListeners();
    
    // 定义移除弹窗的函数
    const removeSettings = function() {
        if (document.body.contains(setting)) {
            document.body.removeChild(setting);
        }
    };
    
    // 添加手动关闭事件
    closeButton.addEventListener('click', removeSettings);
    
    // 手动关闭
    closeButton.addEventListener('click', function() {
        //
    });
}

// 显示地图函数
function showMap() {
    //console.log('显示地图...');
    //var map = new BMapGL.Map("container");
    
    // = document.getElementById('mapFrame');
    //if (mapFrame) {
        //mapFrame.innerHTML = '<iframe src="./resources/map2.html" width="100%" height="100%" frameborder="0"></iframe>';
        //mapFrame.innerHTML ='<object data = "http://10.4.54.70:8461/GIS/resources/map2.html" width="100%" height="100%" frameborder="0">  </object>';
    //}
}

// 显示关于信息函数
function showAbout() {
    console.log('显示关于信息...');
    //alert('GIS地图应用 v1.0\n\n这是一个简单的GIS地图演示应用。\n可以显示地图数据并提供基本的地图操作功能。');
    message_ = `<h3>GIS地图应用 v1.0</h3><p>这是一个简单的GIS地图演示应用。\n可以显示地图数据并提供基本的地图操作功能。</p><p>作者：吴陶然（合肥工业大学）</p>`;
    showPopup(message_);
}
function Settting(){
    message_ = `<h3>设置界面<h3><p>请设置图层</p>`;
    showSettings(message_);
}

// 页面加载完成后初始化地图
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

//加载百度地图
// 简单的错误处理和重试机制
var loadCount = 0;
var maxLoadCount = 3;

function init() {
    // 检查 BMapGL 对象是否存在（WebGL 版本）
    if (typeof BMapGL === 'undefined') {
        loadCount++;
        console.error('百度地图API加载失败，第' + loadCount + '次尝试');
        
        if (loadCount <= maxLoadCount) {
            // 重试加载API
            setTimeout(loadScript, 1000);
        } else {
            //document.getElementById('loading').innerHTML = '地图加载失败，请刷新页面重试';
        }
        return;
    }
    
    try {
        console.log('开始初始化地图');
        // 检查地图容器是否存在，避免在不存在时调用BMapGL抛出不可预期的错误
        var containerElem = document.getElementById('container');
        if (!containerElem) {
            console.error('地图容器 #container 未找到，初始化中止');
            var loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.innerHTML = '地图容器未找到，初始化中止';
            return;
        }

        // 创建 WebGL 地图实例
        map = new BMapGL.Map("container");
        
        // 创建点坐标
        point = new BMapGL.Point(117.9115, 31.3916);
        
        // 初始化地图，设置中心点坐标和地图级别
        map.centerAndZoom(point, 15);
        
        // 添加控件
        //map.addControl(new BMapGL.NavigationControl());
        var scaleCtrl = new BMapGL.ScaleControl();  // 添加比例尺控件
        map.addControl(scaleCtrl);
        var zoomCtrl = new BMapGL.ZoomControl();  // 添加缩放控件
        map.addControl(zoomCtrl);
        var cityCtrl = new BMapGL.CityListControl();  // 添加城市列表控件
        map.addControl(cityCtrl);
        // 启用滚轮放大缩小
        map.enableScrollWheelZoom(true);
        
        // 添加一个简单的标记
        var marker = new BMapGL.Marker(point);
        map.addOverlay(marker);
        
        console.log('地图初始化成功');
        document.getElementById('loading').style.display = 'none';
    } catch (e) {
        console.error('地图初始化错误:', e);
        if (e && e.stack) {
            console.error(e.stack);
        }
        var loadingEl = document.getElementById('loading');
        if (loadingEl) {
            try {
                loadingEl.innerHTML = '地图初始化失败: ' + (e && e.message ? e.message : String(e));
            } catch (ignore) {
                // ignore
            }
        }
    }
}

// 动态加载地图脚本的函数
function loadScript() {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    // 使用 WebGL 版 API（参考 map3.html）
    script.src = "https://api.map.baidu.com/api?type=webgl&v=1.0&ak=KjlNGfjB6ZrdP0XU0zWvTSn9foDwSMlK&callback=init";
    script.onload = function() {
        console.log('百度地图API脚本加载完成（onload）');
    };
    script.onerror = function(err) {
        console.error('百度地图API脚本加载失败（onerror）', err);
        var loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.innerHTML = '百度地图API脚本加载失败，请检查网络、API Key 或浏览器控制台的错误。';
        }
    };
    (document.body || document.head || document.documentElement).appendChild(script);
}

// 确保页面完全加载后初始化地图
if (window.addEventListener) {
    window.addEventListener("load", init, false);
} else if (window.attachEvent) {
    window.attachEvent("onload", init);
} else {
    window.onload = init;
}

