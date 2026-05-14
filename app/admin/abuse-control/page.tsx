"use client";
import { useState, useEffect } from "react";
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
        <h1 className="text-2xl font-extrabold mb-1">Abuse Control</h1>
        <p className="text-gray-400 text-sm">Monitor and manage suspicious account activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="text-2xl mb-2">???</div>
          <div className="text-2xl font-extrabold text-red-400">{fingerprints.filter((f) => !f.verified).length}</div>
          <div className="text-white text-xs font-semibold">Unverified Attempts</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="text-2xl mb-2">?</div>
          <div className="text-2xl font-extrabold text-green-400">{fingerprints.filter((f) => f.verified).length}</div>
          <div className="text-white text-xs font-semibold">Verified Accounts</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="text-2xl mb-2">??</div>
          <div className="text-2xl font-extrabold text-yellow-400">{new Set(fingerprints.map((f) => f.fingerprint)).size}</div>
          <div className="text-white text-xs font-semibold">Unique Devices</div>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by email or fingerprint..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
      />

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">???</div>
          <h3 className="font-bold text-lg mb-2">No abuse attempts detected</h3>
          <p className="text-gray-400 text-sm">Suspicious activity will appear here.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 text-gray-500 text-xs font-bold uppercase px-4 py-3 border-b border-white/10">
            <span>Email</span>
            <span>Fingerprint</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {filtered.map((fp, i) => (
            <div key={i} className="grid grid-cols-4 items-center px-4 py-3 border-b border-white/5 last:border-0 text-sm">
              <span className="text-gray-300 truncate">{fp.email}</span>
              <span className="text-gray-500 text-xs font-mono truncate">{fp.fingerprint?.slice(0, 12)}...</span>
              <span className={fp.verified ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
                {fp.verified ? "? Verified" : "? Unverified"}
              </span>
              <span className="text-gray-600 text-xs">{new Date(fp.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
