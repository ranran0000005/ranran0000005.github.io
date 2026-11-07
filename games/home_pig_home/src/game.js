/* 游戏逻辑：状态机、输入落地、实心物理、机关（压板/吊篮/摇杆/按钮/栏杆/箱子/传送门）、
 * 角色间碰撞、自动换人、过关判定、相机。渲染交给 src/renderer.js。
 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  var GRAV = NS.GRAV;
  var MAXVY = NS.MAXVY;
  var U = NS.U;

  var G = {
    state: 'title',      // title | playing | levelwin | allwin
    levelIdx: 0,
    cur: null,
    chars: [],
    camY: 0,
    tick: 0,
    elapsed: 0,
    hintTimer: 0,
    keys: {},
    jumpEdge: [false, false],
    dust: [],
    floats: []
  };

  /* ================= 关卡装载 ================= */
  G.resetLevel = function (idx) {
    G.levelIdx = idx;
    var cur = NS.LEVELS[idx]();

    cur.crates = cur.crates || [];
    cur.buttons = cur.buttons || [];
    cur.gates = cur.gates || [];
    cur.portals = cur.portals || [];
    cur.bridges = cur.bridges || [];

    G.cur = cur;
    G.chars = [];

    for (var i = 0; i < NS.CHARS.length; i++) {
      var def = NS.CHARS[i];
      var sp = cur.spawn[i] || cur.spawn[0];
      G.chars.push({
        idx: i, key: def.key, name: def.name, note: def.note,
        w: def.w, h: def.h, spd: def.spd,
        jumpV: Math.sqrt(2 * GRAV * def.jh),
        push: !!def.push,
        color: def.color, deep: def.deep,
        x: sp.x, y: sp.y, sx: sp.x, sy: sp.y,
        vx: 0, vy: 0, dir: 1, face: 1,
        onGround: false, standOn: null,
        home: false,
        portalIn: false, portalCd: 0,
        walk: 0, squash: 1
      });
      G.chars[i].y = sp.y;
    }

    NS.PLAYERS[0].active = 0;
    NS.PLAYERS[1].active = 1;

    G.dust = [];
    G.floats = [];
    G.hintTimer = 260;
    G.tick = 0;

    var head = G.chars[0].y;
    G.camY = U.clamp(head - NS.VIEW_H * 0.55, -40, cur.h - NS.VIEW_H + 40);

    NS.UI.updateHud(G);
  };

  G.startRun = function (idx) {
    G.elapsed = 0;
    G.resetLevel(idx);
    G.state = 'playing';
    NS.UI.hideOverlay();
  };

  G.restartLevel = function () {
    var keep = G.elapsed;
    G.resetLevel(G.levelIdx);
    G.elapsed = keep;
    G.state = 'playing';
    NS.UI.hideOverlay();
  };

  G.advance = function () {
    if (G.state === 'title') { G.startRun(0); return; }
    if (G.state === 'levelwin') {
      if (G.levelIdx + 1 < NS.LEVELS.length) G.startRun(G.levelIdx + 1);
      else { G.state = 'allwin'; NS.UI.showWin(G); }
      return;
    }
  };

  /* ================= 换人 ================= */
  G.swapTo = function (pi) {
    var me = NS.PLAYERS[pi];
    var other = NS.PLAYERS[1 - pi];
    for (var k = 1; k <= NS.CHARS.length; k++) {
      var idx = (me.active + k) % NS.CHARS.length;
      var c = G.chars[idx];
      if (c.home) continue;                 // 已经进门的不能再换
      if (idx === other.active) continue;   // 对方正在用的那只跳过
      me.active = idx;
      G.float(c.x + c.w / 2, c.y - 18, NS.PLAYERS[pi].label + ' 接管 ' + c.name, c.color);
      NS.UI.updateHud(G);
      return;
    }
  };

  /* ================= 输入 ================= */
  G.applyInput = function () {
    for (var pi = 0; pi < 2; pi++) {
      var pl = NS.PLAYERS[pi];
      var c = G.chars[pl.active];
      if (!c || c.home) { G.jumpEdge[pi] = false; continue; }

      var left = !!G.keys[pl.left];
      var right = !!G.keys[pl.right];
      var dir = (right ? 1 : 0) - (left ? 1 : 0);

      c.vx = dir * c.spd;
      if (dir !== 0) { c.dir = dir; c.face = dir; }

      if (G.jumpEdge[pi] && c.onGround) {
        c.vy = -c.jumpV;
        c.onGround = false;
        c.standOn = null;
        c.squash = 1.25;
        for (var d = 0; d < 5; d++) {
          G.dust.push({ x: c.x + c.w / 2 + U.rnd(-14, 14), y: c.y + c.h, vx: U.rnd(-1.2, 1.2), vy: U.rnd(-2.4, -0.6), life: 26, r: U.rnd(2, 5) });
        }
      }
      G.jumpEdge[pi] = false;
    }
  };

  /* ================= 实心集合 ================= */
  G.solids = function () {
    var out = [];
    var cur = G.cur;
    var i, p;

    for (i = 0; i < cur.plats.length; i++) {
      p = cur.plats[i];
      if (p.active === false) continue;
      out.push(p);
    }
    for (i = 0; i < cur.crates.length; i++) out.push(cur.crates[i]);
    for (i = 0; i < cur.gates.length; i++) {
      if (!cur.gates[i].open) out.push(cur.gates[i]);
    }
    return out;
  };

  /* ================= 推箱子 ================= */
  G.pushCrate = function (cr, dx) {
    if (Math.abs(dx) < 0.01) return false;
    var nx = cr.x + dx;
    if (nx < 0 || nx + cr.w > G.cur.w) return false;

    var test = { x: nx, y: cr.y, w: cr.w, h: cr.h };
    var list = G.solids();
    var i, s;

    for (i = 0; i < list.length; i++) {
      s = list[i];
      if (s === cr) continue;
      if (U.overlap(test, s)) return false;
    }

    // 箱子不能被推下台子：脚下至少还要有 20 踩实
    var supported = false;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      if (s === cr) continue;
      var ov = Math.min(nx + cr.w, s.x + s.w) - Math.max(nx, s.x);
      if (ov >= 20 && Math.abs((cr.y + cr.h) - s.y) < 6) { supported = true; break; }
    }
    if (!supported) return false;

    cr.x = nx;
    return true;
  };

  G.updateCrates = function () {
    var cur = G.cur;
    for (var i = 0; i < cur.crates.length; i++) {
      var cr = cur.crates[i];
      var supported = false;
      var list = G.solids();
      for (var j = 0; j < list.length; j++) {
        var s = list[j];
        if (s === cr) continue;
        if (cr.x + cr.w > s.x + 2 && cr.x < s.x + s.w - 2 && Math.abs((cr.y + cr.h) - s.y) < 5) { supported = true; break; }
      }
      if (!supported) cr.y += 5;
    }
  };

  /* ================= 物理 ================= */
  G.physics = function (c) {
    if (c.home) return;

    var prevX = c.x;
    var prevBottom = c.y + c.h;
    var prevTop = c.y;
    var i, p;

    // 水平
    c.x += c.vx;
    if (c.x < 0) c.x = 0;
    if (c.x + c.w > G.cur.w) c.x = G.cur.w - c.w;

    var list = G.solids();
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!U.overlap(c, p)) continue;
      var vo = Math.min(c.y + c.h, p.y + p.h) - Math.max(c.y, p.y);
      if (vo <= 6) continue;               // 只是踩在顶上，不算横向挡住

      if (p.isCrate && c.push && Math.abs(c.vx) > 0.1) {
        if (G.pushCrate(p, c.vx)) { c.pushT = 8; continue; }
      }
      if (c.vx > 0) c.x = p.x - c.w;
      else if (c.vx < 0) c.x = p.x + p.w;
      else c.x = prevX;
      c.vx = 0;
    }

    // 垂直
    c.vy = Math.min(c.vy + GRAV, MAXVY);
    c.y += c.vy;
    c.onGround = false;
    c.standOn = null;

    list = G.solids();
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!U.overlap(c, p)) continue;

      if (c.vy >= 0 && prevBottom <= p.y + 8) {
        c.y = p.y - c.h;
        c.vy = 0;
        c.onGround = true;
        if (p.isEl) c.standOn = p;
      } else if (c.vy < 0 && prevTop >= p.y + p.h - 6) {
        c.y = p.y + p.h;
        c.vy = 0;
      }
    }

    if (c.x < 0) c.x = 0;
    if (c.x + c.w > G.cur.w) c.x = G.cur.w - c.w;

    // 掉出关卡
    if (c.y > G.cur.h + 160) G.respawn(c);
  };

  G.respawn = function (c) {
    c.x = c.sx;
    c.y = c.sy;
    c.vx = 0;
    c.vy = 0;
    c.portalIn = false;
    G.float(c.x + c.w / 2, c.y - 20, '回到起点', '#c0603c');
  };

  /* ================= 角色互相碰撞 ================= */
  G.resolveChars = function () {
    for (var i = 0; i < G.chars.length; i++) {
      for (var j = i + 1; j < G.chars.length; j++) {
        var a = G.chars[i], b = G.chars[j];
        if (a.home || b.home) continue;
        if (!U.overlap(a, b)) continue;

        var ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        var oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

        var top = (a.y <= b.y) ? a : b;
        var bot = (a.y <= b.y) ? b : a;

        // 从上方压下来：站到对方头上
        var gapY = top.y + top.h - bot.y;
        if (oy <= 18 && top.vy >= 0 && gapY <= 20) {
          top.y = bot.y - top.h;
          top.vy = 0;
          top.onGround = true;
          top.standOn = bot;
        } else if (ox <= oy) {
          // 横向挤开，一人一半
          var push = ox / 2 + 0.5;
          if (a.x < b.x) { a.x -= push; b.x += push; }
          else { a.x += push; b.x -= push; }
          a.x = U.clamp(a.x, 0, G.cur.w - a.w);
          b.x = U.clamp(b.x, 0, G.cur.w - b.w);
        } else {
          top.y = bot.y - top.h;
          top.vy = Math.min(top.vy, 0);
          top.onGround = true;
          top.standOn = bot;
        }
      }
    }
  };

  /* ================= 机关 ================= */
  G.updateMech = function () {
    var cur = G.cur;
    var i;

    // 压板 + 吊篮
    if (cur.plate && cur.elevator) {
      var press = false;
      for (i = 0; i < G.chars.length; i++) {
        var c = G.chars[i];
        if (c.home || !c.push) continue;               // 只有团团压得动
        if (c.x + c.w > cur.plate.x + 8 && c.x < cur.plate.x + cur.plate.w - 8 &&
            c.y + c.h >= cur.plate.y - 8 && c.y + c.h <= cur.plate.y + 16) {
          press = true;
          break;
        }
      }
      // 沉木箱压在上面同样算数
      if (!press) {
        for (i = 0; i < cur.crates.length; i++) {
          var cr0 = cur.crates[i];
          if (cr0.x + cr0.w > cur.plate.x + 8 && cr0.x < cur.plate.x + cur.plate.w - 8 &&
              Math.abs(cr0.y + cr0.h - cur.plate.y) < 6) {
            press = true;
            break;
          }
        }
      }
      var el = cur.elevator;
      el.press = press;
      var target = press ? el.yTop : el.y0;
      var prevY = el.y;
      if (el.y > target) el.y = Math.max(target, el.y - el.speed);
      else if (el.y < target) el.y = Math.min(target, el.y + el.speed);

      var dy = el.y - prevY;
      if (dy !== 0) {
        for (i = 0; i < G.chars.length; i++) {
          if (G.chars[i].standOn === el) G.chars[i].y += dy;
        }
      }
    }

    // 摇杆：拉一下永久生效，吊桥落下
    if (cur.lever && !cur.lever.on) {
      for (i = 0; i < G.chars.length; i++) {
        var ch = G.chars[i];
        if (ch.home) continue;
        if (U.overlap(ch, cur.lever)) {
          cur.lever.on = true;
          for (var b = 0; b < cur.bridges.length; b++) cur.bridges[b].active = true;
          G.float(cur.lever.x + cur.lever.w / 2, cur.lever.y - 26, '机关打开了', '#7a9c53');
          break;
        }
      }
    }

    // 按钮：踩上去永久开门
    for (i = 0; i < cur.buttons.length; i++) {
      var btn = cur.buttons[i];
      if (btn.on) continue;
      for (var j = 0; j < G.chars.length; j++) {
        var cc = G.chars[j];
        if (cc.home) continue;
        if (cc.x + cc.w > btn.x + 6 && cc.x < btn.x + btn.w - 6 &&
            cc.y + cc.h >= btn.y - 8 && cc.y + cc.h <= btn.y + 20) {
          btn.on = true;
          if (cur.gates[btn.gate]) cur.gates[btn.gate].open = true;
          G.float(btn.x + btn.w / 2, btn.y - 28, '门开了', '#7a9c53');
          break;
        }
      }
    }
  };

  // 传送门
  G.updatePortals = function () {
    var cur = G.cur;
    if (!cur.portals.length) return;

    for (var i = 0; i < G.chars.length; i++) {
      var c = G.chars[i];
      if (c.home) continue;
      if (c.portalCd > 0) { c.portalCd--; continue; }

      var inOne = false;
      for (var j = 0; j < cur.portals.length; j++) {
        var p = cur.portals[j];
        var hit = U.overlap(c, p);
        if (!hit) continue;
        inOne = true;
        if (c.portalIn) continue;                        // 站在门里不会反复传送

        var t = cur.portals[p.link];
        if (!t) continue;

        c.x = t.x + t.w / 2 - c.w / 2;
        c.y = t.y + t.h - c.h;
        c.vx = 0;
        c.vy = 0;
        c.portalIn = true;
        c.portalCd = 18;
        G.float(c.x + c.w / 2, c.y - 26, '传送！', '#6f7fd0');
        break;
      }
      if (!inOne) c.portalIn = false;
    }
  };

  /* ================= 过关 ================= */
  G.checkGoal = function () {
    var cur = G.cur;
    var d = cur.door;

    for (var i = 0; i < G.chars.length; i++) {
      var c = G.chars[i];
      if (c.home) continue;
      var cx = c.x + c.w / 2;
      if (cx > d.x + 6 && cx < d.x + d.w - 6 && c.y + c.h >= d.y + d.h - 10 && c.y + c.h <= d.y + d.h + 24) {
        c.home = true;
        c.vx = 0;
        c.vy = 0;
        G.float(cx, c.y - 20, c.name + ' 到家', '#5f8a45');
        G.autoSwitch(c);
      }
    }

    var done = 0;
    for (var j = 0; j < G.chars.length; j++) if (G.chars[j].home) done++;
    NS.UI.updateHud(G);

    if (done === G.chars.length && G.state === 'playing') {
      G.state = (G.levelIdx + 1 >= NS.LEVELS.length) ? 'allwin' : 'levelwin';
      NS.UI.showWin(G);
    }
  };

  // 进门的角色如果还有没人接管的同伴，就自动把控制权交过去
  G.autoSwitch = function (c) {
    for (var pi = 0; pi < 2; pi++) {
      var me = NS.PLAYERS[pi];
      if (me.active !== c.idx) continue;
      var other = NS.PLAYERS[1 - pi];
      for (var k = 1; k <= NS.CHARS.length; k++) {
        var idx = (c.idx + k) % NS.CHARS.length;
        var cand = G.chars[idx];
        if (cand.home) continue;
        if (idx === other.active) continue;
        me.active = idx;
        G.float(cand.x + cand.w / 2, cand.y - 22, me.label + ' 接手 ' + cand.name, cand.color);
        NS.UI.updateHud(G);
        break;
      }
    }
  };

  /* ================= 相机 ================= */
  G.updateCamera = function () {
    var sum = 0, n = 0;
    for (var i = 0; i < G.chars.length; i++) {
      if (G.chars[i].home) continue;
      sum += G.chars[i].y;
      n++;
    }
    if (!n) return;
    var target = sum / n - NS.VIEW_H * 0.55;
    target = U.clamp(target, -40, G.cur.h - NS.VIEW_H + 40);
    var k = Math.abs(target - G.camY) > 320 ? 0.45 : 0.12;
    G.camY += (target - G.camY) * k;
  };

  /* ================= 粒子 / 飘字 ================= */
  G.float = function (x, y, text, color) {
    G.floats.push({ x: x, y: y, text: text, color: color || '#5b5245', life: 90 });
  };

  G.updateParticles = function () {
    for (var i = G.dust.length - 1; i >= 0; i--) {
      var d = G.dust[i];
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.12;
      d.life--;
      if (d.life <= 0) G.dust.splice(i, 1);
    }
    for (var j = G.floats.length - 1; j >= 0; j--) {
      var f = G.floats[j];
      f.y -= 0.7;
      f.life--;
      if (f.life <= 0) G.floats.splice(j, 1);
    }
  };

  /* ================= 每帧 ================= */
  G.step = function () {
    if (G.state !== 'playing') { G.tick++; return; }

    G.tick++;
    G.elapsed += 1 / 60;
    if (G.hintTimer > 0) G.hintTimer--;

    G.applyInput();
    G.updateCrates();
    G.updateMech();

    for (var i = 0; i < G.chars.length; i++) G.physics(G.chars[i]);
    G.resolveChars();
    G.updatePortals();
    G.checkGoal();

    for (var k = 0; k < G.chars.length; k++) {
      var c = G.chars[k];
      c.walk += Math.abs(c.vx);
      c.vx = 0;  // 速度每帧重置，由输入重新给出
      c.squash += (1 - c.squash) * 0.2;
    }

    G.updateCamera();
    G.updateParticles();
  };

  NS.Game = G;

})(window.PIG);
