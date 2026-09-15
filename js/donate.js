(function () {
  "use strict";

  var guard = window.DonateGuard;
  var Pixel = window.Pixel;
  var I18n = window.I18n;
  if (!guard || !Pixel || !I18n) return;

  var S = Pixel.SPRITES;
  var btn = document.getElementById("donate-btn");
  var status = document.getElementById("donate-status");
  var stage = document.getElementById("stage");
  var canvas = document.getElementById("fx");
  var reduced = Pixel.prefersReducedMotion();

  // --- Project attribution (allowlisted slugs only) -----------------------
  var project = guard.getProject(new URLSearchParams(location.search).get("from"));
  if (project) {
    document.getElementById("project-name").textContent = project.name;
    document.getElementById("project-line").hidden = false;
  }

  // --- Donate button --------------------------------------------------------
  var reason = guard.blockReason();
  var stripeUrl = reason ? null : guard.getStripeUrl(project && project.slug, I18n.lang);
  if (!reason && !stripeUrl) reason = "statusNotSetUp";

  if (reason) {
    btn.removeAttribute("href");
    btn.setAttribute("aria-disabled", "true");
    status.textContent = I18n.t(reason);
  } else {
    btn.href = stripeUrl;
    btn.removeAttribute("aria-disabled");
  }

  var navigating = false;
  var coin = null; // { from: {x,y}, t }
  var hover = false;
  var flash = 0;

  btn.addEventListener("click", function (event) {
    if (!stripeUrl || navigating) {
      event.preventDefault();
      return;
    }
    if (project) guard.rememberProject(project.slug);
    // Let the browser handle new-tab clicks and reduced motion normally.
    if (reduced || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;

    event.preventDefault();
    navigating = true;
    btn.classList.add("is-pressed");
    coin = { from: screen.center(btn), t: 0 };
    // Fallback in case animation frames are throttled.
    setTimeout(go, 900);
  });

  function go() {
    if (!navigating) return;
    location.assign(stripeUrl);
  }

  btn.addEventListener("pointerenter", function () { hover = true; });
  btn.addEventListener("pointerleave", function () { hover = false; });
  btn.addEventListener("focus", function () { hover = true; });
  btn.addEventListener("blur", function () { hover = false; });

  // Coming back from Stripe with the Back button restores the page from cache.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      navigating = false;
      coin = null;
      btn.classList.remove("is-pressed");
    }
  });

  // --- Text -----------------------------------------------------------------
  var lines = document.querySelectorAll(".type");
  if (!reduced) {
    var delay = 500;
    Array.prototype.forEach.call(lines, function (el) {
      Pixel.typewrite(el, delay, 38);
      delay += el.textContent.length * 38 + 350;
    });
  }

  // --- Animation --------------------------------------------------------------
  var sparkles = [];
  var floaters = [];
  var spawnTimer = 0;

  function sparkleCount(screen) {
    return Math.min(36, Math.round((screen.w * screen.h) / 1400));
  }

  function newSparkle(screen) {
    return {
      x: Math.round(Pixel.rand(4, screen.w - 4)),
      y: Math.round(Pixel.rand(4, screen.h - 4)),
      phase: Pixel.rand(0, Math.PI * 2),
      speed: Pixel.rand(1.5, 3.5),
      big: Math.random() < 0.3,
    };
  }

  var screen = Pixel.createScreen(canvas, function (s) {
    sparkles = [];
    for (var i = 0; i < sparkleCount(s); i++) sparkles.push(newSparkle(s));
    if (reduced) drawStatic();
  });

  function heartScale(screen) {
    return screen.P === 3 ? 4 : 3;
  }

  function drawStatic() {
    screen.clear();
    var ctx = screen.ctx;
    sparkles.forEach(function (sp) {
      Pixel.drawSprite(ctx, sp.big ? S.sparkle : S.tinySparkle, sp.x, sp.y, 1, { alpha: 0.75 });
    });
    var c = screen.center(stage);
    Pixel.drawSprite(ctx, S.heart, c.x, c.y, heartScale(screen));
  }

  function frame(dt, t) {
    var ctx = screen.ctx;
    screen.clear();

    // Twinkling background sparkles.
    sparkles.forEach(function (sp) {
      var a = Pixel.stepAlpha((Math.sin(t * sp.speed + sp.phase) + 1) / 2);
      Pixel.drawSprite(ctx, sp.big ? S.sparkle : S.tinySparkle, sp.x, sp.y, 1, { alpha: a });
    });

    var c = screen.center(stage);
    var base = heartScale(screen);

    // Little hearts floating up from the big one.
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Pixel.rand(0.25, 0.5);
      floaters.push({
        x: c.x + Pixel.rand(-18, 18),
        y: c.y - 6 * base,
        vy: Pixel.rand(-18, -10),
        drift: Pixel.rand(0, Math.PI * 2),
        life: 0,
        max: Pixel.rand(1.6, 2.6),
        scale: Math.random() < 0.25 ? 2 : 1,
      });
    }
    floaters = floaters.filter(function (f) {
      f.life += dt;
      f.y += f.vy * dt;
      var x = f.x + Math.round(Math.sin(f.life * 3 + f.drift) * 3);
      Pixel.drawSprite(ctx, S.smallHeart, x, f.y, f.scale, {
        alpha: Pixel.stepAlpha(1 - f.life / f.max),
      });
      return f.life < f.max;
    });

    // Heartbeat: lub-dub, then rest.
    var phase = t % 1.1;
    var beat = phase < 0.12 || (phase > 0.24 && phase < 0.36);
    flash = Math.max(0, flash - dt);
    Pixel.drawSprite(ctx, S.heart, c.x, c.y, beat || flash > 0 ? base + 1 : base, {
      tint: flash > 0 ? (Math.floor(flash * 20) % 2 ? Pixel.PALETTE.W : Pixel.PALETTE.Y) : null,
    });

    var coinFrame = S.coin[Math.floor(t * 10) % S.coin.length];

    // Coin spinning next to the button on hover.
    if (hover && !coin && stripeUrl) {
      var b = btn.getBoundingClientRect();
      Pixel.drawSprite(
        ctx, coinFrame,
        Math.round((b.left - 18) / screen.P), Math.round((b.top + b.height / 2) / screen.P),
        2
      );
    }

    // Coin arcing from the button into the heart.
    if (coin) {
      coin.t += dt / 0.5;
      var p = Math.min(1, coin.t);
      var x = coin.from.x + (c.x - coin.from.x) * p;
      var y = coin.from.y + (c.y - coin.from.y) * p - Math.sin(Math.PI * p) * 30;
      if (p < 1) {
        Pixel.drawSprite(ctx, coinFrame, x, y, 2);
      } else if (!coin.done && navigating) {
        flash = 0.3;
        setTimeout(go, 250);
        coin.done = true;
      }
    }
  }

  if (reduced) {
    drawStatic();
    window.addEventListener("scroll", drawStatic, { passive: true });
  } else {
    Pixel.loop(frame);
  }
})();
