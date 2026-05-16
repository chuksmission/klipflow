"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminGenerations() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchGenerations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/generations", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await res.json();
      setGenerations(data.generations || []);
      setLoading(false);
    };
    fetchGenerations();
  }, []);

  const filtered = generations.filter((g) =>
    g.prompt?.toLowerCase().includes(search.toLowerCase()) ||
    g.type?.toLowerCase().includes(search.toLowerCase())
  );

  const copyPrompt = (prompt: string, index: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Generations</h1>
        <p className="text-gray-400 text-sm">{generations.length} total generations across the platform</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <input
          type="text"
          placeholder="Search by prompt or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm mb-4"
        />

        <div className="grid grid-cols-7 text-gray-500 text-xs font-bold uppercase px-3 mb-2">
          <span className="col-span-2">Prompt</span>
          <span>Type</span>
          <span>Tokens</span>
          <span>Date</span>
          <span>Copy</span>
          <span>Video</span>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-8 text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No generations yet</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((gen, i) => (
              <div key={i} className="grid grid-cols-7 items-center p-3 bg-white/5 rounded-xl text-sm gap-2">
                <div className="col-span-2 text-gray-300 pr-2">
                  <p className="truncate text-xs">{gen.prompt}</p>
                </div>
                <div className="capitalize text-purple-400 text-xs">{gen.type?.replace(/_/g, " ")}</div>
                <div className="text-yellow-400 text-xs font-bold">{gen.tokens_used ?? "??"}</div>
                <div className="text-gray-500 text-xs">{new Date(gen.created_at).toLocaleDateString()}</div>
                <div>
                  <button
                    onClick={() => copyPrompt(gen.prompt, i)}
                    className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-purple-600 text-gray-300 hover:text-white transition font-semibold whitespace-nowrap"
                  >
                    {copiedId === i ? "✓ Copied!" : "📋 Copy"}
                  </button>
                </div>
                <div>
                  {gen.video_url ? (
                    
                      href={gen.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-600 text-purple-300 hover:text-white transition font-semibold whitespace-nowrap inline-block"
                    >
                      ▶ View
                    </a>
                  ) : (
                    <span className="text-gray-600 text-xs">
                      {gen.status === "processing" ? "⏳ Processing" : "—"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}