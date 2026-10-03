"use client";
import { useState, useEffect } from "react";
import { Clapperboard, Download, Image as ImageIcon, Images } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTypeLabel } from "../../lib/use-type-label";
import { supabase } from "../../lib/supabase";
import { ButtonLink, EmptyState, PageHeader, Skeleton } from "../../components/ui";

export default function Gallery() {
  const t = useTranslations("gallery");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const typeLabel = useTypeLabel();
  const locale = useLocale();
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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={nav("gallery")}
        description={t("summary", { total: generations.length, videos: videoCount, images: imageCount })}
        actions={
          <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label={t("filter")}>
            {[
              { key: "all", label: t("all") },
              { key: "video", label: t("videos") },
              { key: "image", label: t("images") },
            ].map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={"h-8 rounded-lg px-4 text-sm font-medium transition-colors " + (filter === f.key ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <Skeleton className="aspect-video rounded-none" />
              <div className="space-y-2 p-3"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-3/4" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={filter === "image" ? ImageIcon : filter === "video" ? Clapperboard : Images}
          title={filter === "all" ? t("emptyAll") : filter === "video" ? t("emptyVideos") : t("emptyImages")}
          description={t("emptyDesc")}
          action={<ButtonLink href="/dashboard/studio" variant="primary">{t("openStudio")}</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {filtered.map((gen, i) => (
            <div key={gen.id ?? i} className="group overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
              <div className="relative aspect-video bg-black">
                {isImage(gen) ? (
                  <img
                    src={gen.video_url}
                    alt={gen.prompt || t("generatedImage")}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : gen.video_url ? (
                  <video
                    src={gen.video_url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                    onMouseOut={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                    onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-ink-subtle">{t("noPreview")}</div>
                )}
                {gen.video_url && (
                  <button
                    onClick={() => handleDownload(gen.video_url, isImage(gen))}
                    aria-label={c("download")}
                    className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                  >
                    <Download size={16} aria-hidden />
                  </button>
                )}
              </div>

              <div className="p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-xs font-medium capitalize text-accent-text">
                    {isImage(gen) ? <ImageIcon size={13} aria-hidden /> : <Clapperboard size={13} aria-hidden />}
                    {isImage(gen) && !gen.type ? t("image") : typeLabel(gen.type)}
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-ink-subtle">{c("tokens", { count: gen.tokens_used ?? 0 })}</span>
                </div>
                <p className="mb-2 truncate text-xs text-ink-muted">{gen.prompt}</p>
                <span className="text-xs text-ink-subtle">{new Date(gen.created_at).toLocaleDateString(locale)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
