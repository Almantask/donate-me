const test = require("node:test");
const assert = require("node:assert/strict");
const { read, runI18n } = require("./helpers");

test("every language has exactly the same keys, none empty", () => {
  const { I18n } = runI18n();
  const en = Object.keys(I18n.STRINGS.en).sort();
  for (const lang of I18n.SUPPORTED) {
    assert.deepEqual(Object.keys(I18n.STRINGS[lang]).sort(), en, `${lang} keys differ from en`);
    for (const [key, value] of Object.entries(I18n.STRINGS[lang])) {
      assert.ok(typeof value === "string" && value.trim(), `${lang}.${key} is empty`);
      assert.doesNotMatch(value, /[<>]/, `${lang}.${key} must not contain markup`);
    }
  }
});

test("every data-i18n key and status key used by the pages exists", () => {
  const { I18n } = runI18n();
  const used = new Set();
  for (const file of ["index.html", "thanks.html"]) {
    for (const m of read(file).matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
    for (const m of read(file).matchAll(/data-title-key="([^"]+)"/g)) used.add(m[1]);
  }
  for (const file of ["js/guard.js", "js/donate.js", "js/thanks.js"]) {
    for (const m of read(file).matchAll(/"(status[A-Za-z]+|backTo|donateDescription)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 20);
  for (const key of used) assert.ok(key in I18n.STRINGS.en, `missing translation key: ${key}`);
});

test("language selection: ?lang, then saved choice, then browser, then en", () => {
  assert.equal(runI18n({ search: "?lang=lt" }).I18n.lang, "lt");
  assert.equal(runI18n({ search: "?lang=lt" }).store.get("donate-me:lang"), "lt");
  assert.equal(runI18n({ saved: "lt" }).I18n.lang, "lt");
  assert.equal(runI18n({ languages: ["lt-LT", "en"] }).I18n.lang, "lt");
  assert.equal(runI18n({ languages: ["de-DE"] }).I18n.lang, "en");
});

test("unsupported ?lang values are ignored", () => {
  for (const search of ["?lang=de", "?lang=<script>", "?lang=lt%00", "?lang=LT", "?lang="]) {
    const { I18n, store } = runI18n({ search });
    assert.equal(I18n.lang, "en", search);
    assert.equal(store.size, 0, search);
  }
});
