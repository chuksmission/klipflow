"use client";
import { useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
import { SHOWCASE_CATEGORIES } from "./catalog";

export interface ShowcaseItem {
  id: number | string;
  type: string | null;
  prompt: string | null;
  video_url: string;
  output_type: string | null;
  model: string | null;
  aspect_ratio: string | null;
  duration: string | null;
  featured_category: string | null;
  featured_title: string | null;
}

const aspectClass = (ar: string | null) =>
  ar === "9:16" ? "aspect-[9/16]" : ar === "1:1" ? "aspect-square" : ar === "4:5" ? "aspect-[4/5]" : "aspect-video";

function ShowcaseCard({ item, onUse }: { item: ShowcaseItem; onUse: (item: ShowcaseItem) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isImage = item.output_type === "image";
  const title = item.featured_title || item.type?.replace(/_/g, " ") || "Made with KlipflowAI";

  return (
    <figure
      className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface"
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = 0; } }}
    >
      {isImage ? (
        <img src={item.video_url} alt={title} loading="lazy" className={"w-full object-cover " + aspectClass(item.aspect_ratio)} />
      ) : (
        <video
          ref={videoRef}
          src={item.video_url + "#t=0.1"}
          muted
          loop
          playsInline
          preload="metadata"
          className={"w-full bg-black object-cover " + aspectClass(item.aspect_ratio)}
        />
      )}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium capitalize text-white">{title}</p>
          {item.model && <p className="truncate text-xs text-white/60">{item.model}</p>}
        </div>
        <button
          onClick={() => onUse(item)}
          className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-black transition-colors hover:bg-white/85"
        >
          <WandSparkles size={14} aria-hidden /> Use this
        </button>
      </figcaption>
    </figure>
  );
}

export default function ShowcaseGrid({ items, onUse }: { items: ShowcaseItem[]; onUse: (item: ShowcaseItem) => void }) {
  const [category, setCategory] = useState<string>("all");
  const available = SHOWCASE_CATEGORIES.filter((c) => items.some((i) => i.featured_category === c.id));
  const visible = category === "all" ? items : items.filter((i) => i.featured_category === category);

  return (
    <div>
      {available.length > 1 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto" role="tablist" aria-label="Showcase categories">
          {[{ id: "all", label: "All" }, ...available].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={
                "h-9 flex-shrink-0 rounded-full border px-4 text-sm transition-colors " +
                (category === c.id ? "border-white bg-white text-black" : "border-line text-ink-muted hover:border-line-strong hover:text-ink")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="columns-2 gap-4 md:columns-3 xl:columns-4">
        {visible.map((item) => <ShowcaseCard key={item.id} item={item} onUse={onUse} />)}
      </div>
    </div>
  );
}
