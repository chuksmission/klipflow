import { Bot } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "../../components/ui";

export default function Autopilot() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Content Autopilot" description="Auto-post to TikTok, Instagram, YouTube, Facebook and X daily." />
      <EmptyState
        icon={Bot}
        title={<span className="inline-flex items-center gap-2">Autopilot is coming soon <Badge tone="accent">In progress</Badge></span>}
        description="Set your niche and posting schedule, and let AI run your channels 24/7. Launching very soon."
      />
    </div>
  );
}
