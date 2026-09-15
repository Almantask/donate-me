/*
 * The ONLY file you need to edit.
 *
 * Nothing in here is secret: a Stripe Payment Link is a public URL.
 * NEVER put Stripe secret keys (sk_...) or any other secret in this repo.
 */
window.DONATE_CONFIG = {
  // Your public handle. Shown on the page. Don't use your legal name.
  displayName: "Almantask",

  // Must match "Public business name" in Stripe (Settings -> Business -> Public details).
  // Donors are told to check that Stripe checkout shows exactly this name.
  stripeBusinessName: "Almantask",

  // Your Stripe Payment Link, e.g. "https://buy.stripe.com/abc123XYZ".
  // Test-mode links ("https://buy.stripe.com/test_...") work too.
  // Leave it empty and the donate button stays disabled.
  stripePaymentLink: "https://buy.stripe.com/9B6bJ01YNfp17529wj8EM00",

  // Where the official page lives. If the page is served from any other
  // host (a fork, a copy, a mirror), it shows a warning and won't take donations.
  officialUrl: "https://almantask.github.io/donate-me/",
  officialHosts: ["almantask.github.io"],

  // Hosts allowed for local development only.
  devHosts: ["localhost", "127.0.0.1"],

  githubUrl: "https://github.com/Almantask",

  // Optional allowlist for ?from=<slug> links from your project sites.
  // Slugs: lowercase letters, digits and dashes. URLs must be https.
  // Unknown slugs are ignored, so this can't be abused as a redirect.
  projects: {
    // "my-project": { name: "My Project", url: "https://almantask.github.io/my-project/" },
  },
};
