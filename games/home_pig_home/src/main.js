/* 启动：初始化渲染器、装载第一关、进入固定步长主循环 */
window.PIG = window.PIG || {};

(function (NS) {
  'use strict';

  var G = NS.Game;

  NS.Renderer.init();
  G.resetLevel(0);
  NS.UI.showTitle();

  var STEP_MS = 1000 / 60;
  var lastTime = 0;
  var acc = 0;

  function loop(now) {
    if (!lastTime) lastTime = now;

    var dt = now - lastTime;
    lastTime = now;
    if (dt > 120) dt = 120;   // 切后台回来时不要一次性补太多帧

    acc += dt;
    var guard = 0;
    while (acc >= STEP_MS && guard < 5) {
      G.step();
      acc -= STEP_MS;
      guard++;
    }
    if (guard >= 5) acc = 0;

    NS.Renderer.render(G);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

})(window.PIG);
