"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, ShieldCheck, Fingerprint } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function AdminAbuseControl() {
  const [fingerprints, setFingerprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchFingerprints = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/abuse", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await res.json();
      setFingerprints(data.fingerprints || []);
      setLoading(false);
    };
    fetchFingerprints();
  }, []);

  const filtered = fingerprints.filter((f) =>
    f.email?.toLowerCase().includes(search.toLowerCase()) ||
    f.fingerprint?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Abuse Control</h1>
        <p className="text-ink-muted text-sm">Monitor and manage suspicious account activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-2xl p-5">
          <ShieldAlert size={18} className="mb-3 text-ink-subtle" aria-hidden />
          <div className="text-2xl font-semibold tracking-tight text-red-400">{fingerprints.filter((f) => !f.verified).length}</div>
          <div className="text-white text-xs font-semibold">Unverified Attempts</div>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-5">
          <ShieldCheck size={18} className="mb-3 text-ink-subtle" aria-hidden />
          <div className="text-2xl font-semibold tracking-tight text-emerald-300">{fingerprints.filter((f) => f.verified).length}</div>
          <div className="text-white text-xs font-semibold">Verified Accounts</div>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-5">
          <Fingerprint size={18} className="mb-3 text-ink-subtle" aria-hidden />
          <div className="text-2xl font-semibold tracking-tight text-amber-300">{new Set(fingerprints.map((f) => f.fingerprint)).size}</div>
          <div className="text-white text-xs font-semibold">Unique Devices</div>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by email or fingerprint..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm"
      />

      {loading ? (
        <p className="text-ink-muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-ink-muted"><ShieldCheck size={22} aria-hidden /></span>
          <h3 className="font-semibold text-lg mb-2">No abuse attempts detected</h3>
          <p className="text-ink-muted text-sm">Suspicious activity will appear here.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 text-ink-subtle text-xs font-medium px-4 py-3 border-b border-line">
            <span>Email</span>
            <span>Fingerprint</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {filtered.map((fp, i) => (
            <div key={i} className="grid grid-cols-4 items-center px-4 py-3 border-b border-line/60 last:border-0 text-sm">
              <span className="text-ink truncate">{fp.email}</span>
              <span className="text-ink-subtle text-xs font-mono truncate">{fp.fingerprint?.slice(0, 12)}...</span>
              <span className={fp.verified ? "text-emerald-300 text-xs" : "text-red-400 text-xs"}>
                {fp.verified ? "Verified" : "Unverified"}
              </span>
              <span className="text-ink-subtle text-xs">{new Date(fp.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
