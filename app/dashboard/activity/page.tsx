"use client";
import { useState, useEffect } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTypeLabel } from "../../lib/use-type-label";
import { supabase } from "../../lib/supabase";
import { Badge, ButtonLink, EmptyState, PageHeader, Skeleton, tableClass, tableWrapClass, tdClass, thClass, trClass } from "../../components/ui";

export default function Activity() {
  const t = useTranslations("activity");
  const nav = useTranslations("nav");
  const typeLabel = useTypeLabel();
  const locale = useLocale();
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
    <div className="mx-auto max-w-5xl">
      <PageHeader title={nav("activity")} description={t("description")} />

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : generations.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={<ButtonLink href="/dashboard/studio" variant="primary">{t("openStudio")}</ButtonLink>}
        />
      ) : (
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>{t("prompt")}</th>
                <th className={thClass}>{t("type")}</th>
                <th className={`${thClass} text-end`}>{t("tokens")}</th>
                <th className={`${thClass} text-end`}>{t("date")}</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((gen, i) => (
                <tr key={gen.id ?? i} className={trClass}>
                  <td className={`${tdClass} max-w-[320px] truncate text-ink`}>{gen.prompt || "—"}</td>
                  <td className={tdClass}><Badge>{typeLabel(gen.type)}</Badge></td>
                  <td className={`${tdClass} text-end tabular-nums`}>{gen.tokens_used}</td>
                  <td className={`${tdClass} whitespace-nowrap text-end`}>{new Date(gen.created_at).toLocaleDateString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
