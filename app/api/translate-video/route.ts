import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachTask, claimCharge, getTokenPrice, isAdminRequest, releaseClaim } from "../../lib/charges";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? "";
}

async function safeJson(response: Response): Promise<any> {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// HeyGen expects the exact language string from its own list (e.g. "Spanish" or
// "Spanish (Spain)"). Resolve our plain language name against that list.
async function resolveHeygenLanguage(apiKey: string, language: string): Promise<string> {
  try {
    const res = await fetch("https://api.heygen.com/v2/video_translate/target_languages", {
      headers: { "X-Api-Key": apiKey, "Accept": "application/json" },
    });
    const data = await safeJson(res);
    const languages: string[] = data.data?.languages ?? [];
    const lower = language.toLowerCase();
    return languages.find((l) => l.toLowerCase() === lower)
      ?? languages.find((l) => l.toLowerCase().startsWith(lower + " ("))
      ?? languages.find((l) => l.toLowerCase().startsWith(lower))
      ?? language;
  } catch {
    return language;
  }
}

// Starts a HeyGen video translation. Requires a paid charge (from /api/tokens);
// if this returns an error the client refunds that charge via /api/tokens/refund.
export async function POST(req: NextRequest) {
  let chargeId: string | null = null;
  const release = async () => { if (chargeId) await releaseClaim(chargeId); };
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      video_url,
      source_language = "English",
      target_language,
      charge_id,
    } = await req.json() as { video_url?: string; source_language?: string; target_language?: string; charge_id?: string };

    if (!video_url) return NextResponse.json({ error: "video_url is required" }, { status: 400 });
    if (!target_language) return NextResponse.json({ error: "target_language is required" }, { status: 400 });
    if (target_language === source_language) {
      return NextResponse.json({ error: "Target language must differ from source language." }, { status: 400 });
    }

    // Payment: a paid, unused charge (at least one minute's worth), or an admin
    if (charge_id) {
      const claim = await claimCharge(charge_id, await getTokenPrice("video_translation", 20), user.id);
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });
      chargeId = charge_id;
    } else if (!(await isAdminRequest(authHeader))) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    const heygenApiKey = await getSetting("heygen_api_key");
    if (!heygenApiKey) {
      await release();
      return NextResponse.json({ error: "HeyGen API key not configured." }, { status: 503 });
    }

    const outputLanguage = await resolveHeygenLanguage(heygenApiKey, target_language);

    // translate_audio_only: false => full video output with lip-sync
    const heygenBody = {
      video_url,
      output_language: outputLanguage,
      title: `KlipflowAI ${source_language} to ${target_language} - ${user.id}-${Date.now()}`,
      translate_audio_only: false,
    };
    console.log("HeyGen translate POST body:", JSON.stringify(heygenBody));

    const heygenRes = await fetch("https://api.heygen.com/v2/video_translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Api-Key": heygenApiKey,
      },
      body: JSON.stringify(heygenBody),
    });

    const heygenData = await safeJson(heygenRes);
    console.log("HeyGen translate response:", heygenRes.status, JSON.stringify(heygenData));

    if (!heygenRes.ok || heygenData.error) {
      await release();
      const err = heygenData.error;
      return NextResponse.json({
        error: (typeof err === "string" ? err : err?.message) ?? heygenData.message ?? `HeyGen error (${heygenRes.status})`,
      }, { status: heygenRes.ok ? 400 : heygenRes.status });
    }

    const taskId = heygenData.data?.video_translate_id ?? heygenData.data?.id ?? heygenData.video_translate_id;
    if (!taskId) {
      await release();
      return NextResponse.json({ error: "HeyGen did not return a translation ID. Raw: " + JSON.stringify(heygenData) }, { status: 500 });
    }

    if (chargeId) await attachTask(chargeId, String(taskId), "heygen");
    return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "heygen" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video translation error:", error);
    await release();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
