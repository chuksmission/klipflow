import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin(token: string) {
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await checkAdmin(authHeader.replace("Bearer ", ""));
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, password, role, full_name, initial_tokens } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    const userId = newUser.user.id;
    const isStaff = ["super_admin", "manager", "author", "support"].includes(role);

    await supabase.from("user_profiles").upsert({
      id: userId,
      is_admin: isStaff,
      role: role || "user",
      plan: isStaff ? role : "trial",
    }, { onConflict: "id" });

    await supabase.from("user_tokens").upsert({
      user_id: userId,
      balance: parseInt(initial_tokens) || 25,
      total_used: 0,
    }, { onConflict: "user_id" });

    if (isStaff) {
      const ROLE_DEFAULTS: Record<string, string[]> = {
        super_admin: ["overview","users_view","users_edit","revenue","generations","ai_providers","token_pricing","prompt_templates","video_templates","plans","payment_gateways","orders","social_auth","integrations","site_settings","announcements","blog","leads","email_settings","email_templates","abuse_control"],
        manager: ["overview","users_view","users_edit","revenue","generations","token_pricing","prompt_templates","video_templates","plans","orders","announcements","blog","leads","email_templates","abuse_control"],
        author: ["blog","leads","prompt_templates","video_templates"],
        support: ["overview","users_view","generations","leads","abuse_control"],
      };

      const permissions: Record<string, boolean> = {};
      const defaultPerms = ROLE_DEFAULTS[role] || [];
      defaultPerms.forEach((p) => { permissions[p] = true; });

      await supabase.from("staff_permissions").upsert({
        user_id: userId,
        role,
        permissions,
        created_by: admin.id,
      }, { onConflict: "user_id" });
    }

    return NextResponse.json({ success: true, user_id: userId });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
