/**
 * Subtle "neural network" background effect.
 *
 * Draws slowly drifting nodes on a fixed full-screen canvas and connects
 * nearby ones with thin lines, plus a faint link toward the pointer. Kept
 * intentionally low-contrast so it never competes with the page content.
 *
 * Accessibility & performance:
 *  - Honors prefers-reduced-motion by slowing the drift down (not freezing it).
 *  - Pauses the animation loop when the tab is hidden.
 *  - Caps the device pixel ratio and adapts node count to the viewport.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('neural-bg');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reducedQuery =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  // Global speed multiplier: full speed normally, gentle drift when the user
  // prefers reduced motion (still moves, just much slower).
  var speedScale = reducedQuery && reducedQuery.matches ? 0.25 : 1;

  // Purple palette matching the site theme.
  var NODE_COLOR = 'rgba(192, 132, 252, ALPHA)'; // --purple-bright
  var LINK_COLOR = 'rgba(168, 85, 247, ALPHA)'; // --purple

  var width = 0;
  var height = 0;
  var dpr = 1;
  var nodes = [];
  var linkDist = 150; // px distance under which two nodes get connected
  var pointer = { x: -9999, y: -9999, active: false };
  var rafId = null;

  function nodeCount() {
    // Density scaled to area, with sane caps for phones and large screens.
    var area = width * height;
    var count = Math.round(area / 18000);
    return Math.max(24, Math.min(90, count));
  }

  function createNodes() {
    nodes = [];
    var count = nodeCount();
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 1.0,
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Link distance adapts a bit to viewport size (tighter on small screens).
    linkDist = width < 640 ? 110 : 150;
    createNodes();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Connections between nearby nodes.
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < linkDist) {
          // Fade the line out as nodes get farther apart. Max ~0.14 alpha.
          var alpha = (1 - dist / linkDist) * 0.14;
          ctx.strokeStyle = LINK_COLOR.replace('ALPHA', alpha.toFixed(3));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Faint link toward the pointer for a gentle interactive feel.
      if (pointer.active) {
        var pdx = a.x - pointer.x;
        var pdy = a.y - pointer.y;
        var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        var reach = linkDist * 1.4;
        if (pdist < reach) {
          var pAlpha = (1 - pdist / reach) * 0.18;
          ctx.strokeStyle = LINK_COLOR.replace('ALPHA', pAlpha.toFixed(3));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
    }

    // Nodes on top of the links.
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      ctx.fillStyle = NODE_COLOR.replace('ALPHA', '0.55');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx * speedScale;
      n.y += n.vy * speedScale;
      // Wrap softly around the edges.
      if (n.x < -20) n.x = width + 20;
      else if (n.x > width + 20) n.x = -20;
      if (n.y < -20) n.y = height + 20;
      else if (n.y > height + 20) n.y = -20;
    }
    draw();
    rafId = window.requestAnimationFrame(step);
  }

  function start() {
    if (rafId == null) rafId = window.requestAnimationFrame(step);
  }

  function stop() {
    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Pointer tracking (mouse + touch), throttled by rAF-friendly assignment.
  window.addEventListener(
    'pointermove',
    function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );
  window.addEventListener('pointerout', function () {
    pointer.active = false;
    pointer.x = pointer.y = -9999;
  });

  // Debounced resize.
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 150);
  });

  // React live if the motion preference changes.
  if (reducedQuery) {
    var onMotionChange = function () {
      speedScale = reducedQuery.matches ? 0.25 : 1;
    };
    if (reducedQuery.addEventListener) {
      reducedQuery.addEventListener('change', onMotionChange);
    } else if (reducedQuery.addListener) {
      reducedQuery.addListener(onMotionChange); // older browsers
    }
  }

  // Pause when the tab isn't visible to save battery/CPU.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  resize();
  start();
})();
