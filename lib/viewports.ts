import type { ViewportPreset } from "./types";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Realistic desktop Chrome UA. Many production sites (e.g. behind Akamai bot
// protection) serve an "Access Denied" page to the default headless UA, so we
// present as a normal Chrome browser.
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const VIEWPORTS: ViewportPreset[] = [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    isMobile: false,
    deviceScaleFactor: 1,
    userAgent: DESKTOP_UA,
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    isMobile: true,
    deviceScaleFactor: 2,
    userAgent: IPHONE_UA,
  },
];
