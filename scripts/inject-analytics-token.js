// Writes the Cloudflare Web Analytics site token into the built config.
// The token comes from the CF_BEACON_TOKEN repository secret, never from the repo.
// Usage: CF_BEACON_TOKEN=... node scripts/inject-analytics-token.js _site/js/config.js
const fs = require("node:fs");

const TOKEN_RE = /^[a-f0-9]{32}$/i;
const SLOT_RE = /^(\s*cloudflareAnalyticsToken:\s*)""/m;

function injectToken(source, token) {
  const value = (token || "").trim();
  if (!value) return source;
  // A bad secret fails the build instead of shipping a broken page.
  if (!TOKEN_RE.test(value)) {
    throw new Error("CF_BEACON_TOKEN is not a Cloudflare Web Analytics site token (32 hex characters)");
  }
  if (!SLOT_RE.test(source)) {
    throw new Error('config has no empty cloudflareAnalyticsToken: "" to fill');
  }
  return source.replace(SLOT_RE, (_, prefix) => `${prefix}"${value}"`);
}

if (require.main === module) {
  const file = process.argv[2];
  const token = process.env.CF_BEACON_TOKEN;
  fs.writeFileSync(file, injectToken(fs.readFileSync(file, "utf8"), token));
  if ((token || "").trim()) {
    console.log(`Analytics token written to ${file}`);
  } else {
    console.log("::warning::CF_BEACON_TOKEN secret is not set - page views and donate clicks will not be tracked.");
  }
}

module.exports = { injectToken };
