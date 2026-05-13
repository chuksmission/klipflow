'use client';
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Settings() {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        setName(session.user.user_metadata?.full_name || "");
      }
    };
    getUser();
  }, []);

  const handleSave = async () => {
    await supabase.auth.updateUser({ data: { full_name: name } });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const connectedPlatforms = [
    { name: "TikTok", icon: "🎵", connected: false },
    { name: "Instagram", icon: "📸", connected: false },
    { name: "YouTube", icon: "▶️", connected: false },
    { name: "Facebook", icon: "👥", connected: false },
    { name: "X (Twitter)", icon: "𝕏", connected: false },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Settings</h1>
        <p className="text-gray-400 text-sm">Manage your account and connected platforms</p>
      </div>

      {/* PROFILE */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="font-bold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Email Address</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed"
            />
          </div>
          <button
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl transition"
          >
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* CONNECTED PLATFORMS */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="font-bold mb-2">Connected Social Accounts</h2>
        <p className="text-gray-500 text-xs mb-4">Connect your accounts for Autopilot posting</p>
        <div className="space-y-3">
          {connectedPlatforms.map((platform, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">{platform.icon}</span>
                <span className="font-semibold text-sm">{platform.name}</span>
              </div>
              <button className={`text-xs font-bold py-1.5 px-4 rounded-full transition ${platform.connected ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
                {platform.connected ? '✓ Connected' : 'Connect — Soon'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SIGN OUT */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="font-bold mb-2">Sign Out</h2>
        <p className="text-gray-400 text-sm mb-4">Sign out of your KlipflowAI account on this device.</p>
        <button
          onClick={async () => {
            const { supabase } = await import('../../lib/supabase');
            await supabase.auth.signOut();
            window.location.href = '/';
          }}
          className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          Sign Out
        </button>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-6">
        <h2 className="font-bold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-gray-400 text-sm mb-4">Permanently delete your account and all data.</p>
        <button className="bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 font-bold py-2 px-6 rounded-xl transition text-sm">
          Delete Account
        </button>
      </div>
    </div>
  );
}