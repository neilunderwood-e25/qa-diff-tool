import type { Page } from "playwright";

// Selectors covering the major consent-management platforms plus generic
// cookie/consent/gdpr patterns. Used both as a persistent CSS rule (catches
// banners injected later) and for JS removal (catches scroll-locking overlays).
const CONSENT_SELECTORS = [
  // OneTrust (NetApp)
  "#onetrust-banner-sdk",
  "#onetrust-consent-sdk",
  "#ot-sdk-container",
  ".onetrust-pc-dark-filter",
  // Cookiebot
  "#CybotCookiebotDialog",
  "#CybotCookiebotDialogBodyUnderlay",
  // TrustArc
  "#truste-consent-track",
  "#consent_blackbar",
  ".truste_overlay",
  ".truste_box_overlay",
  // Quantcast / IAB TCF
  "#qc-cmp2-container",
  ".qc-cmp2-container",
  ".qc-cmp-cleanslate",
  // Osano
  ".osano-cm-window",
  ".osano-cm-dialog",
  // Usercentrics
  "#usercentrics-root",
  "#uc-center-container",
  // Didomi
  "#didomi-host",
  "#didomi-popup",
  // CookieYes
  ".cky-consent-container",
  ".cky-overlay",
  // Termly
  "#termly-code-snippet-support",
  // Iubenda
  "#iubenda-cs-banner",
  ".iubenda-cs-container",
  // Borlabs
  "#BorlabsCookieBox",
  // Complianz
  "#cmplz-cookiebanner-container",
  ".cmplz-cookiebanner",
  // Cookie notice / GDPR cookie compliance plugins
  "#cookie-notice",
  "#cookie-law-info-bar",
  ".cli-modal-backdrop",
  // Generic patterns
  '[id*="cookie-banner"]',
  '[class*="cookie-banner"]',
  '[id*="cookie-consent"]',
  '[class*="cookie-consent"]',
  '[id*="cookie-notice"]',
  '[class*="cookie-notice"]',
  '[id*="gdpr"]',
  '[class*="gdpr"]',
  '[aria-label*="cookie" i]',
  '[aria-describedby*="cookie" i]',
  '[class*="consent-banner"]',
  '[id*="consent-banner"]',
];

// Classes that vendors add to <html>/<body> to lock background scrolling while
// the consent modal is open. Removing them restores the real page layout.
const SCROLL_LOCK_CLASSES = [
  "didomi-popup-open",
  "cookie-consent-open",
  "ot-overflow-hidden",
  "cky-consent-open",
  "modal-open",
  "no-scroll",
  "noscroll",
  "overflow-hidden",
];

// Text fragments that mark an element as consent UI. Used to remove custom /
// unknown banners by content without touching legitimate sticky headers.
const CONSENT_KEYWORDS = [
  "we use cookies",
  "this site uses cookies",
  "uses cookies",
  "cookie policy",
  "cookie settings",
  "cookie preferences",
  "manage cookies",
  "accept all cookies",
  "accept cookies",
  "your privacy",
  "privacy choices",
  "consent",
  "gdpr",
  "ccpa",
];

// iframe src fragments for consent platforms that render inside an iframe.
const CONSENT_IFRAME_SRC = [
  "cookielaw",
  "onetrust",
  "cookiebot",
  "trustarc",
  "consent",
  "privacy",
  "usercentrics",
  "didomi",
  "osano",
];

/**
 * Stabilize a page before screenshotting so the diff reflects real layout
 * differences, not animation/lazy-load/banner noise.
 */
export async function preparePage(page: Page): Promise<void> {
  // 1. Kill animations, transitions and the blinking caret so repeated runs
  //    produce identical pixels.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `,
  });

  // 2. Persistent CSS rule that hides every known consent banner/overlay. As a
  //    stylesheet it also applies to banners injected *after* this point, and
  //    re-enables background scrolling the modal may have locked.
  await page.addStyleTag({
    content: `
      ${CONSENT_SELECTORS.join(",\n      ")} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      html, body {
        overflow-y: auto !important;
        position: static !important;
      }
    `,
  });

  // 3. Scroll through the whole page to trigger lazy-loaded images/sections,
  //    then return to the top.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const step = 400;
      let y = 0;
      const timer = setInterval(() => {
        const max = document.body.scrollHeight;
        window.scrollTo(0, y);
        y += step;
        if (y >= max) {
          clearInterval(timer);
          resolve();
        }
      }, 60);
    });
    window.scrollTo(0, 0);
  });

  // 4. Wait for web fonts so text metrics are stable.
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // 5. Let any post-scroll loads settle (banners often inject on a delay).
  //    Bounded so a never-idle page (ads, beacons, blocked retries) can't hang
  //    the capture — best-effort, then a fixed grace period.
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(500);

  // 6. Aggressive sweep: hard-remove every consent overlay still in the DOM —
  //    known selectors, consent iframes, custom-element hosts, and any fixed/
  //    sticky element whose TEXT looks like a cookie banner (so unknown vendors
  //    and edge-anchored bars are caught without touching real sticky headers).
  //    Run TWICE with a gap because some banners inject a second or two late.
  const sweepArgs = {
    selectors: CONSENT_SELECTORS,
    lockClasses: SCROLL_LOCK_CLASSES,
    keywords: CONSENT_KEYWORDS,
    iframeSrc: CONSENT_IFRAME_SRC,
  };

  const sweep = (a: typeof sweepArgs) => {
    // Known selectors.
    document.querySelectorAll(a.selectors.join(",")).forEach((el) => el.remove());

    // Consent iframes.
    document.querySelectorAll("iframe").forEach((f) => {
      const src = (f.getAttribute("src") || "").toLowerCase();
      if (a.iframeSrc.some((h) => src.includes(h))) f.remove();
    });

    // Custom-element hosts (e.g. <usercentrics-root>, <didomi-host>, <cmp-*>).
    document.querySelectorAll("*").forEach((el) => {
      if (
        /(cookie|consent|cmp|gdpr|onetrust|usercentrics|didomi|cookiebot|osano|truste)/.test(
          el.tagName.toLowerCase()
        )
      ) {
        el.remove();
      }
    });

    // Content-based: fixed/sticky elements that read like consent UI.
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const s = getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") return;
      if (s.display === "none" || s.visibility === "hidden") return;
      const text = (el.textContent || "").toLowerCase().slice(0, 500);
      const looksConsent = a.keywords.some((k) => text.includes(k));
      const rect = el.getBoundingClientRect();
      const z = parseInt(s.zIndex || "0", 10);
      const atEdge =
        rect.bottom >= window.innerHeight - 4 || rect.top <= 4;
      const bigOverlay =
        z >= 1000 &&
        el.offsetWidth >= window.innerWidth * 0.9 &&
        el.offsetHeight >= window.innerHeight * 0.9;
      if ((looksConsent && (z >= 5 || atEdge)) || bigOverlay) el.remove();
    });

    // Unlock background scroll regardless of which vendor set it.
    for (const el of [document.documentElement, document.body]) {
      a.lockClasses.forEach((c) => el.classList.remove(c));
      el.style.setProperty("overflow", "auto", "important");
      el.style.setProperty("position", "static", "important");
      el.style.removeProperty("padding-right");
    }
  };

  await page.evaluate(sweep, sweepArgs).catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(sweep, sweepArgs).catch(() => {});
  await page.waitForTimeout(150);
}
