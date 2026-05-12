'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Verify() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('device_fingerprints')
          .update({ verified: true })
          .eq('email', session.user.email);
        setStatus('success');
      } else {
        setStatus('error');
      }
    };
    checkSession();
  }, []);

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">✨</div>
          <p className="text-gray-400">Verifying your account...</p>
        </div>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-extrabold mb-4">You're Verified!</h1>
          <p className="text-gray-400 mb-6">
            Your account is confirmed. Your <span className="text-purple-400 font-semibold">25 free tokens</span> are ready to use.
          </p>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6 mb-8">
            <div className="text-4xl font-extrabold text-purple-400 mb-1">25</div>
            <div className="text-gray-400 text-sm">Free tokens added to your account</div>
            <div className="text-gray-500 text-xs mt-1">Enough to generate 2 full AI videos</div>
          </div>
          <Link
            href="/dashboard"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-12 rounded-full text-lg transition inline-block"
          >
            Go to Dashboard →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-3xl font-extrabold mb-4">Verification Failed</h1>
        <p className="text-gray-400 mb-6">
          The verification link may have expired. Please try signing up again or contact support.
        </p>
        <Link
          href="/signup"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-12 rounded-full text-lg transition inline-block"
        >
          Try Again →
        </Link>
      </div>
    </main>
  );
}