"use client";
import { useTranslations } from "next-intl";
import { PROVIDERS } from "./home-data";

/** Two rows of provider wordmarks drifting in opposite directions, edges faded (Kling "Partnerships"). */
export default function PoweredBy() {
  const t = useTranslations("landing.powered");
  const rows = [1, 2].map((r) => PROVIDERS.filter((p) => p.live && p.row === r).map((p) => p.name));

  return (
    <section className="overflow-hidden py-24">
      <h2 className="px-4 text-center text-3xl font-semibold tracking-tight text-white md:text-5xl">{t("title")}</h2>
      <p className="mt-3 px-4 text-center text-sm text-ink-muted md:text-base">{t("subtitle")}</p>
      <div className="mt-12 space-y-8">
        {rows.map((names, r) => (
          <div key={r} className="kf-marquee overflow-hidden" aria-label={names.join(", ")}>
            <div className={`kf-marquee__track ${r ? "kf-marquee__track--reverse" : ""}`} style={{ "--kf-speed": `${44 + r * 10}s` } as React.CSSProperties} aria-hidden>
              {[...names, ...names, ...names, ...names].map((name, i) => (
                <span key={`${name}-${i}`} className="mx-7 shrink-0 text-2xl font-semibold tracking-tight text-white/35 md:mx-10 md:text-[2rem]">{name}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
