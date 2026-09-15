# donate-me

A retro pixel-art donation page for my open-source projects, with no backend.

- **Donate page** (`index.html`): a beating 8-bit heart, floating hearts and an `INSERT COIN` button that opens a Stripe Payment Link.
- **Thank-you page** (`thanks.html`): Stripe redirects here after payment. The heart levels up, bursts into pixel confetti, and stars rain down.
- **Cost:** hosting on GitHub Pages is free. Stripe charges only its processing fee (roughly 1.5% + €0.25 for EEA cards). There's no platform fee and no subscription.
- **Privacy:** donors see your handle and Stripe's checkout, not your personal details. The page makes no third-party requests: no analytics, CDN or Google Fonts.
- **Languages:** English and Lithuanian, with an EN/LT switch in the corner.
- **CI/CD:** GitHub Actions runs the security tests on every push and pull request, and deploys to GitHub Pages only when they pass.

The only file you need to edit is [`js/config.js`](js/config.js).

---

## 1. Set up Stripe

### Account and privacy
1. Create a Stripe account and **turn on 2FA** (a passkey or authenticator app).
2. Go to **Settings → Business → Public details**:
   - **Public business name:** your handle (e.g. `Almantask`). It must match `stripeBusinessName` in the config.
   - **Support email:** a dedicated alias, not your personal inbox.
   - **Statement descriptor:** something like `ALMANTASK OSS`.
   - Leave out your phone number and address wherever Stripe allows it.
3. Describe the business accurately, e.g. *"Independent open-source software developer, accepting voluntary support payments."* A misleading description is a common reason for accounts getting frozen. Check Stripe's restricted-business list for your country before going live.

> Stripe still verifies your identity (KYC), and card networks may show your support email on donors' statements. Donors don't see your legal name or address on the checkout page.

### Payment Link
1. Go to **Payment Links → New**.
2. Add a product named "Donation" with the description *"Voluntary donation to support open-source work. No goods or services are provided."*
3. Choose **Customers choose what to pay**:
   - Suggested amount: €5
   - **Minimum: €2** (tiny amounts attract card testers)
   - **Maximum: €500**
4. Under **Payment methods**, allow only cards and wallets (Apple Pay, Google Pay). Leave out delayed-notification methods.
5. Under **After payment**, choose **Don't show confirmation page → Redirect customers to your website**:
   `https://almantask.github.io/donate-me/thanks.html`
6. Add the same "voluntary donation, no goods or services" wording as custom text on the checkout, if offered. It helps if you ever face a dispute. Since the page is bilingual, you can write it in both languages: *"Voluntary donation to support open-source work. No goods or services are provided. / Savanoriška parama atvirojo kodo darbui. Mainais nesuteikiamos jokios prekės ar paslaugos."*
7. Copy the link (`https://buy.stripe.com/...`) into `stripePaymentLink` in `js/config.js`.

**Tip:** do everything in **test mode** first. A test link (`https://buy.stripe.com/test_...`) works with the page too.

## 2. Edit `js/config.js`

| Key | What it is |
|---|---|
| `displayName` | Handle shown on the page |
| `stripeBusinessName` | Must equal Stripe's public business name. Donors are told to check it |
| `stripePaymentLink` | Your Payment Link. The button stays disabled until it's a valid `https://buy.stripe.com/...` URL |
| `officialUrl`, `officialHosts` | Where the real page lives. Any other host shows a warning and disables donations |
| `githubUrl` | Where the thank-you page's back button goes |
| `projects` | Optional allowlist for `?from=` links (see below) |

## 3. Publish on GitHub Pages (free, via CI/CD)

One-time setup:
1. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Tick **Enforce HTTPS**.
3. Go to **Settings → Environments → github-pages** and make sure **Deployment branches** is limited to `main`. GitHub normally sets this for you.

After that, every push to `main` runs [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

| Job | What it does |
|---|---|
| **Test & build** | Runs `npm test` (no dependencies), warns if the payment link is empty, and copies only the public site files into `_site/` |
| **Deploy to GitHub Pages** | Runs only on `main` after the tests pass, and publishes `_site/` to `https://almantask.github.io/donate-me/` |

Pull requests run the tests but never deploy. The workflow is locked down:
- read-only permissions by default; only the deploy job gets `pages: write`
- actions pinned to commit SHAs and kept current by Dependabot
- checkout without persisted credentials
- no `pull_request_target`

### What the tests check
- **Guard:** the Stripe link validation rejects lookalike domains, `user@host` tricks, http, ports, query strings and `javascript:` URLs. Forks and other hosts are blocked, framing is blocked, and the project allowlist is enforced (including `__proto__`-style slugs). The config is frozen.
- **Site hardening:** the exact CSP and referrer policy are present on every page. There are no inline scripts, styles or event handlers, and no external resources. External links use `rel="noopener"`. Nothing uses `innerHTML`, `eval` or similar. No Stripe secret keys are committed.
- **Translations:** EN and LT have identical keys, every key used in the pages exists, and unsupported `?lang=` values are ignored.
- **Config:** a non-empty payment link must be valid, and every project entry must be valid. A typo in `js/config.js` fails the build instead of breaking the live page.

Run the tests locally with `npm test` (Node 22+).

## 4. Add a donate button to your projects

```html
<a href="https://almantask.github.io/donate-me/?from=my-project" rel="noopener">♥ Donate</a>
```

`?from=` is optional. If `my-project` is listed in `config.projects`:
- the page says "Thanks for enjoying My Project"
- the Stripe payment carries `client_reference_id=my-project`, so your Stripe dashboard shows which project each donation came from
- the thank-you page's back button returns to that project

Slugs that aren't in the allowlist are ignored.

### Languages

The page chooses the language from, in order:
1. `?lang=en` or `?lang=lt`
2. the visitor's earlier choice
3. the browser language
4. English

Link straight to the Lithuanian version with `https://almantask.github.io/donate-me/?lang=lt&from=my-project`. Stripe checkout opens in the same language (`locale=lt`), and the thank-you page remembers it.

All text lives in [`js/i18n.js`](js/i18n.js). The tests fail if a key is missing from either language.

---

## Security checklist

### How the page protects donors from scammers using your name
- **Forks and copies are neutralised.** The page only takes donations on the hosts in `officialHosts`. Anywhere else, it shows a red "not the official page" banner and disables the button. A determined copier can remove this, which is why donors are also told to check the recipient name on Stripe.
- **No open redirects.** No link target ever comes from the URL or the referrer, only from `config.js`.
- **No XSS.** All dynamic text is set with `textContent`, and a strict Content-Security-Policy allows only this site's own scripts, styles and fonts.
- **Payment link pinning.** The button only ever goes to `https://buy.stripe.com/<id>`.
- **Clickjacking.** If the page is loaded inside another site's frame, it hides itself and offers a link to the real page.
- **Social-engineering warnings.** The page and [SECURITY.md](SECURITY.md) state that you never ask for payment by DM, email, gift cards or crypto.
- **All rights reserved.** There's deliberately no open-source license, so copies that impersonate you are easier to take down. The bundled font is under the OFL (`fonts/OFL.txt`).

### What you should do to protect yourself
- [ ] 2FA on **GitHub** and **Stripe**. Whoever controls your GitHub account can swap the payment link, so this is the most important item.
- [ ] Add a branch ruleset on `main` (**Settings → Rules → Rulesets**) that blocks force pushes and deletion. Optionally also require the **Test & build** check to pass before merging.
- [ ] **Enforce HTTPS** in Pages settings.
- [ ] Turn on Stripe email notifications for payouts and for changes to bank account or account details.
- [ ] Set a minimum and maximum amount on the Payment Link (card-testing protection).
- [ ] Keep Stripe's built-in fraud protection (Radar) on. In the EEA, Strong Customer Authentication already sends most card payments through 3D Secure, which moves fraud-chargeback liability to the card issuer. Custom Radar rules, such as always requesting 3D Secure, need the paid Radar for Fraud Teams, which is optional.
- [ ] **Refunds only through the Stripe dashboard, to the original payment method.** Never refund to a different card, bank account or wallet, whatever the "donor" says (the overpayment scam).
- [ ] Ignore emails and messages claiming to be from Stripe. Always log in to the dashboard directly.
- [ ] Treat the thank-you page as decoration. Anyone can open it. Only your Stripe dashboard confirms a donation.
- [ ] **Never** commit Stripe secret keys (`sk_...`). This project doesn't need them.

## Local development

```bash
python -m http.server 8080
```

Open http://localhost:8080. `localhost` counts as a development host, so the button works with a test link.
