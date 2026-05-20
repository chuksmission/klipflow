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
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (!error) setGenerations(data || []);
    setLoading(false);
  };

  const filtered = generations.filter((g) => {
    if (filter === "all") return true;
    if (filter === "video") return g.output_type === "video" || (!g.output_type && g.video_url);
    if (filter === "image") return g.output_type === "image";
    return true;
  });

  const videoCount = generations.filter(g => g.output_type === "video" || (!g.output_type && g.video_url)).length;
  const imageCount = generations.filter(g => g.output_type === "image").length;

  const handleDownload = async (url: string, isImage: boolean) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "klipflowai-" + Date.now() + (isImage ? ".png" : ".mp4");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const isImage = (gen: any) => gen.output_type === "image";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Gallery</h1>
          <p className="text-gray-400 text-sm">{generations.length} total — {videoCount} videos, {imageCount} images</p>
        </div>
        <div className="flex gap-2">
          {[
            { key: "all", label: "All" },
            { key: "video", label: "Videos" },
            { key: "image", label: "Images" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={"px-4 py-2 rounded-xl text-xs font-bold transition " + (filter === f.key ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}
            >
              {f.label}
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
          <div className="text-5xl mb-4">{filter === "image" ? "🖼️" : "🎬"}</div>
          <h3 className="font-bold text-lg mb-2">No {filter === "all" ? "content" : filter + "s"} yet</h3>
          <p className="text-gray-400 text-sm mb-6">Your generated content will appear here</p>
          <a href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block text-sm">
            Generate Now
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((gen, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group">
              {/* Media preview */}
              {isImage(gen) ? (
                <div className="relative w-full aspect-video bg-gray-900">
                  <img
                    src={gen.video_url}
                    alt={gen.prompt}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ) : gen.video_url ? (
                <video
                  src={gen.video_url}
                  className="w-full aspect-video object-cover"
                  muted
                  playsInline
                  onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                  onMouseOut={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                  onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-gray-600 text-sm">No preview</div>
              )}

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 text-xs font-bold capitalize">
                      {gen.output_type === "image" ? "🖼️ Image" : "🎬 " + (gen.type?.replace(/_/g, " ") ?? "Video")}
                    </span>
                  </div>
                  <span className="text-gray-600 text-xs">{gen.tokens_used} tokens</span>
                </div>
                <p className="text-gray-400 text-xs truncate mb-2">{gen.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{new Date(gen.created_at).toLocaleDateString()}</span>
                  {gen.video_url && (
                    <button
                      onClick={() => handleDownload(gen.video_url, isImage(gen))}
                      className="text-purple-400 hover:text-white text-xs transition font-semibold"
                    >
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
