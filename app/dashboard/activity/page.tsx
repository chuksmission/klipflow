"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Activity() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error) setGenerations(data || []);
      setLoading(false);
    };
    fetchActivity();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Activity Log</h1>
        <p className="text-gray-400 text-sm">Your last 50 generations</p>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : generations.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="font-bold text-lg mb-2">No activity yet</h3>
          <p className="text-gray-400 text-sm">Every generation, post, and action will be logged here</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 text-gray-500 text-xs font-bold uppercase px-4 py-3 border-b border-white/10">
            <span className="col-span-2">Prompt</span>
            <span>Type</span>
            <span>Tokens</span>
          </div>
          {generations.map((gen, i) => (
            <div key={i} className="grid grid-cols-4 items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition">
              <div className="col-span-2 truncate text-gray-300 text-sm pr-4">{gen.prompt}</div>
              <div className="capitalize text-purple-400 text-xs">{gen.type?.replace(/_/g, " ")}</div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-400 text-xs font-bold">{gen.tokens_used} tokens</span>
                <span className="text-gray-600 text-xs">{new Date(gen.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
