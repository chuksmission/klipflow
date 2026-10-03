"use client";
// Keeps the interface language in step with the visitor: first visit uses the
// browser language; a saved choice (this browser, or the user's profile once
// signed in) wins after that. The server reads the cookie on every render.
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  fetchProfileLocale, readLocaleCookie, readStoredLocale, saveProfileLocale, storeLocale, writeLocaleCookie,
} from "../lib/locale-client";
import { isLocale, matchLocale, type Locale } from "../../i18n/config";

export default function LocaleSync() {
  const current = useLocale() as Locale;
  const router = useRouter();

  useEffect(() => {
    const apply = (next: Locale) => {
      writeLocaleCookie(next);
      storeLocale(next);
      if (next !== current) router.refresh();
    };

    // 1. This browser: a stored choice, otherwise the browser's language
    if (!readLocaleCookie()) {
      const stored = readStoredLocale();
      apply(isLocale(stored) ? stored : matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language]));
    } else if (!readStoredLocale()) {
      storeLocale(current);
    }

    // 2. Signed-in users: their profile choice follows them across devices;
    //    a choice made here before signing in is saved to the profile
    const sync = async () => {
      const profile = await fetchProfileLocale();
      if (isLocale(profile)) { if (profile !== readLocaleCookie()) apply(profile); }
      else {
        const stored = readStoredLocale();
        if (isLocale(stored)) void saveProfileLocale(stored);
      }
    };
    void sync();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") void sync(); });
    return () => sub.subscription.unsubscribe();
    // Run once per page load; `current` is the language the server rendered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
