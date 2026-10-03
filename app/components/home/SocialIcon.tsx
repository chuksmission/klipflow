// Simplified brand glyphs for the footer (lucide no longer ships brand icons).
const PATHS: Record<string, React.ReactNode> = {
  x: <path fill="currentColor" d="M18.9 1.2h3.7l-8 9.1L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.2H4.3l13.3 17.4Z" />,
  tiktok: <path fill="currentColor" d="M16.2 2c.4 2.6 2 4.3 4.3 4.6v3.2a7.6 7.6 0 0 1-4.2-1.4v6.4a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.3a2.8 2.8 0 1 0 2 2.6V2h2.9Z" />,
  instagram: <g fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></g>,
  youtube: <><rect x="1.5" y="5" width="21" height="14" rx="4" fill="currentColor" /><path d="M10 9v6l5.2-3L10 9Z" fill="var(--kf-canvas)" /></>,
  facebook: <path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />,
  linkedin: <path fill="currentColor" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM7.1 20.5H3.6V9h3.5v11.5ZM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0Z" />,
  discord: <path fill="currentColor" d="M20 5.5A17 17 0 0 0 15.8 4l-.5 1a15.6 15.6 0 0 0-6.6 0l-.5-1A17 17 0 0 0 4 5.5C1.6 9.1 1 12.6 1.3 16a17 17 0 0 0 5.1 2.6l1.1-1.7c-.9-.3-1.7-.7-2.5-1.2l.6-.5a12.2 12.2 0 0 0 12.8 0l.6.5c-.8.5-1.6.9-2.5 1.2l1.1 1.7a17 17 0 0 0 5.1-2.6c.4-4-.6-7.4-2.7-10.5ZM8.7 13.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />,
};

export default function SocialIcon({ id, size = 16 }: { id: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>{PATHS[id]}</svg>;
}
