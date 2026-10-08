/*
 * Cloudflare Web Analytics.
 *
 * The beacon records a page view on load. Web Analytics has no custom events,
 * so an INSERT COIN click is recorded as a page view of ".../donate-click":
 * the beacon already measures same-document navigations. The real URL is put
 * back in the same turn, before checkout, so Back from Stripe returns here.
 * The page view caused by that return is not sent.
 *
 * The site token is public. Leave it empty to disable analytics. Dev hosts and
 * unofficial copies never load the beacon.
 */
(function () {
  "use strict";

  var BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
  var RUM_PATH = "/cdn-cgi/rum";
  var TOKEN_RE = /^[a-f0-9]{32}$/i;
  var CLICK_SEGMENT = "donate-click";
  // Gives the beacon request time to leave, and covers browsers that never
  // fire popstate after history.back().
  var CLICK_TIMEOUT_MS = 800;

  var cfg = window.DONATE_CONFIG;
  var guard = window.DonateGuard;
  var token = cfg && cfg.cloudflareAnalyticsToken;

  function devHost() {
    var hosts = cfg && Array.isArray(cfg.devHosts) ? cfg.devHosts : [];
    return hosts.indexOf(location.hostname) !== -1;
  }

  function validToken(value) {
    return typeof value === "string" && TOKEN_RE.test(value);
  }

  var enabled = false;
  if (guard && guard.official && !guard.framed && !devHost() && validToken(token) && document.head) {
    var script = document.createElement("script");
    script.type = "module";
    script.src = BEACON_SRC;
    script.setAttribute("data-cf-beacon", JSON.stringify({ token: token, spa: true }));
    document.head.appendChild(script);
    enabled = true;
  }

  // Directory of the current page, keeping a project-pages prefix like /donate-me/.
  function directory() {
    var path = location.pathname;
    if (path.slice(-1) === "/") return path;
    var cut = path.lastIndexOf("/");
    var last = path.slice(cut + 1);
    if (last.indexOf(".") !== -1) return path.slice(0, cut + 1);
    return path + "/";
  }

  function currentUrl() {
    return location.pathname + location.search + location.hash;
  }

  function trackDonateClick(done) {
    function finish() {
      if (finish.called) return;
      finish.called = true;
      if (typeof done === "function") done();
    }

    if (!enabled) {
      finish();
      return;
    }

    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    var patched = true;
    function unpatch() {
      if (!patched) return;
      patched = false;
      XMLHttpRequest.prototype.open = origOpen;
      XMLHttpRequest.prototype.send = origSend;
    }

    var sawClick = false;
    var clickFinished = false;
    var onClickFinished = null;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__donateRum = String(url).indexOf(RUM_PATH) !== -1;
      return origOpen.apply(this, arguments);
    };
    // eventType 1 is the beacon's page-load record (beacon.min.js, 2026.10.0).
    XMLHttpRequest.prototype.send = function (body) {
      if (this.__donateRum) {
        var payload = null;
        try { payload = JSON.parse(String(body || "")); } catch (err) { payload = null; }
        var reported = payload && typeof payload.location === "string" ? payload.location : "";
        var isLoad = !!(payload && payload.eventType === 1);
        var isClick = reported.indexOf("/" + CLICK_SEGMENT) !== -1;
        if (isLoad && !isClick) return;
        if (isLoad && isClick) {
          sawClick = true;
          this.addEventListener("loadend", function () {
            clickFinished = true;
            if (onClickFinished) onClickFinished();
          });
        }
      }
      return origSend.apply(this, arguments);
    };

    var savedUrl = currentUrl();
    try {
      history.pushState(null, "", directory() + CLICK_SEGMENT);
    } catch (err) {
      unpatch();
      finish();
      return;
    }
    if (!sawClick) clickFinished = true;

    // Put the real URL back in this same turn, before checkout starts. back()
    // then drops the extra history entry; the beacon's page view for that
    // return is ignored while the request filter above is still installed.
    try {
      history.replaceState(null, "", savedUrl);
    } catch (err) { /* back() restores it instead */ }

    var urlRestored = currentUrl() === savedUrl;
    // history.back() reports the return trip on a later turn. Stay patched until then.
    var returned = false;
    var settled = false;
    function settle() {
      if (settled || !urlRestored || !clickFinished || !returned) return;
      settled = true;
      clearTimeout(cap);
      window.removeEventListener("popstate", onPop);
      unpatch();
      finish();
    }

    function onPop() {
      if (currentUrl() !== savedUrl) {
        try { history.replaceState(null, "", savedUrl); } catch (err) { /* keep going */ }
      }
      urlRestored = currentUrl() === savedUrl;
      returned = true;
      settle();
    }

    onClickFinished = settle;
    var cap = setTimeout(function () {
      if (!urlRestored) {
        try { history.replaceState(null, "", savedUrl); } catch (err) { /* checkout still proceeds */ }
        urlRestored = currentUrl() === savedUrl;
      }
      returned = true;
      clickFinished = true;
      settle();
    }, CLICK_TIMEOUT_MS);

    window.addEventListener("popstate", onPop);
    try {
      history.back();
    } catch (err) { /* the real URL is already restored */ }
    settle();
  }

  window.DonateAnalytics = Object.freeze({
    enabled: enabled,
    trackDonateClick: trackDonateClick,
  });
})();
