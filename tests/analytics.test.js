// Cloudflare Web Analytics: beacon setup and donate-click page views.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read, loadConfig } = require("./helpers");

const TOKEN = "a".repeat(32);

function runAnalytics({
  token = TOKEN,
  host = "almantask.github.io",
  protocol = "https:",
  pathname = "/donate-me/",
  search = "",
  hash = "",
  official = true,
  framed = false,
  devHosts,
} = {}) {
  const config = loadConfig();
  config.cloudflareAnalyticsToken = token;
  if (devHosts) config.devHosts = devHosts;

  const scripts = [];
  const historyLog = [];
  const sends = [];
  const popstate = [];
  const tasks = [];
  const timers = [];
  const initial = { pathname, search, hash };
  const location = { hostname: host, protocol, pathname, search, hash };

  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function (_method, url) {
    this.__url = url;
  };
  XMLHttpRequest.prototype.send = function (body) {
    sends.push(String(body || ""));
    (this._loadend || []).slice().forEach((fn) => fn());
  };
  XMLHttpRequest.prototype.addEventListener = function (type, fn) {
    if (type === "loadend") (this._loadend || (this._loadend = [])).push(fn);
  };

  function emit(eventType, urlPath) {
    const path = String(urlPath).split("?")[0].split("#")[0];
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://cloudflareinsights.com/cdn-cgi/rum");
    xhr.send(JSON.stringify({ eventType, location: `https://${host}${path}` }));
  }

  const history = {
    pushState(_state, _title, url) {
      historyLog.push(["push", url]);
      location.pathname = String(url).split("?")[0];
      location.search = "";
      location.hash = "";
      emit(3, url);
      emit(1, url);
    },
    replaceState(_state, _title, url) {
      historyLog.push(["replace", url]);
      const hashAt = String(url).indexOf("#");
      const beforeHash = hashAt === -1 ? String(url) : String(url).slice(0, hashAt);
      const q = beforeHash.indexOf("?");
      location.pathname = q === -1 ? beforeHash : beforeHash.slice(0, q);
      location.search = q === -1 ? "" : beforeHash.slice(q);
      location.hash = hashAt === -1 ? "" : String(url).slice(hashAt);
      emit(1, location.pathname);
    },
    // Browsers fire popstate as a later task, while the beacon patch is still installed.
    back() {
      historyLog.push(["back"]);
      tasks.push(() => {
        location.pathname = initial.pathname;
        location.search = initial.search;
        location.hash = initial.hash;
        emit(1, location.pathname);
        popstate.slice().forEach((fn) => fn());
      });
    },
  };

  const win = {
    DONATE_CONFIG: config,
    DonateGuard: { official, framed },
    addEventListener(_type, fn) { popstate.push(fn); },
    removeEventListener(_type, fn) {
      const at = popstate.indexOf(fn);
      if (at !== -1) popstate.splice(at, 1);
    },
  };

  const sandbox = {
    window: win,
    location,
    history,
    XMLHttpRequest,
    document: {
      head: { appendChild(node) { scripts.push(node); } },
      createElement() {
        const attrs = {};
        return {
          setAttribute(name, value) { attrs[name] = value; },
          getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
        };
      },
    },
    setTimeout(fn, ms) {
      const entry = { fn, ms };
      timers.push(entry);
      return entry;
    },
    clearTimeout(entry) {
      if (entry) entry.fn = null;
    },
  };

  vm.runInNewContext(read("js/analytics.js"), sandbox);
  return {
    analytics: win.DonateAnalytics,
    scripts,
    historyLog,
    sends,
    location,
    tasks,
    timers,
    emit,
  };
}

function loads(sends) {
  return sends.map((body) => JSON.parse(body)).filter((payload) => payload.eventType === 1);
}

test("beacon is injected only for a real token on the official site", () => {
  const ok = runAnalytics();
  assert.equal(ok.analytics.enabled, true);
  assert.equal(ok.scripts.length, 1);
  assert.equal(ok.scripts[0].type, "module");
  assert.equal(ok.scripts[0].src, "https://static.cloudflareinsights.com/beacon.min.js");
  assert.deepEqual(JSON.parse(ok.scripts[0].getAttribute("data-cf-beacon")), { token: TOKEN, spa: true });

  for (const setup of [
    { token: "" },
    { token: "not-a-token" },
    { token: "g".repeat(32) },
    { token: "a".repeat(31) },
    { official: false },
    { framed: true },
    { host: "localhost" },
    { host: "127.0.0.1" },
  ]) {
    const off = runAnalytics(setup);
    assert.equal(off.analytics.enabled, false, JSON.stringify(setup));
    assert.equal(off.scripts.length, 0, JSON.stringify(setup));
  }
});

test("a donate click is one page view of /donate-click, then the URL is restored", () => {
  const page = runAnalytics({ search: "?from=demo&lang=lt", hash: "#top" });
  let finished = 0;
  page.analytics.trackDonateClick(() => { finished += 1; });

  assert.deepEqual(page.historyLog, [
    ["push", "/donate-me/donate-click"],
    ["replace", "/donate-me/?from=demo&lang=lt#top"],
    ["back"],
  ]);
  assert.equal(finished, 0);
  assert.equal(page.location.pathname, "/donate-me/");
  assert.equal(page.location.search, "?from=demo&lang=lt");
  assert.equal(page.location.hash, "#top");
  assert.equal(page.tasks.length, 1);

  page.tasks.shift()();
  assert.equal(finished, 1);
  assert.equal(page.location.pathname, "/donate-me/");
  assert.equal(page.location.search, "?from=demo&lang=lt");
  assert.equal(page.location.hash, "#top");

  const pageviews = loads(page.sends);
  assert.deepEqual(pageviews.map((payload) => payload.location), [
    "https://almantask.github.io/donate-me/donate-click",
  ]);

  // The prototype patch must not swallow later analytics requests.
  page.emit(1, "/donate-me/");
  assert.equal(loads(page.sends).length, 2);
});

test("click path keeps the project-pages directory", () => {
  const cases = {
    "/donate-me/": "/donate-me/donate-click",
    "/donate-me/index.html": "/donate-me/donate-click",
    "/donate-me": "/donate-me/donate-click",
    "/": "/donate-click",
    "/index.html": "/donate-click",
  };
  for (const [pathname, expected] of Object.entries(cases)) {
    const page = runAnalytics({ pathname });
    page.analytics.trackDonateClick();
    assert.equal(page.historyLog[0][1], expected, pathname);
  }
});

test("a missed popstate still puts the real URL back before checkout", () => {
  const page = runAnalytics({ search: "?lang=lt" });
  let finished = 0;
  page.analytics.trackDonateClick(() => { finished += 1; });
  assert.equal(finished, 0);
  assert.equal(page.location.pathname + page.location.search, "/donate-me/?lang=lt");
  assert.equal(page.tasks.length, 1);

  const cap = page.timers.find((entry) => entry.ms === 800 && entry.fn);
  assert.ok(cap);
  cap.fn();
  assert.equal(finished, 1);
  assert.deepEqual(page.historyLog[1], ["replace", "/donate-me/?lang=lt"]);
  assert.equal(page.location.pathname + page.location.search, "/donate-me/?lang=lt");
  assert.deepEqual(loads(page.sends).map((payload) => payload.location), [
    "https://almantask.github.io/donate-me/donate-click",
  ]);
});

test("tracking is a no-op when analytics is off", () => {
  const page = runAnalytics({ token: "" });
  let finished = 0;
  page.analytics.trackDonateClick(() => { finished += 1; });
  assert.equal(finished, 1);
  assert.deepEqual(page.historyLog, []);
  assert.deepEqual(page.sends, []);
});

function loadDonate({ reduced = false, stripeUrl = "https://buy.stripe.com/abc123XYZ", blockReason = null, analytics = true } = {}) {
  const btn = {
    href: "",
    listeners: {},
    classList: { add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const elements = {
    "donate-btn": btn,
    "donate-status": { textContent: "" },
    stage: {},
    fx: {},
  };
  const tracked = [];
  const assigned = [];
  const win = {
    DonateGuard: {
      blockReason: () => blockReason,
      getStripeUrl: () => stripeUrl,
      getProject: () => null,
      rememberProject() {},
    },
    Pixel: {
      SPRITES: { heart: [], sparkle: [], tinySparkle: [], smallHeart: [], coin: [[]] },
      prefersReducedMotion: () => reduced,
      typewrite() {},
      drawSprite() {},
      createScreen() {
        return { P: 4, w: 10, h: 10, ctx: {}, center() { return { x: 1, y: 1 }; }, clear() {} };
      },
      loop() {},
    },
    I18n: { lang: "en", t: (key) => key },
    addEventListener() {},
  };
  if (analytics) {
    win.DonateAnalytics = {
      trackDonateClick(done) { tracked.push(done); },
    };
  }
  const sandbox = {
    window: win,
    URLSearchParams,
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: () => [],
    },
    location: { search: "", assign(url) { assigned.push(url); } },
    setTimeout() { return 0; },
  };
  vm.runInNewContext(read("js/donate.js"), sandbox);

  function click(extra) {
    let prevented = false;
    btn.listeners.click(Object.assign({
      preventDefault() { prevented = true; },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      button: 0,
    }, extra));
    return prevented;
  }

  return { btn, tracked, assigned, click };
}

test("the donate button records a click before checkout", () => {
  const normal = loadDonate();
  assert.equal(normal.click(), true);
  assert.equal(normal.tracked.length, 1);
  assert.equal(normal.tracked[0], undefined);
  assert.deepEqual(normal.assigned, []);

  const reduced = loadDonate({ reduced: true });
  assert.equal(reduced.click(), true);
  assert.equal(reduced.tracked.length, 1);
  assert.equal(typeof reduced.tracked[0], "function");
  assert.deepEqual(reduced.assigned, []);
  reduced.tracked[0]();
  assert.deepEqual(reduced.assigned, ["https://buy.stripe.com/abc123XYZ"]);

  const modified = loadDonate();
  assert.equal(modified.click({ metaKey: true }), false);
  assert.equal(modified.tracked.length, 1);
  assert.equal(modified.tracked[0], undefined);
  assert.deepEqual(modified.assigned, []);

  const blocked = loadDonate({ blockReason: "statusFramed" });
  assert.equal(blocked.click(), true);
  assert.deepEqual(blocked.tracked, []);

  const plain = loadDonate({ analytics: false });
  assert.equal(plain.click(), true);
  assert.deepEqual(plain.assigned, []);
});
