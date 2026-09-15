// Static checks that keep the page hardened as it changes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, read, loadConfig, runGuard } = require("./helpers");

const PAGES = ["index.html", "thanks.html"];
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; " +
  "connect-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests";

function listFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir)).map((f) => `${dir}/${f}`);
}

test("pages ship the strict CSP and no-referrer policy", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`), `${page}: CSP missing or changed`);
    assert.ok(html.includes('<meta name="referrer" content="no-referrer">'), `${page}: referrer policy missing`);
  }
});

test("guard.js loads synchronously before any other page script", () => {
  for (const page of PAGES) {
    const scripts = [...read(page).matchAll(/<script\b([^>]*)><\/script>/g)].map((m) => m[1]);
    assert.match(scripts[0], /src="js\/config\.js"/, page);
    assert.match(scripts[1], /src="js\/guard\.js"/, page);
    assert.doesNotMatch(scripts[1], /defer|async/, page);
  }
});

test("no inline scripts, inline styles, event handlers or external resources", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${page}: inline <script>`);
    assert.doesNotMatch(html, /<style[\s>]/i, `${page}: inline <style>`);
    assert.doesNotMatch(html, /\sstyle=/i, `${page}: style attribute`);
    assert.doesNotMatch(html, /\son[a-z]+=/i, `${page}: inline event handler`);
    for (const m of html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\s(?:src|href)="([^"]+)"/gi)) {
      assert.doesNotMatch(m[1], /^(?:[a-z]+:)?\/\//i, `${page}: external resource ${m[1]}`);
    }
  }
  assert.doesNotMatch(read("css/style.css"), /url\(\s*["']?(?:[a-z]+:)?\/\//i, "style.css: external url()");
});

test("external links never leak the opener", () => {
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/gi)) {
      assert.match(m[0], /rel="[^"]*noopener[^"]*"/, `${page}: ${m[0]}`);
    }
  }
});

test("scripts avoid dangerous DOM and eval APIs", () => {
  const banned = /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(|new Function)\b/;
  for (const file of listFiles("js")) {
    assert.doesNotMatch(read(file), banned, file);
  }
});

test("no Stripe secret or restricted keys anywhere in the site", () => {
  const files = [...PAGES, ...listFiles("js"), "css/style.css", "README.md"];
  for (const file of files) {
    assert.doesNotMatch(read(file), /\b(sk|rk)_(live|test)_[A-Za-z0-9]{8,}/, file);
  }
});

test("config is valid", () => {
  const cfg = loadConfig();
  assert.ok(cfg.displayName && cfg.stripeBusinessName, "names required");
  assert.ok(Array.isArray(cfg.officialHosts) && cfg.officialHosts.length, "officialHosts required");
  assert.ok(cfg.officialHosts.includes(new URL(cfg.officialUrl).hostname), "officialUrl must be on an official host");
  assert.equal(new URL(cfg.officialUrl).protocol, "https:");

  const { guard } = runGuard({ config: cfg });
  if (cfg.stripePaymentLink) {
    assert.ok(guard.getStripeUrl(), "stripePaymentLink is set but is not a valid https://buy.stripe.com/<id> link");
  }
  for (const slug of Object.keys(cfg.projects || {})) {
    assert.ok(guard.getProject(slug), `projects.${slug} is invalid (slug must be [a-z0-9-], url must be https, name required)`);
  }
});
