"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

interface Props {
  src: string;
  className?: string;
  style?: CSSProperties;
  /** Load straight away (above the fold) instead of when scrolled near */
  eager?: boolean;
  loop?: boolean;
  onEnded?: () => void;
}

/**
 * Muted autoplaying clip that only downloads when it comes near the viewport
 * and pauses while off screen (saves bandwidth and battery on long pages).
 */
export default function LazyVideo({ src, className = "", style, eager = false, loop = true, onEnded }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const onScreen = useRef(false);
  const [load, setLoad] = useState(eager);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); near.disconnect(); } }, { rootMargin: "400px 0px" });
    const visible = new IntersectionObserver(([e]) => {
      onScreen.current = e.isIntersecting;
      if (!el.currentSrc) return; // plays from onLoadedData once the source arrives
      if (e.isIntersecting) el.play().catch(() => { /* autoplay blocked: first frame stays */ });
      else el.pause();
    }, { threshold: 0.15 });
    if (!eager) near.observe(el);
    visible.observe(el);
    return () => { near.disconnect(); visible.disconnect(); };
  }, [eager]);

  return (
    <video
      ref={ref}
      src={load ? src : undefined}
      muted
      playsInline
      autoPlay={eager}
      loop={loop}
      preload={load ? "auto" : "none"}
      onLoadedData={(e) => { if (onScreen.current || eager) e.currentTarget.play().catch(() => {}); }}
      onEnded={onEnded}
      className={className}
      style={style}
      aria-hidden
    />
  );
}
