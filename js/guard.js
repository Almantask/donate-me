/*
 * Security checks. Loaded synchronously in <head>, right after config.js,
 * so the page classes are set before first paint.
 *
 * - Frame-busting (GitHub Pages can't send X-Frame-Options / frame-ancestors).
 * - Official-host check, so forks and copies can't take donations "in your name".
 * - Strict validation of the Stripe link and of ?from= project slugs
 *   (allowlist only, so there are no open redirects).
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var SLUG_RE = /^[a-z0-9-]{1,40}$/;
  var STRIPE_PATH_RE = /^\/(test_)?[A-Za-z0-9]{6,64}$/;
  var STORAGE_KEY = "donate-me:project";
  var STRIPE_LOCALES = ["en", "lt"];

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
      Object.freeze(obj);
    }
    return obj;
  }

  var cfg = deepFreeze(window.DONATE_CONFIG || null);

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value, fallback, max) {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max || 60) : fallback;
  }

  function parseHttps(value) {
    if (typeof value !== "string") return null;
    try {
      var url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return null;
      return url;
    } catch (e) {
      return null;
    }
  }

  // --- Framing -------------------------------------------------------------
  var framed;
  try {
    framed = window.top !== window.self;
  } catch (e) {
    framed = true;
  }
  if (framed) root.classList.add("is-framed");

  // --- Official host -------------------------------------------------------
  var host = location.hostname;
  var isDev = list(cfg && cfg.devHosts).indexOf(host) !== -1;
  var isOfficial =
    !!cfg &&
    ((location.protocol === "https:" && list(cfg.officialHosts).indexOf(host) !== -1) || isDev);
  if (!isOfficial) root.classList.add("is-unofficial");

  var officialUrl = (function () {
    var url = parseHttps(cfg && cfg.officialUrl);
    return url && list(cfg.officialHosts).indexOf(url.hostname) !== -1 ? url.href : null;
  })();

  // --- Public API ----------------------------------------------------------
  // Returns a translation key (see i18n.js), or null when donations are allowed.
  function blockReason() {
    if (!cfg) return "statusConfig";
    if (framed) return "statusFramed";
    if (!isOfficial) return "statusUnofficial";
    return null;
  }

  function getProject(slug) {
    if (!cfg || typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
    var projects = cfg.projects;
    if (!projects || !Object.prototype.hasOwnProperty.call(projects, slug)) return null;
    var p = projects[slug];
    var url = parseHttps(p && p.url);
    var name = text(p && p.name, null, 60);
    if (!url || !name) return null;
    return { slug: slug, name: name, url: url.href };
  }

  function getStripeUrl(projectSlug, locale) {
    if (!cfg) return null;
    var url = parseHttps(cfg.stripePaymentLink);
    if (!url || url.hostname !== "buy.stripe.com" || url.port) return null;
    if (!STRIPE_PATH_RE.test(url.pathname) || url.search || url.hash) return null;
    var project = getProject(projectSlug);
    if (project) url.searchParams.set("client_reference_id", project.slug);
    if (STRIPE_LOCALES.indexOf(locale) !== -1) url.searchParams.set("locale", locale);
    return url.href;
  }

  function displayName() {
    return text(cfg && cfg.displayName, "", 40);
  }

  function rememberProject(slug) {
    try {
      if (getProject(slug)) sessionStorage.setItem(STORAGE_KEY, slug);
    } catch (e) { /* storage unavailable: attribution is optional */ }
  }

  function recalledProject() {
    try {
      return getProject(sessionStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  function githubUrl() {
    var url = parseHttps(cfg && cfg.githubUrl);
    return url ? url.href : officialUrl;
  }

  // --- Fill shared text (textContent only, never HTML) --------------------
  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!cfg) return;
    var name = text(cfg.displayName, "the author", 40);
    each(".js-display-name", function (el) { el.textContent = name; });
    each(".js-recipient", function (el) { el.textContent = text(cfg.stripeBusinessName, name, 60); });
    each(".js-github-link", function (el) { el.href = githubUrl(); });
    if (officialUrl) {
      each(".js-official-url", function (el) { el.textContent = officialUrl; });
      each(".js-official-link", function (el) { el.href = officialUrl; });
    }
  });

  window.DonateGuard = Object.freeze({
    framed: framed,
    official: isOfficial,
    blockReason: blockReason,
    displayName: displayName,
    getProject: getProject,
    getStripeUrl: getStripeUrl,
    rememberProject: rememberProject,
    recalledProject: recalledProject,
    githubUrl: githubUrl,
  });
})();
