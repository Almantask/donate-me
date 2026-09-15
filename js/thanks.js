(function () {
  "use strict";

  var guard = window.DonateGuard;
  var Pixel = window.Pixel;
  var I18n = window.I18n;
  if (!guard || !Pixel || !I18n) return;

  var S = Pixel.SPRITES;
  var stage = document.getElementById("stage");
  var canvas = document.getElementById("fx");
  var reduced = Pixel.prefersReducedMotion();

  // --- Back link: allowlisted project URL or GitHub profile, never a URL param.
  var project = guard.recalledProject();
  var back = document.getElementById("back-btn");
  var backUrl = project ? project.url : guard.githubUrl();
  if (backUrl) back.href = backUrl;
  if (project) {
    document.getElementById("back-label").textContent = I18n.t("backTo", { project: project.name.toUpperCase() });
    document.getElementById("project-name").textContent = project.name;
    document.getElementById("project-line").hidden = false;
  }

  // --- Title letters drop in one by one ---------------------------------------
  var title = document.getElementById("thanks-title");
  if (!reduced) {
    var full = title.textContent;
    title.textContent = "";
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = full;
    var visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    Array.prototype.forEach.call(full, function (ch, i) {
      var letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = ch;
      letter.style.setProperty("--i", String(i));
      visual.appendChild(letter);
    });
    title.appendChild(sr);
    title.appendChild(visual);
    document.documentElement.classList.add("thanks-animated");

    var delay = 2400;
    Array.prototype.forEach.call(document.querySelectorAll(".type"), function (el) {
      Pixel.typewrite(el, delay, 30);
      delay += el.textContent.length * 30 + 300;
    });
  }

  // --- Animation --------------------------------------------------------------
  var confetti = [];
  var stars = [];
  var starTimer = 0;
  var burstDone = false;

  var screen = Pixel.createScreen(canvas, function () {
    if (reduced) drawStatic();
  });

  function heartScale() {
    return screen.P === 3 ? 4 : 3;
  }

  function burst(x, y, count, power) {
    for (var i = 0; i < count; i++) {
      var angle = Pixel.rand(0, Math.PI * 2);
      var speed = Pixel.rand(15, power);
      confetti.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Pixel.rand(10, 35),
        size: Math.random() < 0.3 ? 2 : 1,
        color: Pixel.pick(Pixel.CONFETTI),
        life: 0,
        max: Pixel.rand(1.8, 3.2),
        flutter: Pixel.rand(0, Math.PI * 2),
      });
    }
  }

  function drawStatic() {
    screen.clear();
    var ctx = screen.ctx;
    for (var i = 0; i < 30; i++) {
      var x = (i * 53 + 17) % screen.w;
      var y = (i * 37 + 11) % screen.h;
      Pixel.drawSprite(ctx, i % 3 ? S.tinySparkle : S.sparkle, x, y, 1, { alpha: 0.75 });
    }
    var c = screen.center(stage);
    Pixel.drawSprite(ctx, S.heart, c.x, c.y, heartScale() + 1);
  }

  function frame(dt, t) {
    var ctx = screen.ctx;
    screen.clear();
    var c = screen.center(stage);
    var base = heartScale();

    // Falling star rain, after the burst.
    if (t > 1.4) {
      starTimer -= dt;
      if (starTimer <= 0 && stars.length < 40) {
        starTimer = Pixel.rand(0.08, 0.25);
        stars.push({
          x: Math.round(Pixel.rand(2, screen.w - 2)),
          y: -4,
          vy: Pixel.rand(8, 22),
          phase: Pixel.rand(0, Math.PI * 2),
          big: Math.random() < 0.3,
        });
      }
    }
    stars = stars.filter(function (st) {
      st.y += st.vy * dt;
      var a = Pixel.stepAlpha(0.5 + Math.sin(t * 4 + st.phase) * 0.5);
      Pixel.drawSprite(ctx, st.big ? S.sparkle : S.tinySparkle, st.x, st.y, 1, { alpha: a });
      return st.y < screen.h + 4;
    });

    // Heart: charge up (shake + fast beat), flash, burst, then "level up".
    var scale = base;
    var tint = null;
    var shake = 0;
    if (t < 0.9) {
      shake = t > 0.3 ? Math.round(Pixel.rand(-1, 1)) : 0;
      scale = Math.floor(t * 8) % 2 ? base + 1 : base;
      if (t > 0.6) tint = Math.floor(t * 25) % 2 ? Pixel.PALETTE.W : Pixel.PALETTE.Y;
    } else {
      if (!burstDone) {
        burstDone = true;
        burst(c.x, c.y, 160, 90);
      }
      var phase = t % 1.1;
      scale = phase < 0.12 || (phase > 0.24 && phase < 0.36) ? base + 2 : base + 1;
      if (t < 1.1) tint = Pixel.PALETTE.W;
    }

    // Confetti with gravity and a bit of flutter.
    confetti = confetti.filter(function (p) {
      p.life += dt;
      p.vy += 55 * dt;
      p.vx *= 1 - 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Pixel.stepAlpha(1 - p.life / p.max);
      ctx.fillStyle = p.color;
      var flip = Math.sin(p.life * 12 + p.flutter) > 0 ? p.size : 1;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), flip, p.size);
      ctx.globalAlpha = 1;
      return p.life < p.max && p.y < screen.h + 2;
    });

    Pixel.drawSprite(ctx, S.heart, c.x + shake, c.y, scale, { tint: tint });
  }

  if (reduced) {
    drawStatic();
    window.addEventListener("scroll", drawStatic, { passive: true });
  } else {
    Pixel.loop(frame);
    // A small extra burst wherever the visitor taps.
    window.addEventListener("pointerdown", function (event) {
      if (event.target.closest("a, button")) return;
      burst(Math.round(event.clientX / screen.P), Math.round(event.clientY / screen.P), 30, 50);
    });
  }
})();
