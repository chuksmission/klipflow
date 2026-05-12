'use client';
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getDeviceFingerprint } from "../lib/fingerprint";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const fingerprint = await getDeviceFingerprint();

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fingerprint })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`
        }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(true);

    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">📧</div>
          <h1 className="text-3xl font-extrabold mb-4">Check Your Email</h1>
          <p className="text-gray-400 mb-6">
            We sent a verification link to <span className="text-purple-400 font-semibold">{email}</span>. Click the link to verify your account and claim your <span className="text-purple-400 font-semibold">25 free tokens</span>.
          </p>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-6 mb-6">
            <p className="text-purple-300 text-sm">💡 Don't see the email? Check your spam folder.</p>
          </div>
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition">
            Already verified? Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">

        {/* LOGO */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            KlipflowAI
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Create your account — get 25 free tokens</p>
        </div>

        {/* CARD */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-6">Sign Up Free</h1>

          {/* FREE TRIAL BADGE */}
          <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="text-purple-300 text-sm font-semibold">25 Free Tokens on Signup</p>
              <p className="text-gray-500 text-xs">Generate 2 full AI videos — no credit card needed</p>
            </div>
          </div>

          {/* FORM */}
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Password</label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Confirm Password</label>
              <input
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
            >
              {loading ? 'Creating Account...' : 'Create Free Account →'}
            </button>
          </div>

          {/* DIVIDER */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-gray-600 text-xs">OR</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* TERMS */}
          <p className="text-gray-600 text-xs text-center">
            By signing up you agree to our{" "}
            <Link href="/terms-of-service" className="text-purple-400 hover:text-white transition">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy-policy" className="text-purple-400 hover:text-white transition">Privacy Policy</Link>
          </p>
        </div>

        {/* LOGIN LINK */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-purple-400 hover:text-white transition font-semibold">
            Sign In
          </Link>
        </p>

      </div>
    </main>
  );
}