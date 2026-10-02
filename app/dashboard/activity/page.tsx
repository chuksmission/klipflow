"use client";
import { useState, useEffect } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Badge, ButtonLink, EmptyState, PageHeader, Skeleton, tableClass, tableWrapClass, tdClass, thClass, trClass } from "../../components/ui";

export default function Activity() {
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
      <PageHeader title="Activity" description="Your last 50 generations." />

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : generations.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Every generation, post and action will be logged here."
          action={<ButtonLink href="/dashboard/studio" variant="primary">Open Studio</ButtonLink>}
        />
      ) : (
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Prompt</th>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`}>Tokens</th>
                <th className={`${thClass} text-right`}>Date</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((gen, i) => (
                <tr key={gen.id ?? i} className={trClass}>
                  <td className={`${tdClass} max-w-[320px] truncate text-ink`}>{gen.prompt || "—"}</td>
                  <td className={tdClass}><Badge className="capitalize">{gen.type?.replace(/_/g, " ") ?? "video"}</Badge></td>
                  <td className={`${tdClass} text-right tabular-nums`}>{gen.tokens_used}</td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>{new Date(gen.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
