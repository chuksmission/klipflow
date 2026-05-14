"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    color: "purple",
    target: "all",
    push_notification: false,
    expires_at: "",
  });

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      setAnnouncements(data || []);
      setLoading(false);
    };
    fetchAnnouncements();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: form.title,
        message: form.message,
        color: form.color,
        target: form.target,
        push_notification: form.push_notification,
        expires_at: form.expires_at || null,
        is_active: true,
      })
      .select()
      .single();

    if (data) setAnnouncements([data, ...announcements]);
    setForm({ title: "", message: "", color: "purple", target: "all", push_notification: false, expires_at: "" });
    setShowForm(false);
    setSaving(false);
  };

  const toggleActive = async (id: number, current: boolean) => {
    await supabase.from("announcements").update({ is_active: !current }).eq("id", id);
    setAnnouncements(announcements.map((a) => a.id === id ? { ...a, is_active: !current } : a));
  };

  const deleteAnnouncement = async (id: number) => {
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements(announcements.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Announcements</h1>
          <p className="text-gray-400 text-sm">Send banners and push notifications to users</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          + New Announcement
        </button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg">Create Announcement</h3>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Announcement message..."
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Color</label>
              <select
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
              >
                <option value="purple">Purple</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="yellow">Yellow</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Target</label>
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
              >
                <option value="all">All Users</option>
                <option value="trial">Trial Users</option>
                <option value="paid">Paid Users</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Expires At (optional)</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
            />
          </div>
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold">?? Send Push Notification</p>
              <p className="text-gray-500 text-xs">Notify users via browser push notification</p>
            </div>
            <button
              onClick={() => setForm({ ...form, push_notification: !form.push_notification })}
              className={"relative w-12 h-6 rounded-full transition-colors " + (form.push_notification ? "bg-purple-600" : "bg-white/20")}
            >
              <div className={"absolute top-1 w-4 h-4 bg-white rounded-full transition-all " + (form.push_notification ? "left-7" : "left-1")} />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title || !form.message}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
            >
              {saving ? "Creating..." : "Create Announcement"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : announcements.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">??</div>
          <h3 className="font-bold text-lg mb-2">No announcements yet</h3>
          <p className="text-gray-400 text-sm">Create your first announcement to notify users.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm">{announcement.title}</h3>
                    {announcement.push_notification && (
                      <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded-full">Push</span>
                    )}
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (announcement.is_active ? "bg-green-900/30 text-green-400" : "bg-gray-900/30 text-gray-500")}>
                      {announcement.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mb-2">{announcement.message}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>Target: {announcement.target}</span>
                    <span>Color: {announcement.color}</span>
                    <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(announcement.id, announcement.is_active)}
                    className={"relative w-10 h-5 rounded-full transition-colors " + (announcement.is_active ? "bg-purple-600" : "bg-white/20")}
                  >
                    <div className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all " + (announcement.is_active ? "left-5" : "left-0.5")} />
                  </button>
                  <button
                    onClick={() => deleteAnnouncement(announcement.id)}
                    className="text-red-400 hover:text-red-300 text-xs transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
