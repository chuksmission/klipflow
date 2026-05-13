'use client';
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Gallery() {
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGenerations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/generations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      setGenerations(data.generations || []);
      setLoading(false);
    };
    fetchGenerations();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Gallery</h1>
        <p className="text-gray-400 text-sm">All your generated videos and images</p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3 animate-pulse">🎬</div>
          <p className="text-gray-400 text-sm">Loading your content...</p>
        </div>
      )}

      {!loading && generations.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🖼️</div>
          <h3 className="font-bold text-lg mb-2">No content yet</h3>
          <p className="text-gray-400 text-sm mb-6">Generated videos and images will appear here</p>
          <a href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block text-sm">
            Generate First Video →
          </a>
        </div>
      )}

      {!loading && generations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {generations.map((gen, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {gen.video_url && (
                <video
                  src={gen.video_url}
                  className="w-full aspect-video object-cover"
                  muted
                  playsInline
                />
              )}
              <div className="p-3">
                <div className="text-xs font-semibold text-purple-400 mb-1 capitalize">
                  {gen.type?.replace(/_/g, ' ')}
                </div>
                <p className="text-gray-400 text-xs truncate">{gen.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600 text-xs">
                    {new Date(gen.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => window.open(gen.video_url, '_blank')}
                    className="text-purple-400 hover:text-white text-xs transition"
                  >
                    ⬇️ Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}