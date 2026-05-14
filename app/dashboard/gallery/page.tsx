"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Gallery() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchGenerations();
  }, []);

  const fetchGenerations = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (!error) setGenerations(data || []);
    setLoading(false);
  };

  const filtered = filter === "all" ? generations : generations.filter((g) => g.type?.includes(filter));

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Gallery</h1>
          <p className="text-gray-400 text-sm">{generations.length} total generations</p>
        </div>
        <div className="flex gap-2">
          {["all", "video", "image"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={"px-4 py-2 rounded-xl text-xs font-bold transition capitalize " + (filter === f ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl aspect-video animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🎬</div>
          <h3 className="font-bold text-lg mb-2">No content yet</h3>
          <p className="text-gray-400 text-sm mb-6">Generated videos and images will appear here</p>
          <a href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block text-sm">
            Generate First Video
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((gen, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group">
              {gen.video_url ? (
                <video src={gen.video_url} className="w-full aspect-video object-cover" muted playsInline onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }} />
              ) : (
                <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-gray-600 text-sm">No preview</div>
              )}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-purple-400 text-xs font-bold capitalize">{gen.type?.replace(/_/g, " ")}</span>
                  <span className="text-gray-600 text-xs">{gen.tokens_used} tokens</span>
                </div>
                <p className="text-gray-400 text-xs truncate mb-2">{gen.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{new Date(gen.created_at).toLocaleDateString()}</span>
                  {gen.video_url && (
                    <button onClick={() => handleDownload(gen.video_url, "klipflowai-" + gen.id + ".mp4")} className="text-purple-400 hover:text-white text-xs transition font-semibold">
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
