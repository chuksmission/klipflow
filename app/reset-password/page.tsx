'use client';
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://klipflowai.com/update-password`
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);

    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">📧</div>
          <h1 className="text-3xl font-extrabold mb-4">Check Your Email</h1>
          <p className="text-gray-400 mb-6">
            We sent a password reset link to <span className="text-purple-400 font-semibold">{email}</span>.
          </p>
          <Link href="/login" className="text-purple-400 hover:text-white transition">
            Back to Sign In →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">

        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            KlipflowAI
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Reset your password</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-2">Forgot Password?</h1>
          <p className="text-gray-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

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

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
            >
              {loading ? 'Sending...' : 'Send Reset Link →'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Remember your password?{" "}
          <Link href="/login" className="text-purple-400 hover:text-white transition font-semibold">
            Sign In
          </Link>
        </p>

      </div>
    </main>
  );
}