"use client";
// Browser side of the interface language: cookie (read by the server render),
// localStorage (visitor preference) and the signed-in user's profile.
import { supabase } from "./supabase";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, type Locale } from "../../i18n/config";

export function readLocaleCookie(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function readStoredLocale(): string | null {
  try { return localStorage.getItem(LOCALE_STORAGE_KEY); } catch { return null; }
}

export function storeLocale(locale: Locale) {
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* storage unavailable */ }
}

/** Saves the choice on the signed-in user's profile (no-op when signed out). */
export async function saveProfileLocale(locale: Locale) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await fetch("/api/settings/language", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
    body: JSON.stringify({ locale }),
  }).catch(() => {});
}

export async function fetchProfileLocale(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch("/api/settings/language", { headers: { Authorization: "Bearer " + session.access_token } });
    const data = await res.json();
    return res.ok ? data.locale ?? null : null;
  } catch {
    return null;
  }
}
