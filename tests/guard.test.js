const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig, runGuard } = require("./helpers");

function withLink(link, extra = {}) {
  return { ...loadConfig(), stripePaymentLink: link, ...extra };
}

const DEMO = { demo: { name: "Demo", url: "https://almantask.github.io/demo/" } };

test("accepts live and test Stripe Payment Links", () => {
  for (const link of ["https://buy.stripe.com/bIY3ex8Vc0AB5Ow5kk", "https://buy.stripe.com/test_abc123XYZ"]) {
    const { guard } = runGuard({ config: withLink(link) });
    assert.equal(guard.getStripeUrl(), link);
  }
});

test("rejects anything that is not a plain buy.stripe.com link", () => {
  const bad = [
    "",
    "http://buy.stripe.com/abc123XYZ",
    "https://buy.stripe.com.evil.io/abc123XYZ",
    "https://buy.stripe.com@evil.io/abc123XYZ",
    "https://user:pass@buy.stripe.com/abc123XYZ",
    "https://checkout.stripe.com/abc123XYZ",
    "https://evil.io/buy.stripe.com/abc123XYZ",
    "https://buy.stripe.com:8443/abc123XYZ",
    "https://buy.stripe.com/../evil",
    "https://buy.stripe.com/abc/123XYZ",
    "https://buy.stripe.com/abc123XYZ?redirect=https://evil.io",
    "https://buy.stripe.com/abc123XYZ#x",
    "javascript:alert(1)",
    "data:text/html,hi",
    null,
    42,
  ];
  for (const link of bad) {
    const { guard } = runGuard({ config: withLink(link) });
    assert.equal(guard.getStripeUrl(), null, `should reject ${String(link)}`);
  }
});

test("blocks donations on hosts other than the official one", () => {
  const link = "https://buy.stripe.com/abc123XYZ";
  for (const host of ["evil.github.io", "almantask.github.io.evil.io", "example.com", ""]) {
    const { guard, classes } = runGuard({ config: withLink(link), host });
    assert.equal(guard.blockReason(), "statusUnofficial", host);
    assert.ok(classes.has("is-unofficial"), host);
  }
});

test("requires https on the official host, allows dev hosts", () => {
  const link = "https://buy.stripe.com/abc123XYZ";
  assert.equal(runGuard({ config: withLink(link), protocol: "http:" }).guard.blockReason(), "statusUnofficial");
  assert.equal(runGuard({ config: withLink(link), host: "localhost", protocol: "http:" }).guard.blockReason(), null);
  assert.equal(runGuard({ config: withLink(link) }).guard.blockReason(), null);
});

test("blocks donations when framed", () => {
  const { guard, classes } = runGuard({ config: withLink("https://buy.stripe.com/abc123XYZ"), framed: true });
  assert.equal(guard.blockReason(), "statusFramed");
  assert.ok(classes.has("is-framed"));
});

test("only allowlisted project slugs with https URLs are used", () => {
  const projects = {
    ...DEMO,
    insecure: { name: "Insecure", url: "http://example.com/" },
    script: { name: "Script", url: "javascript:alert(1)" },
    nameless: { url: "https://example.com/" },
  };
  const { guard } = runGuard({ config: withLink("https://buy.stripe.com/abc123XYZ", { projects }) });

  assert.deepEqual({ ...guard.getProject("demo") }, { slug: "demo", name: "Demo", url: "https://almantask.github.io/demo/" });
  for (const slug of ["insecure", "script", "nameless", "unknown", "__proto__", "constructor",
    "hasOwnProperty", "https://evil.io", "<img src=x>", "DEMO", "", null, undefined]) {
    assert.equal(guard.getProject(slug), null, `should reject ${String(slug)}`);
  }
});

test("adds client_reference_id and locale only for allowed values", () => {
  const { guard } = runGuard({ config: withLink("https://buy.stripe.com/abc123XYZ", { projects: DEMO }) });
  assert.equal(guard.getStripeUrl("demo", "lt"), "https://buy.stripe.com/abc123XYZ?client_reference_id=demo&locale=lt");
  assert.equal(guard.getStripeUrl("nope", "xx"), "https://buy.stripe.com/abc123XYZ");
  assert.equal(guard.getStripeUrl("demo&x=1", "lt&x=1"), "https://buy.stripe.com/abc123XYZ");
});

test("remembers only allowlisted projects across the Stripe round trip", () => {
  const { guard } = runGuard({ config: withLink("https://buy.stripe.com/abc123XYZ", { projects: DEMO }) });
  guard.rememberProject("https://evil.io");
  assert.equal(guard.recalledProject(), null);
  guard.rememberProject("demo");
  assert.equal(guard.recalledProject().url, "https://almantask.github.io/demo/");
});

test("config and guard API are frozen against runtime tampering", () => {
  const { guard, config } = runGuard({ config: withLink("https://buy.stripe.com/abc123XYZ", { projects: DEMO }) });
  assert.ok(Object.isFrozen(guard));
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.projects.demo));
  assert.ok(Object.isFrozen(config.officialHosts));
});
