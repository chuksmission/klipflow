"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      setLeads(data || []);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const markRead = async (id: number) => {
    await supabase.from("leads").update({ is_read: true }).eq("id", id);
    setLeads(leads.map((l) => l.id === id ? { ...l, is_read: true } : l));
  };

  const deleteLead = async (id: number) => {
    await supabase.from("leads").delete().eq("id", id);
    setLeads(leads.filter((l) => l.id !== id));
  };

  const filtered = leads.filter((l) =>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Leads</h1>
        <p className="text-gray-400 text-sm">{leads.length} total leads  {leads.filter((l) => !l.is_read).length} unread</p>
      </div>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
      />

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">??</div>
          <h3 className="font-bold text-lg mb-2">No leads yet</h3>
          <p className="text-gray-400 text-sm">Contact form submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <div key={lead.id} className={"bg-white/5 border rounded-2xl p-5 " + (lead.is_read ? "border-white/10" : "border-purple-500/30")}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {lead.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm">{lead.name}</h3>
                      {!lead.is_read && <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">New</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>?? {lead.email}</span>
                      {lead.phone && <span>?? {lead.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-600 text-xs">{new Date(lead.created_at).toLocaleDateString()}</span>
                  {!lead.is_read && (
                    <button onClick={() => markRead(lead.id)} className="text-purple-400 hover:text-white text-xs transition">
                      Mark Read
                    </button>
                  )}
                  <button onClick={() => deleteLead(lead.id)} className="text-red-400 hover:text-red-300 text-xs transition">
                    Delete
                  </button>
                </div>
              </div>
              {lead.message && (
                <div className="mt-3 bg-black/20 rounded-xl px-4 py-3">
                  <p className="text-gray-400 text-sm">{lead.message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
