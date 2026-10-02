import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: generations } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false });

    return NextResponse.json({ generations: generations || [] });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Feature / unfeature a generation on the homepage showcase
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id, is_featured, featured_category, featured_title, featured_sort } = await req.json() as {
      id?: number | string;
      is_featured?: boolean;
      featured_category?: string | null;
      featured_title?: string | null;
      featured_sort?: number;
    };
    if (id === undefined || id === null) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const update: Record<string, unknown> = {
      is_featured: !!is_featured,
      featured_category: is_featured ? (featured_category || null) : null,
      featured_title: is_featured ? (featured_title?.trim() || null) : null,
    };
    // Only sent once supabase/showcase_studio.sql has added the column
    if (featured_sort !== undefined && Number.isFinite(Number(featured_sort))) {
      update.featured_sort = is_featured ? Math.round(Number(featured_sort)) : 0;
    }

    const { data, error } = await supabase
      .from("generations")
      .update(update)
      .eq("id", id)
      .select("id, is_featured, featured_category, featured_title")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, generation: data });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
