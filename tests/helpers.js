// Runs the browser scripts inside a Node sandbox with a minimal fake DOM.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(read("js/config.js"), sandbox);
  return sandbox.window.DONATE_CONFIG;
}

function runGuard({
  config = loadConfig(),
  host = "almantask.github.io",
  protocol = "https:",
  framed = false,
} = {}) {
  const classes = new Set();
  const win = { DONATE_CONFIG: structuredClone(config) };
  win.self = win;
  win.top = framed ? {} : win;
  const storage = new Map();
  const sandbox = {
    window: win,
    URL,
    location: { hostname: host, protocol },
    document: {
      documentElement: { classList: { add: (c) => classes.add(c) } },
      addEventListener() {},
    },
    sessionStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
  };
  vm.runInNewContext(read("js/guard.js"), sandbox);
  return { guard: win.DonateGuard, classes, config: win.DONATE_CONFIG };
}

function runI18n({ search = "", languages = ["en-US"], saved = null } = {}) {
  const win = { DonateGuard: { displayName: () => "Tester" } };
  const store = new Map(saved ? [["donate-me:lang", saved]] : []);
  const sandbox = {
    window: win,
    URLSearchParams,
    location: { search },
    navigator: { languages },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    document: {
      documentElement: { lang: "", getAttribute: () => null },
      querySelectorAll: () => [],
      querySelector: () => null,
    },
  };
  vm.runInNewContext(read("js/i18n.js"), sandbox);
  return { I18n: win.I18n, store };
}

module.exports = { ROOT, read, loadConfig, runGuard, runI18n };
