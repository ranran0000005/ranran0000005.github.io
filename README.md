# This is my website project.

## 简介
#### 这是一个纯前端WebGIS项目（当然还夹带了大量私货），地址是https://kjjfpt.top/GIS/integration

## 常见问题解答
### WebGPU不可用，提示浏览器版本低或无法获取图形适配器，可能原因：
#### 1.浏览器未开启 WebGPU 标志（最常见）
  使用的 Chrome/Edge 版本虽然较新，但 WebGPU 默认未启用。
  解决方案：
  地址栏输入 chrome://flags/#enable-unsafe-webgpu → 改为 Enabled → 重启浏览器。（或edge://flags/#enable-unsafe-webgpu）
#### 2.显卡驱动过旧或存在冲突
  解决方案：
  更新显卡驱动
  检查 chrome://gpu 中 Vulkan 和 D3D12 是否正常 
#### 3.虚拟机/远程桌面/无 GPU 环境/GPU不兼容
  不用WebGPU即可，其实目前GPU算的还没有CPU快，何况是旧显卡
