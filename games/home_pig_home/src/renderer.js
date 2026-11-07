/* 渲染层：天空/远山 → 地形 → 机关 → 角色 → 屏幕层（小地图、提示）
 * 只读取游戏状态，不修改任何数据。
 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  var U = NS.U;
  var canvas = null;
  var ctx = null;

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(NS.VIEW_W * dpr);
    canvas.height = Math.round(NS.VIEW_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

    NS.SPRITES = {
      dou: document.getElementById('sp-dou'),
      tuan: document.getElementById('sp-tuan'),
      gao: document.getElementById('sp-gao')
    };
  }

  /* ============ 背景 ============ */
  function drawCloud(x, y, s) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, 58 * s, 24 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 42 * s, y + 7 * s, 38 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 44 * s, y + 6 * s, 42 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBg(g) {
    var cur = g.cur;

    var sky = ctx.createLinearGradient(0, 0, 0, NS.VIEW_H);
    sky.addColorStop(0, cur.sky[0]);
    sky.addColorStop(1, cur.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, NS.VIEW_W, NS.VIEW_H);

    // 太阳
    var sunY = 110 - g.camY * 0.04;
    var halo = ctx.createRadialGradient(150, sunY, 10, 150, sunY, 120);
    halo.addColorStop(0, 'rgba(255,244,205,0.95)');
    halo.addColorStop(0.35, 'rgba(255,235,180,0.55)');
    halo.addColorStop(1, 'rgba(255,235,180,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(150, sunY, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,222,0.95)';
    ctx.beginPath();
    ctx.arc(150, sunY, 32, 0, Math.PI * 2);
    ctx.fill();

    // 云
    for (var i = 0; i < 4; i++) {
      var cx = ((i * 300 + 140 + g.tick * 0.12) % (NS.VIEW_W + 360)) - 180;
      var cy = 86 + i * 76 + ((g.camY * 0.1 + i * 70) % 300) - 60;
      drawCloud(cx, cy, 0.8 + i * 0.18);
    }

    // 远山（贴着地面，随相机缓慢移动）
    var baseY = cur.h - g.camY - 120;
    ctx.fillStyle = 'rgba(146,176,138,0.55)';
    ctx.beginPath();
    ctx.moveTo(-100, baseY);
    for (var m = 0; m <= 6; m++) {
      var mx = -100 + m * 200;
      ctx.quadraticCurveTo(mx + 100, baseY - 150 - (m % 3) * 40, mx + 200, baseY);
    }
    ctx.lineTo(NS.VIEW_W + 100, NS.VIEW_H + 80);
    ctx.lineTo(-100, NS.VIEW_H + 80);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(120,155,110,0.55)';
    ctx.beginPath();
    ctx.moveTo(-100, baseY + 50);
    for (var n = 0; n <= 6; n++) {
      var nx = -100 + n * 200;
      ctx.quadraticCurveTo(nx + 100, baseY - 60 - (n % 2) * 30, nx + 200, baseY + 50);
    }
    ctx.lineTo(NS.VIEW_W + 100, NS.VIEW_H + 80);
    ctx.lineTo(-100, NS.VIEW_H + 80);
    ctx.closePath();
    ctx.fill();
  }

  /* ============ 地形 ============ */
  function drawGrass(p) {
    var isGround = p.style === 'ground';
    var h = isGround ? p.h : 34;

    var soil = ctx.createLinearGradient(0, p.y, 0, p.y + h);
    soil.addColorStop(0, '#c69a68');
    soil.addColorStop(0.55, '#a97a4e');
    soil.addColorStop(1, '#7b5637');
    ctx.fillStyle = soil;
    U.rrect(ctx, p.x, p.y, p.w, h, isGround ? 12 : 9);
    ctx.fill();

    ctx.fillStyle = '#7cab5c';
    U.rrect(ctx, p.x - 2, p.y - 6, p.w + 4, 14, 8);
    ctx.fill();
    ctx.fillStyle = '#9ac37a';
    U.rrect(ctx, p.x, p.y - 6, p.w, 7, 6);
    ctx.fill();

    var n = Math.max(3, Math.floor(p.w / 46));
    ctx.fillStyle = '#6b9a4c';
    for (var i = 0; i < n; i++) {
      var bx = p.x + 14 + i * ((p.w - 28) / (n > 1 ? n - 1 : 1));
      var bh = 5 + U.rnd(bx + p.y) * 9;
      ctx.beginPath();
      ctx.moveTo(bx, p.y - 4);
      ctx.lineTo(bx + 3, p.y - 4 - bh);
      ctx.lineTo(bx + 6, p.y - 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawStone(p) {
    var g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, '#b9c6c7');
    g.addColorStop(1, '#7c8f93');
    ctx.fillStyle = g;
    U.rrect(ctx, p.x, p.y, p.w, p.h, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    U.rrect(ctx, p.x + 7, p.y + 4, p.w - 14, 5, 3);
    ctx.fill();

    ctx.strokeStyle = 'rgba(74,92,96,0.35)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i++) {
      var cx = p.x + 20 + U.rnd(p.x + i * 13) * Math.max(20, p.w - 40);
      ctx.beginPath();
      ctx.moveTo(cx, p.y + 9);
      ctx.lineTo(cx - 8, p.y + 22);
      ctx.lineTo(cx + 2, p.y + 34);
      ctx.stroke();
    }
  }

  function drawWood(p) {
    var bodyH = Math.max(p.h, 18);
    var g = ctx.createLinearGradient(0, p.y, 0, p.y + bodyH);
    g.addColorStop(0, '#cf9d61');
    g.addColorStop(1, '#a1703f');
    ctx.fillStyle = g;
    U.rrect(ctx, p.x, p.y, p.w, bodyH, 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90,60,34,0.35)';
    ctx.lineWidth = 1.5;
    for (var x = p.x + 22; x < p.x + p.w; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 2);
      ctx.lineTo(x, p.y + bodyH - 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    U.rrect(ctx, p.x + 3, p.y + 2, p.w - 6, 4, 2);
    ctx.fill();
  }

  function drawPlat(g, p) {
    if (p.active === false || p.isEl) return;
    if (p.y - g.camY > NS.VIEW_H + 90 || p.y + p.h - g.camY < -90) return;

    if (p.style === 'stone') drawStone(p);
    else if (p.style === 'wood') drawWood(p);
    else drawGrass(p);
  }

  /* ============ 箱子 / 按钮 / 石栏 / 传送门 ============ */
  function drawCrate(g, cr) {
    if (cr.y - g.camY > NS.VIEW_H + 90 || cr.y + cr.h - g.camY < -90) return;

    ctx.save();
    ctx.fillStyle = 'rgba(62,44,30,0.16)';
    ctx.beginPath();
    ctx.ellipse(cr.x + cr.w / 2, cr.y + cr.h + 4, cr.w * 0.56, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    var gd = ctx.createLinearGradient(0, cr.y, 0, cr.y + cr.h);
    gd.addColorStop(0, '#dcb277');
    gd.addColorStop(1, '#a5763e');
    ctx.fillStyle = gd;
    U.rrect(ctx, cr.x, cr.y, cr.w, cr.h, 7);
    ctx.fill();

    ctx.strokeStyle = 'rgba(92,62,34,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cr.x + 8, cr.y + 8);
    ctx.lineTo(cr.x + cr.w - 8, cr.y + cr.h - 8);
    ctx.moveTo(cr.x + cr.w - 8, cr.y + 8);
    ctx.lineTo(cr.x + 8, cr.y + cr.h - 8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(92,62,34,0.75)';
    ctx.lineWidth = 2.5;
    U.rrect(ctx, cr.x + 1, cr.y + 1, cr.w - 2, cr.h - 2, 6);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    U.rrect(ctx, cr.x + 5, cr.y + 4, cr.w - 10, 5, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawGate(g, gt) {
    if (gt.y - g.camY > NS.VIEW_H + 90 || gt.y + gt.h - g.camY < -90) return;

    ctx.save();
    if (gt.open) {
      // 已经升起：只在顶端留一截栏头
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#9aa1a8';
      ctx.fillRect(gt.x, gt.y, gt.w, 10);
      for (var bx = gt.x + 4; bx < gt.x + gt.w - 4; bx += 15) {
        ctx.fillRect(bx, gt.y, 7, 30);
      }
      ctx.restore();
      return;
    }

    ctx.fillStyle = 'rgba(60,58,54,0.2)';
    ctx.fillRect(gt.x + 4, gt.y + 6, gt.w - 2, gt.h);

    ctx.fillStyle = '#5b636c';
    for (var x = gt.x + 4; x < gt.x + gt.w - 4; x += 15) {
      ctx.fillRect(x, gt.y + 8, 7, gt.h - 14);
    }
    ctx.fillStyle = '#7f868e';
    ctx.fillRect(gt.x, gt.y, gt.w, 9);
    ctx.fillRect(gt.x, gt.y + gt.h - 9, gt.w, 9);

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(gt.x, gt.y, gt.w, 3);
    ctx.restore();
  }

  function drawButton(g, b) {
    if (b.y - g.camY > NS.VIEW_H + 90 || b.y + b.h - g.camY < -90) return;

    ctx.save();
    ctx.fillStyle = '#65594b';
    ctx.fillRect(b.x - 6, b.y + b.h - 6, b.w + 12, 9);

    var gd = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (b.on) {
      gd.addColorStop(0, '#b2e694');
      gd.addColorStop(1, '#74b158');
    } else {
      gd.addColorStop(0, '#f3bb77');
      gd.addColorStop(1, '#d78b46');
    }
    ctx.fillStyle = gd;
    U.rrect(ctx, b.x, b.y + (b.on ? 5 : 0), b.w, b.h - (b.on ? 5 : 0), 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(72,60,46,0.6)';
    ctx.lineWidth = 2;
    U.rrect(ctx, b.x, b.y + (b.on ? 5 : 0), b.w, b.h - (b.on ? 5 : 0), 6);
    ctx.stroke();

    ctx.fillStyle = b.on ? '#dcffc6' : '#ffe6bd';
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y - 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(g, p, i) {
    var cx = p.x + p.w / 2;
    var cy = p.y + p.h / 2;
    var main = i === 0 ? '#6f8ce0' : '#c07ce0';

    ctx.save();

    var halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, 50);
    halo.addColorStop(0, 'rgba(255,255,255,0.9)');
    halo.addColorStop(0.45, i === 0 ? 'rgba(111,140,224,0.45)' : 'rgba(192,124,224,0.45)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 48, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    for (var k = 0; k < 3; k++) {
      var a = g.tick * 0.035 + k * Math.PI * 2 / 3;
      ctx.fillStyle = i === 0 ? '#f2f6ff' : '#fbeaff';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * p.w * 0.42, cy + Math.sin(a) * p.h * 0.4, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = main;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = main;
    ctx.font = '700 12px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('传送门', cx, p.y - 12);
    ctx.restore();
  }

  /* ============ 机关 ============ */
  function plateState(g) {
    var pl = g.cur.plate;
    if (!pl) return 0;
    // 沉木箱压住也算压到底
    for (var ci = 0; ci < g.cur.crates.length; ci++) {
      var cr = g.cur.crates[ci];
      if (cr.x + cr.w > pl.x + 8 && cr.x < pl.x + pl.w - 8 && Math.abs((cr.y + cr.h) - pl.y) < 6) return 2;
    }
    var st = 0;
    for (var i = 0; i < g.chars.length; i++) {
      var c = g.chars[i];
      if (c.home) continue;
      if (Math.abs((c.y + c.h) - pl.y) < 12 && c.x + c.w > pl.x + 8 && c.x < pl.x + pl.w - 8) {
        st = Math.max(st, c.key === 'tuan' ? 2 : 1);
      }
    }
    return st;
  }

  function drawPlate(g) {
    var pl = g.cur.plate;
    var st = plateState(g);
    var sink = st === 2 ? 7 : (st === 1 ? 3 : 0);

    ctx.fillStyle = 'rgba(60,44,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(pl.x + pl.w / 2, pl.y + 2, pl.w / 2 + 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c4a37';
    U.rrect(ctx, pl.x, pl.y - 16 + sink, pl.w, 18, 6);
    ctx.fill();

    ctx.fillStyle = st === 2 ? '#93d07d' : (st === 1 ? '#e6c66c' : '#d98b6a');
    U.rrect(ctx, pl.x + 5, pl.y - 13 + sink, pl.w - 10, 10, 5);
    ctx.fill();

    if (st === 2) {
      ctx.strokeStyle = 'rgba(147,208,125,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pl.x + pl.w / 2, pl.y - 22 + sink, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (st === 0) {
      ctx.save();
      ctx.font = '600 12px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(70,52,36,0.75)';
      ctx.fillText('团团站上来', pl.x + pl.w / 2, pl.y - 26);
      ctx.restore();
    }
  }

  function drawElevator(g) {
    var el = g.cur.elevator;

    // 吊绳与滑轮
    ctx.save();
    ctx.strokeStyle = 'rgba(96,72,48,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(el.x + 24, el.y + 6); ctx.lineTo(el.x + 24, 40);
    ctx.moveTo(el.x + el.w - 24, el.y + 6); ctx.lineTo(el.x + el.w - 24, 40);
    ctx.stroke();
    ctx.fillStyle = '#8a6a45';
    U.rrect(ctx, el.x + el.w / 2 - 26, 26, 52, 12, 5);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(50,36,24,0.22)';
    U.rrect(ctx, el.x + 4, el.y + 8, el.w - 8, 12, 6);
    ctx.fill();

    var g2 = ctx.createLinearGradient(0, el.y, 0, el.y + el.h);
    g2.addColorStop(0, '#d9a869');
    g2.addColorStop(1, '#a4713f');
    ctx.fillStyle = g2;
    U.rrect(ctx, el.x, el.y, el.w, el.h, 6);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    U.rrect(ctx, el.x + 6, el.y + 3, el.w - 12, 4, 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90,60,34,0.35)';
    ctx.lineWidth = 1.5;
    for (var x = el.x + 30; x < el.x + el.w - 10; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, el.y + 2);
      ctx.lineTo(x, el.y + el.h - 2);
      ctx.stroke();
    }

    if (el.press) {
      ctx.fillStyle = 'rgba(147,208,125,0.5)';
      U.rrect(ctx, el.x, el.y - 3, el.w, 4, 2);
      ctx.fill();
    }
  }

  function drawLever(g) {
    var lv = g.cur.lever;

    ctx.fillStyle = '#7a5a3c';
    U.rrect(ctx, lv.x + lv.w / 2 - 7, lv.y - 8, 14, 34, 5);
    ctx.fill();
    ctx.fillStyle = '#a98457';
    U.rrect(ctx, lv.x + lv.w / 2 - 4, lv.y - 8, 8, 30, 3);
    ctx.fill();

    var ang = lv.on ? -0.72 : 0.55;
    ctx.save();
    ctx.translate(lv.x + lv.w / 2, lv.y - 6);
    ctx.rotate(ang);
    ctx.fillStyle = '#c9a06a';
    U.rrect(ctx, -4, -32, 8, 34, 4);
    ctx.fill();
    ctx.fillStyle = lv.on ? '#7ec463' : '#e0603d';
    ctx.beginPath();
    ctx.arc(0, -34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!lv.on) {
      ctx.save();
      ctx.font = '600 12px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(70,52,36,0.72)';
      ctx.fillText('拉一下', lv.x + lv.w / 2, lv.y - 48);
      ctx.restore();
    }
  }

  function drawDoor(d) {
    var pulse = 0.55 + Math.sin(g_tick() * 0.05) * 0.15;

    var glow = ctx.createRadialGradient(d.x + d.w / 2, d.y + d.h * 0.55, 8,
                                        d.x + d.w / 2, d.y + d.h * 0.55, 140);
    glow.addColorStop(0, 'rgba(255,226,166,0.75)');
    glow.addColorStop(1, 'rgba(255,226,166,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(d.x + d.w / 2, d.y + d.h * 0.55, 140, 0, Math.PI * 2);
    ctx.fill();

    // 墙
    ctx.fillStyle = '#f6e3c6';
    U.rrect(ctx, d.x - 18, d.y - 8, d.w + 36, d.h + 12, 14);
    ctx.fill();

    // 屋顶
    ctx.fillStyle = '#b85c48';
    ctx.beginPath();
    ctx.moveTo(d.x - 30, d.y + 4);
    ctx.lineTo(d.x + d.w / 2, d.y - 36);
    ctx.lineTo(d.x + d.w + 30, d.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(d.x - 30, d.y + 1);
    ctx.lineTo(d.x + d.w / 2, d.y - 36);
    ctx.lineTo(d.x + d.w / 2, d.y - 29);
    ctx.lineTo(d.x - 18, d.y + 1);
    ctx.closePath();
    ctx.fill();

    // 门框与暖光
    ctx.fillStyle = '#7a4b2b';
    U.rrect(ctx, d.x + 6, d.y + 14, d.w - 12, d.h - 14, 10);
    ctx.fill();

    var light = ctx.createLinearGradient(0, d.y + 14, 0, d.y + d.h);
    light.addColorStop(0, '#ffd694');
    light.addColorStop(1, '#e79c50');
    ctx.fillStyle = light;
    U.rrect(ctx, d.x + 14, d.y + 24, d.w - 28, d.h - 24, 8);
    ctx.fill();

    // 圆窗
    ctx.fillStyle = 'rgba(255,255,255,' + pulse + ')';
    ctx.beginPath();
    ctx.arc(d.x + d.w / 2, d.y + d.h * 0.62, 11, 0, Math.PI * 2);
    ctx.fill();

    // 小旗
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(d.x + d.w / 2 - 1.5, d.y - 46, 3, 18);
    ctx.fillStyle = '#e0603d';
    ctx.beginPath();
    ctx.moveTo(d.x + d.w / 2 + 1.5, d.y - 46);
    ctx.lineTo(d.x + d.w / 2 + 22, d.y - 42);
    ctx.lineTo(d.x + d.w / 2 + 1.5, d.y - 34);
    ctx.closePath();
    ctx.fill();
  }

  // drawDoor 需要 tick，用一个小闭包变量承接当前渲染的 g
  var current = null;
  function g_tick() { return current ? current.tick : 0; }

  /* ============ 角色 ============ */

  // 按图片原始宽高比做 contain 适配：完整装进碰撞盒，不拉伸、不裁切
  function fitSprite(img, boxW, boxH, extra) {
    var k = extra || 1;
    var iw = (img && img.naturalWidth) ? img.naturalWidth : boxW;
    var ih = (img && img.naturalHeight) ? img.naturalHeight : boxH;
    var s = Math.min(boxW / iw, boxH / ih) * k;
    return { w: iw * s, h: ih * s };
  }

  function drawShadow(c) {
    if (c.home) return;
    ctx.fillStyle = 'rgba(56,40,26,0.22)';
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y + c.h + 2, c.w * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCharSprite(g, c) {
    var d = g.cur.door;

    if (c.home) {
      var hf = fitSprite(NS.SPRITES[c.key], c.w, c.h, 0.66);
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.drawImage(NS.SPRITES[c.key], d.x + d.w / 2 - hf.w / 2 + (c.idx - 1) * 7, d.y + d.h - hf.h - 4, hf.w, hf.h);
      ctx.restore();
      return;
    }

    var bob = c.onGround ? Math.abs(Math.sin(c.walk * 0.24)) * 2.6 : 0;
    var lean = c.onGround ? Math.sin(c.walk * 0.24) * 0.05 : 0;
    var img = NS.SPRITES[c.key];
    var fit = fitSprite(img, c.w, c.h, 1);

    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h - bob);
    ctx.rotate(lean);
    ctx.scale(c.face, 1);
    if (img && img.complete && img.naturalWidth) {
      // 底边对齐脚底、水平居中，等比缩放
      ctx.drawImage(img, -fit.w / 2, -fit.h, fit.w, fit.h);
    } else {
      // 图片没加载出来时的兜底色块
      ctx.fillStyle = c.color;
      U.rrect(ctx, -c.w / 2, -c.h, c.w, c.h, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTag(g, c) {
    if (c.home) return;

    for (var i = 0; i < NS.PLAYERS.length; i++) {
      if (NS.PLAYERS[i].active !== c.idx) continue;

      var p = NS.PLAYERS[i];
      var x = c.x + c.w / 2;
      var y = c.y - 12;

      ctx.save();
      ctx.font = '800 11px "PingFang SC","Microsoft YaHei",sans-serif';
      var tw = ctx.measureText(p.label).width;

      ctx.fillStyle = p.color;
      U.rrect(ctx, x - tw / 2 - 8, y - 20, tw + 16, 17, 8.5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 3);
      ctx.lineTo(x + 4, y - 3);
      ctx.lineTo(x, y + 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, x, y - 7);
      ctx.restore();
    }
  }

  function drawParticles(g) {
    for (var i = 0; i < g.dust.length; i++) {
      var d = g.dust[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, d.life / 40));
      ctx.fillStyle = d.c || 'rgba(190,160,125,0.9)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats(g) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 13px "PingFang SC","Microsoft YaHei",sans-serif';

    for (var i = 0; i < g.floats.length; i++) {
      var f = g.floats[i];
      ctx.globalAlpha = Math.min(1, f.life / 30);

      var tw = ctx.measureText(f.text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      U.rrect(ctx, f.x - tw / 2 - 8, f.y - 16, tw + 16, 22, 10);
      ctx.fill();

      ctx.fillStyle = f.color || '#3a2c22';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  /* ============ 屏幕层 ============ */
  function drawMinimap(g) {
    var mx = NS.VIEW_W - 34, top = 118, hgt = 300;
    var s = hgt / g.cur.h;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    U.rrect(ctx, mx - 6, top - 10, 12, hgt + 20, 6);
    ctx.fill();

    // 终点
    ctx.fillStyle = 'rgba(206,95,76,0.9)';
    ctx.beginPath();
    ctx.arc(mx, top + (g.cur.door.y + g.cur.door.h) * s, 4, 0, Math.PI * 2);
    ctx.fill();

    // 三只小猪的位置
    for (var i = 0; i < g.chars.length; i++) {
      var c = g.chars[i];
      ctx.fillStyle = c.home ? 'rgba(120,112,100,0.55)' : c.color;
      ctx.beginPath();
      ctx.arc(mx, top + (c.y + c.h * 0.5) * s, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 当前视野
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mx - 8, top + g.camY * s, 16, NS.VIEW_H * s);
    ctx.restore();
  }

  function drawOffscreen(g) {
    ctx.save();
    for (var i = 0; i < g.chars.length; i++) {
      var c = g.chars[i];
      if (c.home) continue;

      var sy = c.y - g.camY;
      var up = sy < -10, down = sy > NS.VIEW_H + 10;
      if (!up && !down) continue;

      var sx = U.clamp(c.x + c.w / 2, 40, NS.VIEW_W - 40);
      var ty = up ? 26 : NS.VIEW_H - 26;

      ctx.fillStyle = c.color;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(sx, ty + 14);
        ctx.lineTo(sx - 8, ty + 2);
        ctx.lineTo(sx + 8, ty + 2);
      } else {
        ctx.moveTo(sx, ty - 14);
        ctx.lineTo(sx - 8, ty - 2);
        ctx.lineTo(sx + 8, ty - 2);
      }
      ctx.closePath();
      ctx.fill();

      ctx.font = '700 11px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(c.name, sx, up ? ty + 30 : ty - 20);
    }
    ctx.restore();
  }

  function drawHint(g) {
    if (g.hintTimer <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.min(1, g.hintTimer / 60);
    ctx.font = '600 14px "PingFang SC","Microsoft YaHei",sans-serif';

    var w = ctx.measureText(g.cur.hint).width + 44;
    var x = (NS.VIEW_W - w) / 2;

    ctx.fillStyle = 'rgba(48,34,24,0.62)';
    U.rrect(ctx, x, 22, w, 38, 19);
    ctx.fill();

    ctx.fillStyle = '#fff6e4';
    ctx.textAlign = 'center';
    ctx.fillText(g.cur.hint, NS.VIEW_W / 2, 46);
    ctx.restore();
  }

  /* ============ 主入口 ============ */
  function render(g) {
    if (!ctx || !g.cur) return;
    current = g;

    drawBg(g);

    ctx.save();
    ctx.translate(0, -g.camY);

    drawDoor(g.cur.door);
    for (var i = 0; i < g.cur.plats.length; i++) drawPlat(g, g.cur.plats[i]);
    for (var pi = 0; pi < g.cur.portals.length; pi++) drawPortal(g, g.cur.portals[pi], pi);
    for (var ci = 0; ci < g.cur.crates.length; ci++) drawCrate(g, g.cur.crates[ci]);
    for (var bi = 0; bi < g.cur.buttons.length; bi++) drawButton(g, g.cur.buttons[bi]);
    for (var gi = 0; gi < g.cur.gates.length; gi++) drawGate(g, g.cur.gates[gi]);
    if (g.cur.plate) drawPlate(g);
    if (g.cur.elevator) drawElevator(g);
    if (g.cur.lever) drawLever(g);

    for (var j = 0; j < g.chars.length; j++) drawShadow(g.chars[j]);
    for (var k = 0; k < g.chars.length; k++) drawCharSprite(g, g.chars[k]);
    for (var m = 0; m < g.chars.length; m++) drawTag(g, g.chars[m]);
    drawParticles(g);
    drawFloats(g);

    ctx.restore();

    drawMinimap(g);
    drawOffscreen(g);
    drawHint(g);
  }

  NS.Renderer = { init: init, render: render };

})(window.PIG);
