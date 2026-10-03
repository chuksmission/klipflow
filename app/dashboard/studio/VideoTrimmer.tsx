"use client";
// Pick a fixed-length window (e.g. 30s) from a longer uploaded video: preview,
// draggable selection on a timeline, and a slider for keyboard/touch users.
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Scissors } from "lucide-react";

interface Props {
  file: File;
  duration: number;
  windowSeconds: number;
  start: number;
  onChange: (start: number) => void;
  message?: string;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function VideoTrimmer({ file, duration, windowSeconds, start, onChange, message }: Props) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  // Revoke only once the URL is really unused: React may unmount and remount
  // the same instance (Strict Mode), which must keep the memoised URL alive
  const liveUrl = useRef<string | null>(null);
  useEffect(() => {
    liveUrl.current = url;
    return () => {
      liveUrl.current = null;
      setTimeout(() => { if (liveUrl.current !== url) URL.revokeObjectURL(url); }, 1000);
    };
  }, [url]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerX: number; start: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(start);

  const length = Math.min(windowSeconds, duration);
  const maxStart = Math.max(0, duration - length);
  const clamp = (s: number) => Math.min(maxStart, Math.max(0, Math.round(s * 10) / 10));
  const end = start + length;

  // Show the first frame of the selection whenever it moves (while paused)
  const seek = (t: number) => { const v = videoRef.current; if (v && !playing) v.currentTime = t; };

  const setStart = (s: number) => { const next = clamp(s); onChange(next); seek(next); };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { pointerX: e.clientX, start };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    const perPx = duration / track.getBoundingClientRect().width;
    setStart(drag.current.start + (e.clientX - drag.current.pointerX) * perPx);
  };
  const onPointerUp = () => { drag.current = null; };

  // Click on the track (outside the window) centres the selection there
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current) return;
    const rect = trackRef.current!.getBoundingClientRect();
    setStart(((e.clientX - rect.left) / rect.width) * duration - length / 2);
  };

  const togglePreview = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); return; }
    v.currentTime = start;
    void v.play();
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setPlayhead(v.currentTime);
    if (v.currentTime >= end) { v.pause(); v.currentTime = start; }
  };

  const pct = (s: number) => `${(s / duration) * 100}%`;

  return (
    <div className="space-y-3">
      {message && <p className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-ink"><Scissors size={16} className="mt-0.5 shrink-0 text-accent-text" aria-hidden /> {message}</p>}
      <video
        ref={videoRef} src={url} playsInline muted={false} preload="metadata"
        onLoadedMetadata={() => seek(start)} onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        className="max-h-[45vh] w-full rounded-xl border border-line bg-black"
      />

      <div
        ref={trackRef} onClick={onTrackClick}
        className="relative h-12 cursor-pointer select-none rounded-lg border border-line bg-canvas"
        aria-hidden
      >
        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          className="absolute inset-y-0 cursor-grab touch-none rounded-md border-2 border-accent bg-accent/20 active:cursor-grabbing"
          style={{ left: pct(start), width: pct(length) }}
        >
          <span className="absolute inset-y-2 left-1 w-1 rounded bg-accent" />
          <span className="absolute inset-y-2 right-1 w-1 rounded bg-accent" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80" style={{ left: pct(Math.min(duration, playhead)) }} />
      </div>

      <input
        type="range" min={0} max={maxStart} step={0.1} value={start}
        onChange={(e) => setStart(Number(e.target.value))}
        aria-label={`Start of the ${Math.round(length)} second clip`}
        className="w-full accent-[var(--kf-accent)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-ink">
          <span className="font-semibold">{fmt(start)} – {fmt(end)}</span>
          <span className="text-ink-subtle"> · {Math.round(length)}s selected of {fmt(duration)}</span>
        </span>
        <button onClick={togglePreview} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-sm text-ink transition-colors hover:border-line-strong">
          {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />} {playing ? "Pause" : "Play selection"}
        </button>
      </div>
    </div>
  );
}
