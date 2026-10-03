import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchLocale, type Locale } from "./config";

type Messages = { [key: string]: unknown };

const isObject = (v: unknown): v is Messages => typeof v === "object" && v !== null && !Array.isArray(v);

// Missing translations fall back to English instead of showing a key (lists
// such as FAQs are taken whole from the translation)
function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

// No locale in the URL: the saved choice (cookie) wins, otherwise the
// browser's language, otherwise English. Only the active language is loaded.
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(saved) ? saved : matchLocale((await headers()).get("accept-language"));
  const en = (await import("../messages/en.json")).default as Messages;
  let messages = en;
  if (locale !== DEFAULT_LOCALE) {
    // A missing or broken language file never takes the site down: English fills in
    try { messages = merge(en, (await import(`../messages/${locale}.json`)).default as Messages); }
    catch (e) { console.error(`messages/${locale}.json failed to load`, e); }
  }
  return { locale, messages };
});
