/*
 * Tiny pixel-art engine shared by both pages.
 * Draws on a low-resolution canvas that CSS scales up with crisp pixels.
 */
(function () {
  "use strict";

  // PICO-8-inspired palette.
  var PALETTE = {
    K: "#1a1c2c", // outline
    R: "#ff004d", // red
    D: "#a8003a", // dark red
    W: "#fff1e8", // white
    Y: "#ffec27", // yellow
    O: "#ffa300", // orange
    P: "#ff77a8", // pink
    B: "#29adff", // blue
    G: "#00e436", // green
    V: "#83769c", // violet
  };

  var CONFETTI = ["#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#ff77a8", "#fff1e8"];

  var SPRITES = {
    heart: [
      "..KKK...KKK..",
      ".KRRRK.KRRRK.",
      "KRRWRRKRRRRRK",
      "KRWRRRRRRRRRK",
      "KRRRRRRRRRRRK",
      "KRRRRRRRRRRDK",
      ".KRRRRRRRRDK.",
      "..KRRRRRRDK..",
      "...KRRRRDK...",
      "....KRRDK....",
      ".....KDK.....",
      "......K......",
    ],
    smallHeart: [
      ".RR.RR.",
      "RWRRRRR",
      "RRRRRRR",
      ".RRRRR.",
      "..RRR..",
      "...R...",
    ],
    sparkle: [
      "..Y..",
      "..Y..",
      "YYWYY",
      "..Y..",
      "..Y..",
    ],
    tinySparkle: [
      ".W.",
      "WYW",
      ".W.",
    ],
    coin: [
      [
        "..KKKK..",
        ".KYYYYK.",
        "KYYWYYOK",
        "KYWYYYOK",
        "KYYYYYOK",
        "KYYYYOOK",
        ".KOOOOK.",
        "..KKKK..",
      ],
      [
        "...KK...",
        "..KYYK..",
        ".KYWYOK.",
        ".KYYYOK.",
        ".KYYYOK.",
        ".KYYOOK.",
        "..KOOK..",
        "...KK...",
      ],
      [
        "...KK...",
        "...YK...",
        "...YK...",
        "...YK...",
        "...YK...",
        "...YK...",
        "...OK...",
        "...KK...",
      ],
      [
        "...KK...",
        "..KYYK..",
        ".KOYWYK.",
        ".KOYYYK.",
        ".KOYYYK.",
        ".KOOYYK.",
        "..KOOK..",
        "...KK...",
      ],
    ],
  };

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  // Quantise opacity into 8-bit-style steps.
  function stepAlpha(a) {
    return Math.max(0, Math.min(1, Math.round(a * 4) / 4));
  }

  /*
   * Draws a sprite centred on (cx, cy) in logical pixels.
   * opts.alpha: opacity; opts.tint: colour replacing everything except outline.
   */
  function drawSprite(ctx, sprite, cx, cy, scale, opts) {
    var alpha = opts && opts.alpha != null ? opts.alpha : 1;
    if (alpha <= 0) return;
    var tint = opts && opts.tint;
    var x0 = Math.round(cx - (sprite[0].length * scale) / 2);
    var y0 = Math.round(cy - (sprite.length * scale) / 2);
    ctx.globalAlpha = alpha;
    for (var r = 0; r < sprite.length; r++) {
      var row = sprite[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === ".") continue;
        ctx.fillStyle = tint && ch !== "K" ? tint : PALETTE[ch];
        ctx.fillRect(x0 + c * scale, y0 + r * scale, scale, scale);
      }
    }
    ctx.globalAlpha = 1;
  }

  /*
   * Wraps a full-viewport canvas. Each logical pixel is `pixelSize` CSS pixels.
   */
  function createScreen(canvas, onResize) {
    var ctx = canvas.getContext("2d");
    var screen = { canvas: canvas, ctx: ctx, P: 4, w: 0, h: 0 };

    function resize() {
      var vw = document.documentElement.clientWidth;
      var vh = window.innerHeight;
      screen.P = vw < 480 ? 3 : 4;
      screen.w = Math.ceil(vw / screen.P);
      screen.h = Math.ceil(vh / screen.P);
      canvas.width = screen.w;
      canvas.height = screen.h;
      canvas.style.width = screen.w * screen.P + "px";
      canvas.style.height = screen.h * screen.P + "px";
      ctx.imageSmoothingEnabled = false;
      if (onResize) onResize(screen);
    }

    // Centre of a DOM element, in logical canvas pixels.
    screen.center = function (el) {
      var rect = el.getBoundingClientRect();
      return {
        x: Math.round((rect.left + rect.width / 2) / screen.P),
        y: Math.round((rect.top + rect.height / 2) / screen.P),
      };
    };

    screen.clear = function () {
      ctx.clearRect(0, 0, screen.w, screen.h);
    };

    window.addEventListener("resize", resize);
    resize();
    return screen;
  }

  function loop(fn) {
    var last = performance.now();
    var start = last;
    var id = 0;
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fn(dt, (now - start) / 1000);
      id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return function stop() {
      cancelAnimationFrame(id);
    };
  }

  /*
   * Types out an element's text. Screen readers get the full text straight away
   * through a visually hidden copy; the animated copy is aria-hidden.
   */
  function typewrite(el, delayMs, charMs, done) {
    var full = el.textContent;
    el.textContent = "";

    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = full;

    var visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.className = "typed";

    el.appendChild(sr);
    el.appendChild(visual);

    var i = 0;
    function next() {
      i++;
      visual.classList.add("typing");
      visual.textContent = full.slice(0, i);
      if (i < full.length) {
        setTimeout(next, charMs);
      } else {
        visual.classList.add("typed-done");
        if (done) done();
      }
    }
    setTimeout(next, delayMs);
  }

  window.Pixel = Object.freeze({
    PALETTE: PALETTE,
    CONFETTI: CONFETTI,
    SPRITES: SPRITES,
    prefersReducedMotion: prefersReducedMotion,
    rand: rand,
    pick: pick,
    stepAlpha: stepAlpha,
    drawSprite: drawSprite,
    createScreen: createScreen,
    loop: loop,
    typewrite: typewrite,
  });
})();
