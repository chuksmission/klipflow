import { Receipt } from "lucide-react";

﻿export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Orders</h1>
        <p className="text-ink-muted text-sm">View all transactions</p>
      </div>
      <div className="bg-surface border border-line rounded-2xl p-12 text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-ink-muted"><Receipt size={22} aria-hidden /></span>
        <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
        <p className="text-ink-muted text-sm">This section is being built.</p>
      </div>
    </div>
  );
}
