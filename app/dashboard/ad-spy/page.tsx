import { Radar } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "../../components/ui";

export default function AdSpy() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Facebook Ad Spy" description="Find winning ads running 7+ days in any niche." />
      <EmptyState
        icon={Radar}
        title={<span className="inline-flex items-center gap-2">Ad Spy is coming soon <Badge tone="accent">In progress</Badge></span>}
        description="We're connecting to Meta's Ads Library API. This feature will be live very soon."
      />
    </div>
  );
}
