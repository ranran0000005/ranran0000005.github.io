/* 界面层：遮罩面板文案 + 顶部 HUD 同步 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  var cache = {};
  var overlay = null;

  function el(id) { return document.getElementById(id); }

  function setText(id, value) {
    if (cache[id] === value) return;
    cache[id] = value;
    var node = el(id);
    if (node) node.textContent = value;
  }

  function showPanel(html) {
    overlay = overlay || el('overlay');
    overlay.innerHTML = html;
    overlay.classList.remove('hide');
    cache = {}; // 面板重建后 HUD 需要重新写一遍
  }

  function hidePanel() {
    overlay = overlay || el('overlay');
    overlay.classList.add('hide');
  }

  /* ---------- 各种面板 ---------- */
  function showTitle() {
    showPanel(
      '<div class="panel">' +
        '<h2>送小猪回家</h2>' +
        '<p>天快黑了，三只小猪要一起走上山顶的小屋。<br>两只手各管一只，还能随时接管第三只。</p>' +
        '<div class="krow">' +
          '<div class="kbox"><span class="chip p1c">P1</span><br><b>A / D</b> 走路 · <b>W</b> 跳 · <b>Q</b> 换人</div>' +
          '<div class="kbox"><span class="chip p2c">P2</span><br><b>← / →</b> 走路 · <b>↑</b> 跳 · <b>P</b> 换人</div>' +
        '</div>' +
        '<p class="small">三只小猪都走进门才算过关 · 按 Enter 开始</p>' +
        '<button class="btn" data-act="start">开始第一关</button>' +
        '<button class="btn ghost" data-act="levels">选关</button>' +
      '</div>'
    );
  }

  function showWin(g) {
    var last = g.levelIdx >= NS.LEVELS.length - 1;
    var time = NS.U.fmtTime(g.elapsed);

    if (last) {
      showPanel(
        '<div class="panel">' +
          '<h2>全部到家</h2>' +
          '<p>三只小猪穿过草坡、老井台、钟楼、柴房、石廊、老宅、溪口、水车房和后院，终于一起回了家。<br>总用时 ' + time + '。</p>' +
          '<button class="btn" data-act="again">再玩一次</button>' +
        '</div>'
      );
      return;
    }

    showPanel(
      '<div class="panel">' +
        '<h2>过关 · 三只都到家了</h2>' +
        '<p>' + g.cur.name + ' 通啦，用时 ' + time + '。<br>下一关的机关会不一样。</p>' +
        '<button class="btn" data-act="next">进入下一关</button>' +
      '</div>'
    );
  }

  /* ---------- 选关 ---------- */
  function levelCards(g) {
    var idx = g ? g.levelIdx : -1;
    var html = '<div class="lvgrid">';
    for (var i = 0; i < NS.LEVELS.length; i++) {
      var lv = NS.LEVELS[i]();
      var parts = lv.name.split(' · ');
      var tag = lv.water && lv.water.length ? ' · 水潭' : '';
      if (lv.gates && lv.gates.length) tag += ' · 石栏';
      if (lv.lever) tag += ' · 吊桥';
      if (lv.plate && lv.elevator) tag += ' · 吊篮';
      if (lv.portals && lv.portals.length) tag += ' · 传送';
      html += '<button class="lvbtn' + (i === idx ? ' cur' : '') + '" data-act="level" data-idx="' + i + '">' +
        '<b>' + parts[0] + '</b><span>' + (parts[1] || '') + tag + '</span></button>';
    }
    return html + '</div>';
  }

  function showLevelSelect(fromPlay) {
    var G = NS.Game;
    if (G) {
      G.selectFrom = fromPlay ? 'play' : 'title';
      G.state = 'select';
      if (G.keys) G.keys = {};
      if (G.jumpEdge) G.jumpEdge = [false, false];
    }
    showPanel(
      '<div class="panel">' +
        '<h2>选关</h2>' +
        '<p class="small">共 ' + NS.LEVELS.length + ' 关 · 点一下直接进，进度不计时</p>' +
        levelCards(G) +
        '<p class="small">黄框是你正在玩的那一关</p>' +
        '<button class="btn ghost" data-act="back">返回</button>' +
      '</div>'
    );
  }

  /* ---------- HUD ---------- */
  function updateHud(g) {
    if (!g.cur || !g.chars.length) return;

    var c1 = g.chars[NS.PLAYERS[0].active];
    var c2 = g.chars[NS.PLAYERS[1].active];
    if (!c1 || !c2) return;

    setText('levelName', g.cur.name.split(' · ')[0]);
    setText('p1name', c1.name);
    setText('p1note', c1.note.split('，')[0]);
    setText('p2name', c2.name);
    setText('p2note', c2.note.split('，')[0]);

    var home = 0;
    for (var i = 0; i < g.chars.length; i++) {
      var dot = el('dot' + i);
      if (g.chars[i].home) {
        home++;
        if (dot) dot.className = 'dot on';
      } else if (dot) {
        dot.className = 'dot';
      }
    }
    setText('homeText', home + ' / 3');
  }

  NS.UI = {
    showTitle: showTitle,
    showLevelSelect: showLevelSelect,
    showWin: showWin,
    hidePanel: hidePanel,
    hideOverlay: hidePanel,   // game.js 用的别名
    updateHud: updateHud
  };

  // 顶部“选关”按钮
  function bindLevelsButton() {
    var b = el('btnLevels');
    if (!b) return;
    b.addEventListener('click', function () {
      var G = NS.Game;
      if (!G || G.state === 'select') return;
      showLevelSelect(G.state === 'playing');
    });
  }
  bindLevelsButton();

})(window.PIG);
