/* 关卡数据：6 个垂直场景，从谷底一路爬到门口
 *
 * 统一规则（改关卡时守住）：
 *   1. 所有地形都是实心块：不能从下方穿过，跳跃时会被顶到；
 *   2. 空档左沿逐级错开：左台右沿在 440 / 530 之间交替，右台左沿固定 560，
 *      于是每一级中间的缝位置都不一样，掉下去多半会被下一级的台子接住，不会一路漏到底；
 *   3. 空档 120 / 30 交替，宽的那级要贴着沿起跳，窄的那级抬脚就过；
 *   4. 每级抬升 120，同一侧上下两块隔 240，头顶净空 222，
 *      比三只小猪跳起来能碰到的高度（最高 215）还高，起跳不会顶到上层台子；
 *   5. door 的底边必须和落地平台顶面齐平；
 *   6. 机关（压板/吊篮/摇杆/按钮/石栏/箱子/传送门）的状态都在 game.js 里每关重建。
 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  var P = NS.P;

  var LW = 440;     // 左台常规宽
  var LWW = 530;    // 左台探出去的宽（缝就窄了）
  var RX = 560;     // 右台左沿固定 560
  var RW = 440;
  var STEP = 120;   // 每级抬升

  /* ---------- 常用构件 ---------- */
  function ground(top) {
    return P(0, top, 1000, 200, 'solid', 'ground');
  }

  function ledge(x, y, w, style) {
    return P(x, y, w || LW, 18, 'solid', style || 'grass');
  }

  // 左台：右沿在 440 / 530 之间交替，缝的位置一左一右错开
  function leftLedge(y, i) {
    return ledge(0, y, (i % 4 === 2) ? LWW : LW);
  }
  // 右台：左沿固定 560，右沿忽长忽短
  function rightLedge(y, i) {
    return ledge(RX, y, (i % 4 === 3) ? 360 : RW);
  }

  function crate(x, y) {
    return { x: x, y: y, w: 60, h: 60, isCrate: true };
  }

  function button(x, y, gateIndex) {
    return { x: x, y: y, w: 70, h: 16, gate: gateIndex, on: false };
  }

  // 石栏：横在走廊上，上下顶死不留缝，谁也翻不过去
  function gate(x, y, h) {
    return { x: x, y: y, w: 80, h: h || 132, open: false };
  }

  function portal(x, y, link) {
    return { x: x, y: y, w: 60, h: 50, link: link };
  }

  /* ---------- 第一关：后山草坡（基础攀爬） ---------- */
  function buildL1() {
    var plats = [
      ground(1600),
      leftLedge(1520, 0), rightLedge(1400, 1), leftLedge(1280, 2), rightLedge(1160, 3),
      leftLedge(1040, 4), rightLedge(920, 5), leftLedge(800, 6), rightLedge(680, 7),
      leftLedge(560, 8), rightLedge(440, 9), leftLedge(320, 10)
    ];

    return {
      name: '第一关 · 后山草坡',
      hint: 'P1：A / D 走、W 跳、Q 换人；P2：← / → 走、↑ 跳、P 换人。缝一左一右，宽的贴着沿跳。',
      w: 1000, h: 1800, sky: ['#bfe3ee', '#eef3dc'],
      spawn: [ { x:500, y:1560 }, { x:580, y:1540 }, { x:660, y:1560 } ],
      plats: plats,
      crates: [], buttons: [], gates: [], portals: [],
      plate: null, elevator: null, lever: null, bridges: [],
      door: { x: 250, y: 200, w: 96, h: 120 }
    };
  }

  /* ---------- 第二关：老井台（推箱压板 + 吊篮升降） ---------- */
  function buildL2() {
    var elevator = {
      x: 470, y: 1380, y0: 1380, yTop: 700,
      w: 220, h: 24, kind: 'solid', style: 'wood',
      active: true, isEl: true, speed: 2.0, press: false
    };
    var plats = [
      ground(1700),
      leftLedge(1620, 0), rightLedge(1500, 1),
      ledge(0, 1380, LW),        // 压板台子，宽度固定，免得和吊篮打架
      elevator,
      ledge(720, 700, 280, 'stone')
    ];

    return {
      name: '第二关 · 老井台',
      hint: '压板只有沉东西压得住：让团团把木箱推上压板，吊篮就会升起来，三只一起搭它上去。',
      w: 1000, h: 1900, sky: ['#f6cfae', '#faeeda'],
      spawn: [ { x:500, y:1660 }, { x:580, y:1640 }, { x:660, y:1660 } ],
      plats: plats,
      crates: [ crate(300, 1320) ],
      buttons: [], gates: [], portals: [],
      plate: { x: 60, y: 1380, w: 150, h: 16 },
      elevator: elevator, lever: null, bridges: [],
      door: { x: 860, y: 580, w: 96, h: 120 }
    };
  }

  /* ---------- 第三关：钟楼顶（只有高高够得着的高台 + 摇杆吊桥） ---------- */
  function buildL3() {
    var bridge = [ledge(320, 1057, 240, 'wood')];
    bridge[0].active = false;

    var plats = [
      ground(1700),
      leftLedge(1620, 0), rightLedge(1500, 1), leftLedge(1380, 2), rightLedge(1260, 3),
      leftLedge(1140, 4),
      ledge(RX, 975, RW, 'stone'),      // 高台：比普通台阶高一截，只有高高够得着
      bridge[0],                        // 吊桥：拉杆后落下
      leftLedge(855, 0), rightLedge(735, 1), leftLedge(615, 2), rightLedge(495, 3)
    ];

    return {
      name: '第三关 · 钟楼顶',
      hint: '那级高台比普通台阶高一截，只有高高的弹跳够得着；他拉下摇杆，吊桥落下，另外两只才上得来。',
      w: 1000, h: 1900, sky: ['#b8c7e6', '#f7e4cf'],
      spawn: [ { x:500, y:1660 }, { x:580, y:1640 }, { x:660, y:1660 } ],
      plats: plats,
      crates: [], buttons: [], gates: [], portals: [],
      plate: null, elevator: null,
      lever: { x: 650, y: 949, w: 70, h: 26, on: false },
      bridges: bridge,
      door: { x: 800, y: 375, w: 96, h: 120 }
    };
  }

  /* ---------- 第四关：柴房（推箱子垫脚） ---------- */
  function buildL4() {
    var plats = [
      ground(1700),
      leftLedge(1620, 0), rightLedge(1500, 1),
      leftLedge(1340, 0), rightLedge(1220, 1),
      leftLedge(1100, 2), rightLedge(980, 3),
      leftLedge(860, 4), rightLedge(740, 5)
    ];

    return {
      name: '第四关 · 柴房',
      hint: '下一级比谁都跳不上去，让团团把木箱推到台沿，踩着箱子再跨那道空档——箱子只有团团推得动。',
      w: 1000, h: 1900, sky: ['#cfd9c0', '#f3ecd9'],
      spawn: [ { x:500, y:1660 }, { x:580, y:1640 }, { x:660, y:1660 } ],
      plats: plats,
      crates: [ crate(700, 1440) ],
      buttons: [], gates: [], portals: [],
      plate: null, elevator: null, lever: null, bridges: [],
      door: { x: 860, y: 620, w: 96, h: 120 }
    };
  }

  /* ---------- 第五关：石廊（按钮开门 + 传送门） ---------- */
  function buildL5() {
    var plats = [
      ground(1700),
      leftLedge(1620, 0), rightLedge(1500, 1), leftLedge(1380, 2),
      rightLedge(1260, 1), leftLedge(1140, 2),
      ledge(RX, 700, RW, 'stone'),      // 石廊：传送门的落点
      leftLedge(580, 0), rightLedge(460, 1)
    ];

    return {
      name: '第五关 · 石廊',
      hint: '传送门会把小猪送到高处的石廊：落地先踩右边的按钮，石栏才会升起，然后才能往左跳到出口。',
      w: 1000, h: 1900, sky: ['#c9d3e4', '#f5ecdf'],
      spawn: [ { x:500, y:1660 }, { x:580, y:1640 }, { x:660, y:1660 } ],
      plats: plats,
      crates: [],
      buttons: [ button(880, 684, 0) ],
      gates: [ gate(620, 478, 222) ],
      portals: [ portal(300, 1090, 1), portal(800, 650, 0) ],
      plate: null, elevator: null, lever: null, bridges: [],
      door: { x: 860, y: 340, w: 96, h: 120 }
    };
  }

  /* ---------- 第六关：老宅（推箱 + 开门 + 传送） ---------- */
  function buildL6() {
    var plats = [
      ground(1700),
      leftLedge(1620, 0), rightLedge(1500, 1),
      leftLedge(1340, 0), rightLedge(1220, 1), leftLedge(1100, 2),
      ledge(RX, 700, RW, 'stone'),
      leftLedge(580, 0), rightLedge(460, 1)
    ];

    return {
      name: '第六关 · 老宅',
      hint: '箱子垫上台沿、按钮升起石栏、传送门送人上楼——三样机关凑在一起，先把团团送到位再动别人。',
      w: 1000, h: 1900, sky: ['#cbb6c9', '#f7e6d2'],
      spawn: [ { x:500, y:1660 }, { x:580, y:1640 }, { x:660, y:1660 } ],
      plats: plats,
      crates: [ crate(700, 1440) ],
      buttons: [ button(880, 684, 0) ],
      gates: [ gate(620, 478, 222) ],
      portals: [ portal(300, 1050, 1), portal(800, 650, 0) ],
      plate: null, elevator: null, lever: null, bridges: [],
      door: { x: 860, y: 340, w: 96, h: 120 }
    };
  }

  NS.LEVELS = [buildL1, buildL2, buildL3, buildL4, buildL5, buildL6];

})(window.PIG);
