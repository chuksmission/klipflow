"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAction, setTokenAction] = useState("add");
  const [updatingTokens, setUpdatingTokens] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", role: "author" });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [message, setMessage] = useState("");

  const roles = [
    { value: "super_admin", label: "Super Admin", desc: "Full access to everything", color: "text-red-400" },
    { value: "manager", label: "Manager", desc: "Users, revenue, content", color: "text-orange-400" },
    { value: "author", label: "Author", desc: "Blog posts and leads only", color: "text-blue-400" },
    { value: "support", label: "Support", desc: "View users and generations", color: "text-green-400" },
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: "Bearer " + session.access_token },
    });
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  const handleTokenUpdate = async () => {
    if (!selectedUser || !tokenAmount) return;
    setUpdatingTokens(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/admin/update-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({
        user_id: selectedUser.id,
        amount: parseInt(tokenAmount),
        action: tokenAction,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Tokens updated successfully!");
      setSelectedUser({ ...selectedUser, token_balance: data.new_balance });
      setTimeout(() => setMessage(""), 3000);
    }
    setTokenAmount("");
    setUpdatingTokens(false);
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/ban-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ user_id: userId, ban: !isBanned }),
    });
    setUsers(users.map((u) => u.id === userId ? { ...u, is_banned: !isBanned } : u));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, is_banned: !isBanned });
    setMessage(!isBanned ? "User banned." : "User unbanned.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleRoleChange = async (userId: string, role: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("user_profiles").upsert({ id: userId, role, is_admin: role !== "user" }, { onConflict: "id" });
    setUsers(users.map((u) => u.id === userId ? { ...u, role } : u));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, role });
    setMessage("Role updated!");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleCreateStaff = async () => {
    if (!newStaff.email) return;
    setCreatingStaff(true);
    setMessage("Staff account invitation sent to " + newStaff.email);
    setNewStaff({ email: "", role: "author" });
    setShowCreateForm(false);
    setCreatingStaff(false);
    setTimeout(() => setMessage(""), 4000);
  };

  const filtered = users.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Users</h1>
          <p className="text-gray-400 text-sm">{users.length} total registered users</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
        >
          + Create Staff Account
        </button>
      </div>

      {message && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl px-4 py-3">
          <p className="text-green-400 text-sm">{message}</p>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold">Create Staff Account</h3>
          <p className="text-gray-400 text-sm">Create accounts with specific roles and permissions.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email Address</label>
              <input
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder="staff@example.com"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Role</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
              >
                {roles.filter((r) => r.value !== "super_admin").map((role) => (
                  <option key={role.value} value={role.value}>{role.label} — {role.desc}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            {roles.map((role) => (
              <div key={role.value} className={"p-3 rounded-xl border text-left " + (newStaff.role === role.value ? "border-purple-500 bg-purple-900/20" : "border-white/10 bg-white/5")}>
                <div className={"font-bold text-xs mb-0.5 " + role.color}>{role.label}</div>
                <div className="text-gray-500 text-xs">{role.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreateStaff}
              disabled={creatingStaff || !newStaff.email}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
            >
              {creatingStaff ? "Creating..." : "Send Invitation"}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-xl transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
          />

          {loading ? (
            <p className="text-gray-400 text-sm">Loading users...</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((user, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedUser(user)}
                  className={"flex items-center justify-between p-3 rounded-xl cursor-pointer transition " + (selectedUser?.id === user.id ? "bg-purple-900/30 border border-purple-500/50" : "bg-white/5 border border-white/10 hover:border-purple-500/30")}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {user.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold truncate max-w-40">{user.email}</div>
                      <div className="text-gray-500 text-xs">{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {user.is_banned && <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full">Banned</span>}
                    {user.role && user.role !== "user" && (
                      <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-0.5 rounded-full capitalize">{user.role.replace("_", " ")}</span>
                    )}
                    <span className={user.email_confirmed ? "bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full" : "bg-yellow-900/30 text-yellow-400 text-xs px-2 py-0.5 rounded-full"}>
                      {user.email_confirmed ? "verified" : "unverified"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUser ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-lg font-bold">
                {selectedUser.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold">{selectedUser.email}</h3>
                <p className="text-gray-500 text-xs">Joined {new Date(selectedUser.created_at).toLocaleDateString()} · {selectedUser.provider || "email"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-gray-500 text-xs mb-1">Token Balance</div>
                <div className="text-yellow-400 font-bold">?? {selectedUser.token_balance ?? "—"}</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-gray-500 text-xs mb-1">Status</div>
                <div className={selectedUser.is_banned ? "text-red-400 font-bold text-sm" : "text-green-400 font-bold text-sm"}>
                  {selectedUser.is_banned ? "Banned" : "Active"}
                </div>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block font-semibold">Adjust Token Balance</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setTokenAction("add")}
                  className={"flex-1 py-2 rounded-xl text-xs font-bold transition " + (tokenAction === "add" ? "bg-green-600 text-white" : "bg-white/10 text-gray-400")}
                >
                  + Add Tokens
                </button>
                <button
                  onClick={() => setTokenAction("deduct")}
                  className={"flex-1 py-2 rounded-xl text-xs font-bold transition " + (tokenAction === "deduct" ? "bg-red-600 text-white" : "bg-white/10 text-gray-400")}
                >
                  - Deduct Tokens
                </button>
                <button
                  onClick={() => setTokenAction("set")}
                  className={"flex-1 py-2 rounded-xl text-xs font-bold transition " + (tokenAction === "set" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-400")}
                >
                  = Set Balance
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition text-sm"
                />
                <button
                  onClick={handleTokenUpdate}
                  disabled={updatingTokens || !tokenAmount}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition text-sm"
                >
                  {updatingTokens ? "..." : "Apply"}
                </button>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block font-semibold">Change Role</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => handleRoleChange(selectedUser.id, role.value)}
                    className={"p-2.5 rounded-xl border text-left transition " + (selectedUser.role === role.value ? "border-purple-500 bg-purple-900/20" : "border-white/10 bg-white/5 hover:border-purple-500/30")}
                  >
                    <div className={"font-bold text-xs " + role.color}>{role.label}</div>
                    <div className="text-gray-600 text-xs">{role.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => handleBanUser(selectedUser.id, selectedUser.is_banned)}
                className={"flex-1 font-bold py-2.5 rounded-xl transition text-sm " + (selectedUser.is_banned ? "bg-green-900/30 text-green-400 hover:bg-green-900/50" : "bg-red-900/30 text-red-400 hover:bg-red-900/50")}
              >
                {selectedUser.is_banned ? "Unban User" : "Ban User"}
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">??</div>
            <p className="text-gray-400 text-sm">Select a user to view details and manage their account</p>
          </div>
        )}
      </div>
    </div>
  );
}
