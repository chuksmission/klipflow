"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const ALL_PERMISSIONS = [
  { key: "overview", label: "Overview", section: "Main" },
  { key: "users_view", label: "View Users", section: "Main" },
  { key: "users_edit", label: "Edit Users", section: "Main" },
  { key: "revenue", label: "Revenue & Orders", section: "Main" },
  { key: "generations", label: "Generations", section: "Main" },
  { key: "ai_providers", label: "AI Providers", section: "AI & Automation" },
  { key: "token_pricing", label: "Token Pricing", section: "AI & Automation" },
  { key: "prompt_templates", label: "Prompt Templates", section: "AI & Automation" },
  { key: "video_templates", label: "Video Templates", section: "AI & Automation" },
  { key: "plans", label: "Plans", section: "Monetization" },
  { key: "payment_gateways", label: "Payment Gateways", section: "Monetization" },
  { key: "orders", label: "Orders", section: "Monetization" },
  { key: "social_auth", label: "Social Auth", section: "Auth & Integrations" },
  { key: "integrations", label: "Platform Integrations", section: "Auth & Integrations" },
  { key: "site_settings", label: "Site Settings", section: "Appearance" },
  { key: "announcements", label: "Announcements", section: "Appearance" },
  { key: "blog", label: "Blog / CMS", section: "Content" },
  { key: "leads", label: "Leads", section: "Content" },
  { key: "email_settings", label: "Email Settings", section: "Communications" },
  { key: "email_templates", label: "Email Templates", section: "Communications" },
  { key: "abuse_control", label: "Abuse Control", section: "Security" },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  super_admin: ALL_PERMISSIONS.map((p) => p.key),
  manager: ["overview", "users_view", "users_edit", "revenue", "generations", "token_pricing", "prompt_templates", "video_templates", "plans", "orders", "announcements", "blog", "leads", "email_templates", "abuse_control"],
  author: ["blog", "leads", "prompt_templates", "video_templates"],
  support: ["overview", "users_view", "generations", "leads", "abuse_control"],
  user: [],
};

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAction, setTokenAction] = useState("add");
  const [updatingTokens, setUpdatingTokens] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    password: "",
    role: "user",
    full_name: "",
    initial_tokens: "25",
  });

  const roles = [
    { value: "super_admin", label: "Super Admin", desc: "Full access to everything", color: "text-red-400" },
    { value: "manager", label: "Manager", desc: "Most features except sensitive settings", color: "text-orange-400" },
    { value: "author", label: "Author", desc: "Blog, leads, templates only", color: "text-sky-300" },
    { value: "support", label: "Support", desc: "View users, generations, leads", color: "text-emerald-300" },
    { value: "user", label: "Regular User", desc: "Standard user account with tokens", color: "text-ink-muted" },
  ];

  const sections = [...new Set(ALL_PERMISSIONS.map((p) => p.section))];

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPermissions(selectedUser.id);
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/users", { headers: { Authorization: "Bearer " + session.access_token } });
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  const fetchUserPermissions = async (userId: string) => {
    const { data } = await supabase
      .from("staff_permissions")
      .select("permissions, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.permissions) {
      setUserPermissions(Object.keys(data.permissions).filter((k) => data.permissions[k]));
    } else {
      const userRole = selectedUser?.role || "user";
      setUserPermissions(ROLE_DEFAULTS[userRole] || []);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSavingPermissions(true);
    const permissionsMap: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach((p) => { permissionsMap[p.key] = userPermissions.includes(p.key); });
    await supabase.from("staff_permissions").upsert({
      user_id: selectedUser.id,
      role: selectedUser.role,
      permissions: permissionsMap,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSavingPermissions(false);
    setMessage("Permissions saved!");
    setTimeout(() => setMessage(""), 3000);
  };

  const togglePermission = (key: string) => {
    setUserPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const applyRoleDefaults = (role: string) => {
    setUserPermissions(ROLE_DEFAULTS[role] || []);
  };

  const handleCreateAccount = async () => {
    if (!newAccount.email || !newAccount.password) return;
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify(newAccount),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Account created successfully!");
      setShowCreateForm(false);
      setNewAccount({ email: "", password: "", role: "user", full_name: "", initial_tokens: "25" });
      fetchUsers();
    } else {
      setMessage("Error: " + (data.error || "Failed to create account"));
    }
    setCreating(false);
    setTimeout(() => setMessage(""), 4000);
  };

  const handleTokenUpdate = async () => {
    if (!selectedUser || !tokenAmount) return;
    setUpdatingTokens(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/update-tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ user_id: selectedUser.id, amount: parseInt(tokenAmount), action: tokenAction }) });
    const data = await res.json();
    if (data.success) { setMessage("Tokens updated!"); setSelectedUser({ ...selectedUser, token_balance: data.new_balance }); setTimeout(() => setMessage(""), 3000); }
    setTokenAmount("");
    setUpdatingTokens(false);
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/ban-user", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ user_id: userId, ban: !isBanned }) });
    setUsers(users.map((u) => u.id === userId ? { ...u, is_banned: !isBanned } : u));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, is_banned: !isBanned });
    setMessage(!isBanned ? "User banned." : "User unbanned.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleRoleChange = async (userId: string, role: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("user_profiles").upsert({ id: userId, role, is_admin: ["super_admin", "manager", "author", "support"].includes(role) }, { onConflict: "id" });
    setUsers(users.map((u) => u.id === userId ? { ...u, role } : u));
    if (selectedUser?.id === userId) {
      setSelectedUser({ ...selectedUser, role });
      applyRoleDefaults(role);
    }
    setMessage("Role updated!");
    setTimeout(() => setMessage(""), 3000);
  };

  const filtered = users.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight mb-1">Users</h1><p className="text-ink-muted text-sm">{users.length} total registered users</p></div>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-xl transition text-sm">+ Create Account</button>
      </div>

      {message && <div className={"border rounded-xl px-4 py-3 " + (message.startsWith("Error") ? "bg-red-500/10 border-red-500/25" : "bg-emerald-500/10 border-emerald-500/25")}><p className={message.startsWith("Error") ? "text-red-400 text-sm" : "text-emerald-300 text-sm"}>{message}</p></div>}

      {showCreateForm && (
        <div className="bg-surface border border-accent/25 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-lg">Create New Account</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-ink-muted text-xs mb-1 block">Full Name</label>
              <input type="text" value={newAccount.full_name} onChange={(e) => setNewAccount({ ...newAccount, full_name: e.target.value })} placeholder="John Doe" className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
            </div>
            <div>
              <label className="text-ink-muted text-xs mb-1 block">Email Address</label>
              <input type="email" value={newAccount.email} onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })} placeholder="user@example.com" className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
            </div>
            <div>
              <label className="text-ink-muted text-xs mb-1 block">Password</label>
              <input type="password" value={newAccount.password} onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })} placeholder="Min. 8 characters" className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
            </div>
            <div>
              <label className="text-ink-muted text-xs mb-1 block">Account Type</label>
              <select value={newAccount.role} onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm">
                {roles.map((role) => (<option key={role.value} value={role.value}>{role.label} — {role.desc}</option>))}
              </select>
            </div>
            <div>
              <label className="text-ink-muted text-xs mb-1 block">Initial Tokens</label>
              <input type="number" value={newAccount.initial_tokens} onChange={(e) => setNewAccount({ ...newAccount, initial_tokens: e.target.value })} placeholder="25" className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
            </div>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {roles.map((role) => (
              <div key={role.value} onClick={() => setNewAccount({ ...newAccount, role: role.value })} className={"p-3 rounded-xl border cursor-pointer transition " + (newAccount.role === role.value ? "border-purple-500 bg-accent/[0.08]" : "border-line bg-surface hover:border-accent/25")}>
                <div className={"font-semibold text-xs mb-0.5 " + role.color}>{role.label}</div>
                <div className="text-ink-subtle text-xs">{role.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreateAccount} disabled={creating || !newAccount.email || !newAccount.password} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-xl transition text-sm">{creating ? "Creating..." : "Create Account"}</button>
            <button onClick={() => setShowCreateForm(false)} className="bg-raised hover:bg-raised-hover text-white font-semibold py-2 px-6 rounded-xl transition text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <input type="text" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-canvas border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
          {loading ? <p className="text-ink-muted text-sm">Loading users...</p> : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((user, i) => (
                <div key={i} onClick={() => { setSelectedUser(user); setActiveTab("details"); }} className={"flex items-center justify-between p-3 rounded-xl cursor-pointer transition " + (selectedUser?.id === user.id ? "bg-accent/[0.08] border border-accent/50" : "bg-surface border border-line hover:border-accent/25")}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">{user.email?.[0]?.toUpperCase()}</div>
                    <div>
                      <div className="text-sm font-semibold truncate max-w-36">{user.email}</div>
                      <div className="text-ink-subtle text-xs">{new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {user.is_banned && <span className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded-full">Banned</span>}
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (user.role === "super_admin" ? "bg-red-500/10 text-red-400" : user.role === "manager" ? "bg-orange-900/30 text-orange-400" : user.role === "author" ? "bg-sky-500/10 text-sky-300" : user.role === "support" ? "bg-emerald-500/10 text-emerald-300" : "bg-raised text-ink-muted")}>
                      {user.role?.replace("_", " ") || "user"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUser ? (
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-line">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-semibold">{selectedUser.email?.[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{selectedUser.email}</h3>
                <p className="text-ink-subtle text-xs">Joined {new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-ink-subtle hover:text-white text-xs transition">Close</button>
            </div>

            <div className="flex border-b border-line">
              {["details", "permissions"].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={"flex-1 py-2.5 text-xs font-semibold capitalize transition " + (activeTab === tab ? "text-white border-b-2 border-purple-500" : "text-ink-subtle hover:text-white")}>
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "details" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-canvas rounded-xl p-3"><div className="text-ink-subtle text-xs mb-1">Token Balance</div><div className="text-amber-300 font-semibold">{selectedUser.token_balance ?? 25} tokens</div></div>
                  <div className="bg-canvas rounded-xl p-3"><div className="text-ink-subtle text-xs mb-1">Status</div><div className={selectedUser.is_banned ? "text-red-400 font-semibold text-sm" : "text-emerald-300 font-semibold text-sm"}>{selectedUser.is_banned ? "Banned" : "Active"}</div></div>
                </div>

                <div>
                  <label className="text-ink-muted text-xs mb-2 block font-semibold">Adjust Tokens</label>
                  <div className="flex gap-2 mb-2">
                    {["add", "deduct", "set"].map((action) => (
                      <button key={action} onClick={() => setTokenAction(action)} className={"flex-1 py-1.5 rounded-lg text-xs font-semibold transition capitalize " + (tokenAction === action ? (action === "add" ? "bg-green-600 text-white" : action === "deduct" ? "bg-red-600 text-white" : "bg-blue-600 text-white") : "bg-raised text-ink-muted")}>{action}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="number" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} placeholder="Amount" className="flex-1 bg-canvas border border-line hover:border-line-strong rounded-xl px-3 py-2 text-white placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition text-sm" />
                    <button onClick={handleTokenUpdate} disabled={updatingTokens || !tokenAmount} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl transition text-sm">{updatingTokens ? "..." : "Apply"}</button>
                  </div>
                </div>

                <div>
                  <label className="text-ink-muted text-xs mb-2 block font-semibold">Account Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((role) => (
                      <button key={role.value} onClick={() => handleRoleChange(selectedUser.id, role.value)} className={"p-2 rounded-xl border text-left transition " + (selectedUser.role === role.value ? "border-purple-500 bg-accent/[0.08]" : "border-line bg-surface hover:border-accent/25")}>
                        <div className={"font-semibold text-xs " + role.color}>{role.label}</div>
                        <div className="text-ink-subtle text-xs">{role.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => handleBanUser(selectedUser.id, selectedUser.is_banned)} className={"w-full font-semibold py-2.5 rounded-xl transition text-sm " + (selectedUser.is_banned ? "bg-emerald-500/10 text-emerald-300 hover:bg-green-900/50" : "bg-red-500/10 text-red-400 hover:bg-red-900/50")}>
                  {selectedUser.is_banned ? "Unban User" : "Ban User"}
                </button>
              </div>
            )}

            {activeTab === "permissions" && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-ink-muted text-xs">Customize access for this account</p>
                  <button onClick={handleSavePermissions} disabled={savingPermissions} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-1.5 px-4 rounded-xl transition text-xs">{savingPermissions ? "Saving..." : "Save Permissions"}</button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <p className="text-ink-subtle text-xs w-full">Quick apply role defaults:</p>
                  {roles.map((role) => (
                    <button key={role.value} onClick={() => applyRoleDefaults(role.value)} className={"px-3 py-1 rounded-xl text-xs font-semibold border transition " + role.color + " border-line hover:bg-raised"}>
                      {role.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {sections.map((section) => (
                    <div key={section}>
                      <p className="text-ink-subtle text-xs font-medium mb-2">{section}</p>
                      <div className="space-y-1">
                        {ALL_PERMISSIONS.filter((p) => p.section === section).map((permission) => (
                          <div key={permission.key} onClick={() => togglePermission(permission.key)} className={"flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition " + (userPermissions.includes(permission.key) ? "bg-accent/[0.08] border border-accent/25" : "bg-surface border border-line hover:border-line-strong")}>
                            <span className="text-sm">{permission.label}</span>
                            <div className={"w-4 h-4 rounded-full border-2 flex items-center justify-center " + (userPermissions.includes(permission.key) ? "bg-purple-600 border-purple-600" : "border-gray-600")}>
                              {userPermissions.includes(permission.key) && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-line rounded-2xl p-12 text-center">
            <p className="text-ink-muted text-sm">Select a user to view details, manage tokens, roles and permissions</p>
          </div>
        )}
      </div>
    </div>
  );
}