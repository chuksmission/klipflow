"use client";
// Supabase auth errors arrive in English: show the common ones in the user's
// language, and anything unrecognised as-is.
import { useTranslations } from "next-intl";

const KNOWN: [RegExp, string][] = [
  [/invalid login credentials/i, "invalidCredentials"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/already (registered|exists)|user already/i, "alreadyRegistered"],
  [/rate limit|too many/i, "rateLimited"],
  [/password should be at least|weak password/i, "weakPassword"],
  [/invalid email|unable to validate email/i, "invalidEmail"],
  [/same password|different from the old/i, "samePassword"],
  [/expired|invalid.*(token|link)|otp/i, "linkExpired"],
];

export function useAuthErrorMessage() {
  const t = useTranslations("authErrors");
  return (message: string) => {
    const hit = KNOWN.find(([re]) => re.test(message));
    return hit ? t(hit[1]) : message;
  };
}
