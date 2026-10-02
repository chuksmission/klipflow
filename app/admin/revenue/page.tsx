"use client";
import { useState, useEffect } from "react";
import { ChartLine } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function AdminRevenue() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    mrr: 0,
    arr: 0,
    totalOrders: 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Revenue & Orders</h1>
        <p className="text-ink-muted text-sm">Track all payments and subscriptions</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: "$0", icon: "??", color: "text-emerald-300" },
          { label: "MRR", value: "$0", icon: "??", color: "text-sky-300" },
          { label: "ARR", value: "$0", icon: "??", color: "text-purple-400" },
          { label: "Total Orders", value: "0", icon: "??", color: "text-amber-300" },
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-line rounded-2xl p-5">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className={"text-2xl font-semibold tracking-tight mb-1 " + stat.color}>{stat.value}</div>
            <div className="text-white text-xs font-semibold">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-2xl p-12 text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-ink-muted"><ChartLine size={22} aria-hidden /></span>
        <h3 className="font-semibold text-lg mb-2">No revenue yet</h3>
        <p className="text-ink-muted text-sm mb-4">Revenue will appear here once Stripe or other payment gateways are connected and users start paying.</p>
        <a href="/admin/payment-gateways" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-xl transition text-sm inline-block">
          Configure payment gateways
        </a>
      </div>
    </div>
  );
}
