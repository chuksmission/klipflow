'use client';
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading consent from localStorage after mount
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const reject = () => {
    localStorage.setItem('cookie_consent', 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-line-strong bg-surface p-4 shadow-2xl shadow-black/60 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-sm"
    >
      <p className="text-sm leading-relaxed text-ink-muted">
        We use cookies to improve your experience and understand site traffic. Read our{" "}
        <a href="/privacy-policy" className="text-accent-text underline-offset-2 hover:underline">privacy policy</a>.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={reject}
          className="h-9 rounded-lg border border-line bg-raised text-sm font-medium text-ink transition-colors hover:border-line-strong"
        >
          Reject
        </button>
        <button
          onClick={accept}
          className="h-9 rounded-lg bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
