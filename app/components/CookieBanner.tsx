'use client';
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
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
    <div className="fixed bottom-0 left-0 right-0 z-50 px-6 py-4 bg-gray-950 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
      <p className="text-gray-400 text-sm max-w-2xl">
        We use cookies to improve your experience, analyze site traffic, and personalize content.
        By clicking "Accept", you consent to our use of cookies. Read our{" "}
        <a href="/privacy-policy" className="text-purple-400 hover:text-white underline transition">Privacy Policy</a>.
      </p>
      <div className="flex gap-3 shrink-0">
        <button
          onClick={reject}
          className="text-gray-400 hover:text-white text-sm font-semibold py-2 px-5 rounded-full border border-white/20 hover:border-white/40 transition"
        >
          Reject
        </button>
        <button
          onClick={accept}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}