/**
 * 地图搜索功能
 * 使用百度地图 API 进行地点搜索并添加标注
 * 
 * 注意：API 密钥现在配置在服务器端代理 (api/baidu_proxy.php)
 * 如果代理未配置密钥，可以在这里设置（不推荐，因为会暴露在前端）
 */
// const BAIDU_API_KEY = 'KjlNGfjB6ZrdP0XU0zWvTSn9foDwSMlK'; // 浏览器端 key（已弃用）

/**
 * 搜索地点并添加标注
 * @param {string} query - 搜索关键词
 */
async function searchAndAddMarker(query) {
    if (!query || query.trim() === '') {
        alert('请输入搜索关键词');
        return;
    }
    
    const searchQuery = query.trim();
    
    try {
        // 显示搜索中提示
        const searchStatus = document.getElementById('searchStatus');
        if (searchStatus) {
            searchStatus.textContent = '搜索中...';
            searchStatus.style.display = 'block';
        }
        
        // 使用代理调用百度地图地理编码API（避免CORS问题）
        // API 密钥现在配置在服务器端代理中，更安全
        const currentPath = window.location.pathname;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        // 不传递 ak 参数，使用服务器端配置的 key
        // 使用 bd09ll 获取BD-09坐标（百度地图默认坐标系，更准确）
        const proxyUrl = basePath + `api/baidu_proxy.php?address=${encodeURIComponent(searchQuery)}&ret_coordtype=bd09ll`;
        
        console.log('正在搜索地点:', searchQuery);
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            // 尝试获取错误信息
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) {
                // 忽略 JSON 解析错误
            }
            throw new Error(errorMsg);
        }
        
        const data = await response.json();
        
        // 隐藏搜索状态
        if (searchStatus) {
            searchStatus.style.display = 'none';
        }
        
        // 检查返回状态（百度地图 API 状态码）
        if (data.status !== 0) {
            let errorMsg = '搜索失败';
            switch(data.status) {
                case 1: errorMsg = '服务器内部错误'; break;
                case 2: errorMsg = '请求参数非法'; break;
                case 3: errorMsg = '权限校验失败，请检查API密钥'; break;
                case 4: errorMsg = '配额校验失败'; break;
                case 5: errorMsg = 'ak不存在或者非法'; break;
                case 101: errorMsg = '服务禁用'; break;
                case 102: errorMsg = '不通过白名单或者安全码不对'; break;
                case 240: errorMsg = 'APP 服务被禁用。请检查：\n1. 百度地图控制台中该服务是否已启用\n2. API密钥是否有地理编码服务的权限\n3. 是否需要在控制台配置IP白名单'; break;
                default: errorMsg = `错误代码: ${data.status} - ${data.message || '未知错误'}`;
            }
            
            // 对于服务被禁用的情况，提供更详细的提示
            if (data.status === 240) {
                console.error('百度地图API错误:', data);
                console.warn('解决方案：');
                console.warn('1. 登录百度地图开放平台控制台');
                console.warn('2. 检查"应用管理" -> "我的应用"中的服务状态');
                console.warn('3. 确保"地理编码"服务已启用');
                console.warn('4. 检查IP白名单设置（如果已配置）');
                alert(errorMsg + '\n\n提示：请检查百度地图控制台中的服务配置');
            } else {
                alert(errorMsg);
                console.error('百度地图API错误:', data);
            }
            return;
        }
        
        // 检查是否有结果
        if (!data.result || !data.result.location) {
            alert('未找到相关地点，请尝试其他关键词');
            // 清除搜索框
            clearSearchInput();
            return;
        }
        
        const location = data.result.location;
        let longitude = location.lng;
        let latitude = location.lat;
        const formattedAddress = data.result.formatted_address || searchQuery;
        const precise = data.result.precise || 0; // 精度：1=精确，0=模糊
        const confidence = data.result.confidence || 0; // 可信度：0-100
        
        // API返回的是BD-09坐标（bd09ll）
        // 直接使用BD-09坐标显示（与百度地图底图一致，无偏移）
        const baiduProjection = ol.proj.get('BD-09');
        const coordinate = ol.proj.fromLonLat([longitude, latitude], baiduProjection);
        
        // 转换为WGS84用于数据库存储（如果需要标准坐标）
        const wgs84Coord = bd09ToWgs84(longitude, latitude);
        const wgs84Longitude = wgs84Coord[0];
        const wgs84Latitude = wgs84Coord[1];
        
        console.log('搜索成功:', {
            query: searchQuery,
            address: formattedAddress,
            bd09Location: { longitude, latitude },
            wgs84Location: { longitude: wgs84Longitude, latitude: wgs84Latitude },
            precise: precise,
            confidence: confidence
        });
        
        // 确保地图对象已初始化
        if (typeof map === 'undefined' || !map) {
            alert('地图未初始化，请稍后再试');
            return;
        }
        map.getView().animate({
            center: coordinate,
            zoom: Math.max(map.getView().getZoom(), 12),
            duration: 500
        });
        
        // 构建提示信息（显示BD-09坐标，但存储WGS84坐标）
        let infoMsg = `找到地点: ${formattedAddress}\n\n坐标 (BD-09): ${longitude.toFixed(6)}, ${latitude.toFixed(6)}`;
        if (confidence > 0) {
            infoMsg += `\n可信度: ${confidence}%`;
        }
        if (precise === 0) {
            infoMsg += `\n\n⚠️ 注意：此位置可能不够精确`;
        }
        infoMsg += `\n\n是否添加为标注？`;
        
        // 询问用户是否添加标注
        const addMarker = confirm(infoMsg);
        
        if (addMarker) {
            // 弹出输入框让用户输入标注名称
            const name = prompt('请输入标注名称:', formattedAddress);
            if (name && name.trim() !== '') {
                const description = prompt('请输入标注描述（可选，直接回车跳过）:') || null;
                // 保存标注到数据库（使用WGS84坐标）
                if (typeof saveMarkerToDatabase === 'function') {
                    await saveMarkerToDatabase(name.trim(), description ? description.trim() : null, wgs84Longitude, wgs84Latitude);
                } else {
                    console.error('saveMarkerToDatabase 函数未定义');
                    alert('保存标注功能不可用');
                }
                // 清除搜索框
                clearSearchInput();
            }
        } else {
            // 即使不添加标注，也在地图上临时显示位置（3秒后消失）
            showTemporaryMarker(coordinate, formattedAddress, longitude, latitude);
        }
        
    } catch (error) {
        console.error('搜索地点时出错:', error);
        const searchStatus = document.getElementById('searchStatus');
        if (searchStatus) {
            searchStatus.style.display = 'none';
        }
        
        // 检查是否是代理错误
        let errorMsg = error.message;
        if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
            errorMsg = '网络连接失败，请检查：\n1. 网络连接是否正常\n2. 代理服务器 api/baidu_proxy.php 是否可访问\n3. 服务器是否支持 cURL';
        }
        
        alert('搜索失败: ' + errorMsg + '\n\n请检查网络连接或稍后重试');
    }
}

/**
 * 显示临时标记（不保存到数据库）
 */
function showTemporaryMarker(coordinate, formattedAddress, longitude, latitude) {
    if (typeof markersSource === 'undefined' || !markersSource) {
        console.error('markersSource 未定义');
        return;
    }
    
    const tempFeature = new ol.Feature({
        geometry: new ol.geom.Point(coordinate),
        temporary: true
    });
    
    const tempStyle = new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            src: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
                    <path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 32 16 32s16-20.5 16-32C32 7.163 24.837 0 16 0z" fill="#00AA00" stroke="#FFFFFF" stroke-width="2"/>
                    <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
                </svg>
            `),
            scale: 1
        })
    });
    
    tempFeature.setStyle(tempStyle);
    markersSource.addFeature(tempFeature);
    
    // 3秒后移除临时标记
    setTimeout(() => {
        markersSource.removeFeature(tempFeature);
    }, 3000);
    
    if (typeof showPopup === 'function') {
        showPopup(`搜索结果: ${formattedAddress}<br>坐标: ${longitude.toFixed(6)}, ${latitude.toFixed(6)}`);
    }
}

/**
 * 清除搜索输入框
 */
function clearSearchInput() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
        searchInput.value = '';
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
}

/**
 * 处理搜索（从界面调用）
 */
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.trim() : '';
    if (query) {
        searchAndAddMarker(query);
    } else {
        alert('请输入搜索关键词');
        if (searchInput) {
            searchInput.focus();
        }
    }
}

/**
 * 清除搜索
 */
function clearSearch() {
    clearSearchInput();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.focus();
    }
}

// 页面加载完成后初始化搜索功能
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput && clearBtn) {
        // 监听搜索框输入，显示/隐藏清除按钮
        searchInput.addEventListener('input', function() {
            if (this.value.trim() !== '') {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
        });
        
        // 支持回车键搜索
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
    }
});

