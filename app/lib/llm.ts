// Server-side structured JSON calls to Claude and GPT-4o (raw HTTP, as in the
// other routes), each falling back to the other provider when it fails.

export interface LlmKeys { claude: string; openai: string }

interface Request {
  system: string;
  text: string;
  /** data:image/... URLs, sent as vision input */
  images?: string[];
  schema: object;
  name: string;
  effort?: "low" | "medium" | "high";
  /** Which provider to try first (default Claude; vision tasks prefer GPT-4o) */
  prefer?: "claude" | "openai";
}

async function safeJson(res: Response) {
  try { const t = await res.text(); return t ? JSON.parse(t) : {}; } catch { return {}; }
}

async function viaClaude<T>(key: string, r: Request): Promise<T> {
  const images = (r.images ?? []).map((url) => {
    const [meta, b64] = url.split(",");
    return { type: "image", source: { type: "base64", media_type: meta.match(/data:(.*?);/)?.[1] ?? "image/jpeg", data: b64 } };
  });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: r.effort ?? "low", format: { type: "json_schema", schema: r.schema } },
      fallbacks: "default",
      system: r.system,
      messages: [{ role: "user", content: [...images, { type: "text", text: r.text }] }],
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `Claude request failed (${res.status})`);
  if (data.stop_reason === "refusal") throw new Error("The AI declined this request.");
  const text = (data.content ?? []).find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("No response from Claude");
  return JSON.parse(text) as T;
}

async function viaOpenAI<T>(key: string, r: Request): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: { name: r.name, strict: true, schema: r.schema } },
      messages: [
        { role: "system", content: r.system },
        { role: "user", content: [{ type: "text", text: r.text }, ...(r.images ?? []).map((url) => ({ type: "image_url", image_url: { url, detail: "low" } }))] },
      ],
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(data.choices?.[0]?.message?.refusal ?? "No response from OpenAI");
  return JSON.parse(text) as T;
}

export async function structured<T>(keys: LlmKeys, r: Request): Promise<T> {
  const order = (r.prefer === "openai" ? ["openai", "claude"] : ["claude", "openai"]) as ("claude" | "openai")[];
  const available = order.filter((p) => keys[p]);
  if (!available.length) throw new Error("AI isn't configured yet.");
  let lastError: unknown;
  for (const p of available) {
    try {
      return p === "claude" ? await viaClaude<T>(keys.claude, r) : await viaOpenAI<T>(keys.openai, r);
    } catch (err) {
      console.error(`${r.name} via ${p} failed:`, err);
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI request failed.");
}
