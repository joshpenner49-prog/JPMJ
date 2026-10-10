/* ============================================
   JP MOTORSPORT JOURNAL — analytics + cookie choice
   Google Analytics (GA4) loads ONLY after a visitor accepts.
   Nothing is sent to Google before that. A browser Global Privacy
   Control signal counts as a decline unless the visitor chose otherwise.

   To change the Measurement ID, edit GA_ID below — nothing else.
   Any element with a data-cookie-settings attribute reopens the banner.
   ============================================ */
(function () {
  "use strict";

  var GA_ID = "G-Z4GN06P38R";
  var KEY = "jp-analytics-consent"; // "granted" | "denied"
  var loaded = false;

  function readChoice() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function saveChoice(v) {
    try { window.localStorage.setItem(KEY, v); } catch (e) { /* private mode: choice lasts this page only */ }
  }

  /* ---------- Google Analytics ---------- */
  function loadGA() {
    if (loaded) return;
    loaded = true;
    window["ga-disable-" + GA_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }

  function clearGACookies() {
    window["ga-disable-" + GA_ID] = true;
    var host = location.hostname.split(".");
    var domains = [location.hostname];
    for (var i = 1; i < host.length - 1; i++) domains.push("." + host.slice(i).join("."));
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0 || name === "_gid") {
        domains.forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + d;
        });
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
    });
  }

  /* ---------- Banner ---------- */
  var banner = null;

  function injectStyles() {
    if (document.getElementById("jp-consent-css")) return;
    var css = [
      ".jp-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--black-panel,#111214);color:var(--on-black,#f2f3f5);",
      "border-top:2px solid var(--red,#c8102e);font-family:var(--font-mono,monospace);font-size:12.5px;line-height:1.55;",
      "transform:translateY(100%);transition:transform .28s ease}",
      ".jp-consent.is-open{transform:translateY(0)}",
      ".jp-consent__inner{max-width:var(--max-w,1180px);margin:0 auto;padding:16px 20px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}",
      ".jp-consent__text{flex:1 1 420px;margin:0;color:var(--on-black,#f2f3f5)}",
      ".jp-consent__text a{color:var(--on-black,#f2f3f5);text-decoration:underline;text-underline-offset:3px}",
      ".jp-consent__actions{display:flex;gap:10px;flex:0 0 auto}",
      ".jp-consent__btn{font:inherit;font-weight:700;min-width:104px;padding:10px 18px;border-radius:4px;cursor:pointer;",
      "border:1px solid var(--on-black-dim,#9a9fa6);background:transparent;color:var(--on-black,#f2f3f5)}",
      ".jp-consent__btn:hover{border-color:var(--on-black,#f2f3f5)}",
      ".jp-consent__btn--accept{background:var(--red,#c8102e);border-color:var(--red,#c8102e);color:#fff}",
      ".jp-consent__btn--accept:hover{filter:brightness(1.1)}",
      ".jp-consent__btn:focus-visible{outline:2px solid #fff;outline-offset:2px}",
      "@media (max-width:560px){.jp-consent__actions{width:100%}.jp-consent__btn{flex:1}}",
      "@media (prefers-reduced-motion:reduce){.jp-consent{transition:none}}"
    ].join("");
    var st = document.createElement("style");
    st.id = "jp-consent-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  function privacyHref() {
    // Works from the site root and from /drivers/<n>/ pages.
    return /\/drivers\/[^\/]+\/?(index\.html)?$/.test(location.pathname) ? "../../privacy.html" : "privacy.html";
  }

  function buildBanner() {
    injectStyles();
    banner = document.createElement("div");
    banner.className = "jp-consent";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie choice");
    banner.innerHTML =
      '<div class="jp-consent__inner">' +
        '<p class="jp-consent__text">Can we use Google Analytics to see which pages get read? ' +
        'It sets cookies only if you accept. <a href="' + privacyHref() + '">Privacy details</a></p>' +
        '<div class="jp-consent__actions">' +
          '<button type="button" class="jp-consent__btn" data-choice="denied">Decline</button>' +
          '<button type="button" class="jp-consent__btn jp-consent__btn--accept" data-choice="granted">Accept</button>' +
        '</div>' +
      '</div>';
    banner.addEventListener("click", function (e) {
      var b = e.target.closest("[data-choice]");
      if (!b) return;
      choose(b.getAttribute("data-choice"));
    });
    document.body.appendChild(banner);
  }

  function showBanner() {
    if (!banner) buildBanner();
    // Two frames so the slide-in transition runs
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add("is-open");
        document.body.style.paddingBottom = banner.offsetHeight + "px";
      });
    });
  }

  function hideBanner() {
    if (!banner) return;
    banner.classList.remove("is-open");
    document.body.style.paddingBottom = "";
  }

  function choose(value) {
    saveChoice(value);
    hideBanner();
    if (value === "granted") loadGA();
    else clearGACookies();
  }

  /* ---------- Start ---------- */
  function init() {
    var stored = readChoice();
    var gpc = navigator.globalPrivacyControl === true;

    if (stored === "granted") {
      loadGA();
    } else if (stored === "denied" || gpc) {
      window["ga-disable-" + GA_ID] = true;
    } else {
      // Wait a beat so the homepage entrance animation isn't covered
      setTimeout(showBanner, 1200);
    }

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-cookie-settings]");
      if (!t) return;
      e.preventDefault();
      showBanner();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
