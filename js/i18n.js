/*
 * English / Lithuanian translations.
 *
 * Language order: ?lang= (en|lt only) -> saved choice -> browser language -> en.
 * Elements with data-i18n="key" get their text replaced (textContent only).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "donate-me:lang";
  var SUPPORTED = ["en", "lt"];

  var STRINGS = {
    en: {
      donateTitle: "Insert Coin · Support {name}",
      donateDescription: "Official donation page for {name}'s open-source projects.",
      thanksTitle: "Thank You! · {name}",
      language: "Language",

      warning: "WARNING",
      framedText: "This page has been embedded inside another website, which is not allowed.",
      openOfficial: "OPEN OFFICIAL PAGE",
      unofficialA: "⚠ This is NOT the official page of ",
      unofficialB: ". Don't pay here.",
      unofficialC: "The official page is ",

      eyebrow: "PLAYER 2 HAS ENTERED",
      support: "SUPPORT",
      projectThanks: "Thanks for enjoying ",
      line1: "Thank you for playing with my projects.",
      line2: "Every coin keeps the servers on and the ideas coming.",
      insertCoin: "INSERT COIN",
      hint: "Secure checkout by Stripe. You choose the amount. Cards, Apple Pay and Google Pay.",
      staySafe: "STAY SAFE",
      safe1a: "Checkout opens on a ",
      safe1b: " address and shows ",
      safe1c: " as the recipient. If it shows anything else, don't pay.",
      safe2: "I will never ask for donations by DM, email, gift cards or crypto. The only official page is ",
      safe3: "Donations are voluntary support for open-source work. No goods or services are provided in return.",

      statusConfig: "CONFIGURATION MISSING.",
      statusFramed: "THIS PAGE IS EMBEDDED IN ANOTHER SITE. OPEN THE OFFICIAL PAGE.",
      statusUnofficial: "THIS IS NOT THE OFFICIAL PAGE. DONATIONS ARE DISABLED HERE.",
      statusNotSetUp: "DONATIONS ARE NOT SET UP YET.",

      thankYou: "THANK YOU!",
      achievementA: "ACHIEVEMENT UNLOCKED: ",
      achievementB: "SUPPORTER",
      projectSupport: "You're supporting ",
      thanksLine1: "You just made my day.",
      thanksLine2: "Your support keeps me building. See you in the next level!",
      backProjects: "BACK TO THE PROJECTS",
      backTo: "BACK TO {project}",
      receiptNote: "If your payment went through, Stripe has emailed you a receipt. This page on its own does not confirm a payment.",
    },
    lt: {
      donateTitle: "Įmesk monetą · Paremk {name}",
      donateDescription: "Oficialus {name} atvirojo kodo projektų paramos puslapis.",
      thanksTitle: "Ačiū! · {name}",
      language: "Kalba",

      warning: "DĖMESIO",
      framedText: "Šis puslapis įterptas į kitą svetainę, o taip daryti neleidžiama.",
      openOfficial: "ATIDARYTI OFICIALŲ PUSLAPĮ",
      unofficialA: "⚠ Tai NĖRA oficialus paramos puslapis (",
      unofficialB: "). Nemokėk čia.",
      unofficialC: "Oficialus puslapis: ",

      eyebrow: "PRISIJUNGĖ 2 ŽAIDĖJAS",
      support: "PAREMK",
      projectThanks: "Ačiū, kad patinka: ",
      line1: "Ačiū, kad išbandai mano projektus.",
      line2: "Kiekviena moneta palaiko serverius ir naujas idėjas.",
      insertCoin: "ĮMESK MONETĄ",
      hint: "Saugus mokėjimas per Stripe. Suma – tavo pasirinkimu. Kortelės, Apple Pay ir Google Pay.",
      staySafe: "SAUGUMAS",
      safe1a: "Mokėjimo puslapis atsidaro ",
      safe1b: " adresu, o gavėjas jame nurodytas kaip ",
      safe1c: ". Jei matai kitą pavadinimą – nemokėk.",
      safe2: "Niekada neprašysiu paramos žinutėmis, el. paštu, dovanų kortelėmis ar kriptovaliuta. Vienintelis oficialus puslapis: ",
      safe3: "Parama yra savanoriška ir skirta atvirojo kodo darbui. Mainais nesuteikiamos jokios prekės ar paslaugos.",

      statusConfig: "TRŪKSTA NUSTATYMŲ.",
      statusFramed: "PUSLAPIS ĮTERPTAS Į KITĄ SVETAINĘ. ATIDARYK OFICIALŲ PUSLAPĮ.",
      statusUnofficial: "TAI NE OFICIALUS PUSLAPIS. PARAMA ČIA IŠJUNGTA.",
      statusNotSetUp: "PARAMA DAR NEĮJUNGTA.",

      thankYou: "AČIŪ!",
      achievementA: "PASIEKIMAS ATRAKINTAS: ",
      achievementB: "GERAS DARBAS",
      projectSupport: "Tu remi: ",
      thanksLine1: "Tu ką tik praskaidrinai mano dieną.",
      thanksLine2: "Tavo parama padeda man kurti toliau. Iki pasimatymo kitame lygyje!",
      backProjects: "ATGAL Į PROJEKTUS",
      backTo: "ATGAL: {project}",
      receiptNote: "Jei mokėjimas pavyko, Stripe atsiuntė kvitą el. paštu. Šis puslapis pats savaime mokėjimo nepatvirtina.",
    },
  };

  function supported(value) {
    return typeof value === "string" && SUPPORTED.indexOf(value) !== -1 ? value : null;
  }

  function load() {
    try {
      return supported(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  function save(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* storage unavailable: choice lasts for this page only */ }
  }

  function fromBrowser() {
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var code = supported(String(langs[i]).slice(0, 2).toLowerCase());
      if (code) return code;
    }
    return null;
  }

  var params = new URLSearchParams(location.search);
  var fromParam = supported(params.get("lang"));
  if (fromParam) save(fromParam);
  var lang = fromParam || load() || fromBrowser() || "en";

  function t(key, vars) {
    var value = STRINGS[lang][key];
    if (value == null) value = STRINGS.en[key];
    if (value == null) return key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        value = value.split("{" + name + "}").join(vars[name]);
      });
    }
    return value;
  }

  document.documentElement.lang = lang;

  Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  var name = window.DonateGuard ? window.DonateGuard.displayName() : "";
  var titleKey = document.documentElement.getAttribute("data-title-key");
  if (titleKey) document.title = t(titleKey, { name: name });
  var description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", t("donateDescription", { name: name }));

  // Language switcher: plain ?lang= links that keep the other query params.
  Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (link) {
    var code = supported(link.getAttribute("data-lang"));
    if (!code) return;
    var next = new URLSearchParams(location.search);
    next.set("lang", code);
    // Query-only relative URL: stays on this exact page, can't point elsewhere.
    link.setAttribute("href", "?" + next.toString());
    if (code === lang) link.setAttribute("aria-current", "true");
  });
  var nav = document.querySelector(".lang-switch");
  if (nav) nav.setAttribute("aria-label", t("language"));

  window.I18n = Object.freeze({ lang: lang, t: t, SUPPORTED: SUPPORTED, STRINGS: STRINGS });
})();
