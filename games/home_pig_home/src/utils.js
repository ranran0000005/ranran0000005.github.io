/* 通用工具：碰撞检测、圆角矩形、伪随机、时间格式化 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  // 构造一个地形块：kind = 'oneway'（只从上方落下）| 'solid'（四面阻挡）
  NS.P = function (x, y, w, h, kind, style) {
    return {
      x: x, y: y, w: w, h: h,
      kind: kind || 'oneway',
      style: style || 'grass',
      active: true
    };
  };

  NS.U = {
    overlap: function (a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },

    clamp: function (v, min, max) {
      return v < min ? min : (v > max ? max : v);
    },

    // 圆角矩形路径（调用方负责 fill / stroke）
    rrect: function (ctx, x, y, w, h, r) {
      var rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
      ctx.lineTo(x + rad, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
      ctx.lineTo(x, y + rad);
      ctx.quadraticCurveTo(x, y, x + rad, y);
      ctx.closePath();
    },

    // 稳定的伪随机，保证画面细节每帧一致
    rnd: function (seed) {
      var s = Math.sin(seed * 127.1) * 43758.5453;
      return s - Math.floor(s);
    },

    fmtTime: function (frames) {
      var s = Math.round(frames / 60);
      var m = Math.floor(s / 60);
      var ss = s % 60;
      return m > 0 ? (m + ' 分 ' + (ss < 10 ? '0' : '') + ss + ' 秒') : (ss + ' 秒');
    }
  };

})(window.PIG);
