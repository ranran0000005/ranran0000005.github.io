/* 输入：两个玩家各一套键位 + 换人键 + 遮罩按钮 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  var G = NS.Game;
  var BLOCK = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  function onKeyDown(e) {
    var code = e.code;
    if (BLOCK.indexOf(code) >= 0) e.preventDefault();
    if (e.repeat) return;

    G.keys[code] = true;

    if (G.state === 'playing') {
      if (code === NS.PLAYERS[0].swap) { G.swapTo(0); return; }
      if (code === NS.PLAYERS[1].swap) { G.swapTo(1); return; }
      if (code === NS.PLAYERS[0].jump) G.jumpEdge[0] = true;
      if (code === NS.PLAYERS[1].jump) G.jumpEdge[1] = true;

      if (code === 'KeyR') {
        G.resetLevel(G.levelIdx);
        G.state = 'playing';
      }
      if (code === 'Escape') NS.UI.showLevelSelect(true);
      return;
    }

    if (code === 'Escape') {
      if (G.state === 'select') goBack();
      return;
    }
    if (code === 'Enter' || code === 'Space') G.advance();
  }

  function onKeyUp(e) {
    G.keys[e.code] = false;
  }

  function goBack() {
    if (G.selectFrom === 'play') {
      G.state = 'playing';
      NS.UI.hidePanel();
    } else {
      G.state = 'title';
      NS.UI.showTitle();
    }
  }

  function onOverlayClick(e) {
    // 点到按钮里的 <b>/<span> 也要能识别
    var node = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!node) return;
    var act = node.getAttribute('data-act');
    if (!act) return;

    if (act === 'start') G.startRun(0);
    else if (act === 'next') G.startRun(G.levelIdx + 1);
    else if (act === 'again') { G.elapsed = 0; G.startRun(0); }
    else if (act === 'levels') NS.UI.showLevelSelect(false);
    else if (act === 'back') goBack();
    else if (act === 'level') {
      var idx = parseInt(node.getAttribute('data-idx'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < NS.LEVELS.length) {
        G.elapsed = 0;
        G.startRun(idx);
      }
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () { G.keys = {}; });
  document.getElementById('overlay').addEventListener('click', onOverlayClick);

})(window.PIG);
