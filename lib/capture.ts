import type { Browser } from "playwright";
import type { ViewportPreset } from "./types";
import { preparePage } from "./prepare";

// Network hosts for the major consent-management platforms. We abort requests
// to these so the banner script never loads — the most reliable way to keep
// cookie popups out of the screenshot entirely.
const CMP_HOSTS = [
  "cookielaw.org", // OneTrust (NetApp)
  "onetrust.com",
  "cookiebot.com",
  "trustarc.com",
  "osano.com",
  "cookieyes.com",
  "usercentrics.eu",
  "app.usercentrics",
  "privacy-center.org", // Didomi
  "didomi.io",
  "quantcast",
  "consensu.org",
  "cookie-script.com",
  "iubenda.com",
  "termly.io",
  "civiccomputing.com", // Cookie Control
  "cookiepro.com",
  "trustcommander", // Commanders Act
];

// Cookies that suppress the most common banners up-front (host-scoped). The
// OneTrust `OptanonAlertBoxClosed` timestamp is the key one for NetApp — its
// presence tells OneTrust the banner was already dismissed.
function consentCookies(url: string) {
  const closed = new Date().toISOString();
  return [
    { name: "OptanonAlertBoxClosed", value: closed, url },
    { name: "CookieConsent", value: "-1", url },
    { name: "cookieconsent_status", value: "dismiss", url },
    { name: "cookie_consent", value: "true", url },
    { name: "cookies_accepted", value: "true", url },
  ];
}

/**
 * Capture a full-page PNG screenshot of `url` at the given viewport.
 * Each call uses its own browser context for isolation. Throws on
 * navigation failure / timeout so the caller can record a per-URL error.
 */
export async function captureScreenshot(
  browser: Browser,
  url: string,
  viewport: ViewportPreset
): Promise<Buffer> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    hasTouch: viewport.isMobile,
    userAgent: viewport.userAgent,
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Hide the `navigator.webdriver` flag that bot-detection scripts check.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Pre-dismiss banners: seed consent cookies and block the consent-vendor
  // scripts so the popup never initializes.
  await context.addCookies(consentCookies(url));
  for (const host of CMP_HOSTS) {
    await context.route(`**${host}**`, (route) => route.abort());
  }

  try {
    const page = await context.newPage();
    // Wait for the DOM, not full network idle: heavy marketing sites (and
    // blocked consent retries) often never reach "networkidle" within the
    // timeout. preparePage() then scrolls to trigger lazy content and does a
    // short, bounded settle.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await preparePage(page);
    return await page.screenshot({ fullPage: true, type: "png" });
  } finally {
    await context.close();
  }
}
