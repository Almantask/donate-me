// The analytics token comes from the CF_BEACON_TOKEN secret at deploy time, not from the repo.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read } = require("./helpers");
const { injectToken } = require("../scripts/inject-analytics-token");

const TOKEN = "0123456789abcdef0123456789ABCDEF";

function evalConfig(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.DONATE_CONFIG;
}

test("the token is written into the published config", () => {
  const cfg = evalConfig(injectToken(read("js/config.js"), TOKEN));
  assert.equal(cfg.cloudflareAnalyticsToken, TOKEN);
});

test("surrounding whitespace from a pasted secret is dropped", () => {
  const cfg = evalConfig(injectToken(read("js/config.js"), ` ${TOKEN}\n`));
  assert.equal(cfg.cloudflareAnalyticsToken, TOKEN);
});

test("no secret leaves the config unchanged", () => {
  const source = read("js/config.js");
  assert.equal(injectToken(source, undefined), source);
  assert.equal(injectToken(source, ""), source);
  assert.equal(injectToken(source, "  \n"), source);
});

test("a malformed secret fails the build", () => {
  const source = read("js/config.js");
  for (const bad of ["not-a-token", "g".repeat(32), "a".repeat(31), `${TOKEN}"`, `${TOKEN}a`]) {
    assert.throws(() => injectToken(source, bad), /CF_BEACON_TOKEN/, JSON.stringify(bad));
  }
});

test("a config without the empty slot fails the build", () => {
  const filled = injectToken(read("js/config.js"), TOKEN);
  assert.throws(() => injectToken(filled, TOKEN), /cloudflareAnalyticsToken/);
});

test("the deploy passes the secret to the build that fills _site/js/config.js", () => {
  const workflow = read(".github/workflows/ci-cd.yml");
  const build = workflow.slice(workflow.indexOf("- name: Build site"), workflow.indexOf("- name: Upload Pages artifact"));
  assert.match(build, /^\s+CF_BEACON_TOKEN: \$\{\{ secrets\.CF_BEACON_TOKEN \}\}$/m);
  const copy = build.indexOf("cp -r");
  const inject = build.indexOf("node scripts/inject-analytics-token.js _site/js/config.js");
  assert.ok(copy !== -1 && inject > copy, "the token must be injected into the copied config");
});
