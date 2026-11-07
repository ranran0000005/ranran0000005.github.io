/* 全局配置：画布尺寸、物理常量、三只小猪与两个玩家的定义 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  NS.VIEW_W = 1000;   // 逻辑画布宽
  NS.VIEW_H = 560;    // 逻辑画布高（相机视口）
  NS.GRAV = 0.58;     // 每帧重力加速度
  NS.MAXVY = 22;      // 下落速度上限

  // 碰撞盒直接写宽高：豆豆 / 团团为正方形；高高是横向长方形（原图约 164×86）
  // spd = 水平速度，jh = 起跳高度（像素），push = 能否推动箱子
  NS.CHARS = [
    { key:'dou',  name:'豆豆', note:'个子小，钻得进矮缝', w:40, h:40, spd:5.2, jh:145, push:false, color:'#e58aa4', deep:'#a8566c' },
    { key:'tuan', name:'团团', note:'身子沉，压得住机关', w:60, h:60, spd:3.7, jh:150, push:true,  color:'#dd8b46', deep:'#9d5c22' },
    { key:'gao',  name:'高高', note:'身子宽，弹跳最好',   w:76, h:40, spd:4.5, jh:175, push:false, color:'#9cbb86', deep:'#60794b' }
  ];

  // 两个人共用三只小猪：active 是当前接管的那只，换人会跳过对方正在控制的那只
  NS.PLAYERS = [
    { id:0, label:'P1', active:0, left:'KeyA', right:'KeyD', jump:'KeyW', swap:'KeyQ', color:'#3f7fd6' },
    { id:1, label:'P2', active:1, left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', swap:'KeyP', color:'#cf5f4c' }
  ];

})(window.PIG);
