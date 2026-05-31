// Supported localization codes. `en` is the default locale and has NO path
// prefix; every other locale is inserted as the first path segment, e.g.
//   en  -> https://host/customers/acens-caso-de-exito/
//   fr  -> https://host/fr/customers/acens-caso-de-exito/
export const LOCALES = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "ja",
  "ko",
  "pt",
  "zh-hans",
  "zh-hant",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const NON_DEFAULT_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Derive the URL for a given locale from a base URL.
 *
 * Any existing leading locale segment in the path is stripped first, so the
 * same base URL can be re-localized regardless of which locale it was pasted
 * in. The default locale (`en`) yields a prefix-free URL.
 */
export function applyLocale(rawUrl: string, locale: string): string {
  const u = new URL(rawUrl);

  const segments = u.pathname.split("/").filter(Boolean);
  if (segments.length && (NON_DEFAULT_LOCALES as readonly string[]).includes(segments[0])) {
    segments.shift();
  }

  if (locale !== DEFAULT_LOCALE) {
    segments.unshift(locale);
  }

  const hadTrailingSlash = u.pathname.endsWith("/");
  u.pathname = segments.length
    ? "/" + segments.join("/") + (hadTrailingSlash ? "/" : "")
    : "/";

  return u.toString();
}
