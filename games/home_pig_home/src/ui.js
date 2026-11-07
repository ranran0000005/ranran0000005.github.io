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
          '<p>三只小猪穿过草坡、老井台、钟楼、柴房、石廊和老宅，终于一起回了家。<br>总用时 ' + time + '。</p>' +
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
    showWin: showWin,
    hidePanel: hidePanel,
    hideOverlay: hidePanel,   // game.js 用的别名
    updateHud: updateHud
  };

})(window.PIG);
