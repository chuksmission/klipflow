// Replicate predictions for server routes. Model inputs are read from each
// model's published schema at runtime (field names differ between models and
// versions), so a new model version doesn't need a code change.

const API = "https://api.replicate.com/v1";

export type PredictionStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled";
export interface Prediction { id: string; status: PredictionStatus; output: unknown; error: string | null }

interface SchemaProp { type?: string; format?: string; enum?: unknown[]; allOf?: { $ref?: string }[]; default?: unknown }
interface ModelInfo { version: string; input: Record<string, SchemaProp>; enums: Record<string, unknown[]> }

const cache = new Map<string, { at: number; info: ModelInfo }>();

const headers = (key: string) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

async function json(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { detail: text.slice(0, 200) }; }
}

/** Latest version id and its input fields for `owner/name`. */
export async function modelInfo(key: string, model: string): Promise<ModelInfo> {
  const hit = cache.get(model);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.info;
  const res = await fetch(`${API}/models/${model}`, { headers: headers(key) });
  const data = await json(res);
  if (!res.ok) throw new Error(`Replicate: ${data.detail ?? data.title ?? res.status}`);
  const version = data.latest_version?.id;
  const schemas = data.latest_version?.openapi_schema?.components?.schemas ?? {};
  if (!version) throw new Error(`Replicate: ${model} has no published version.`);
  const input: Record<string, SchemaProp> = schemas.Input?.properties ?? {};
  // Enum fields are usually declared as separate schemas referenced via allOf
  const enums: Record<string, unknown[]> = {};
  for (const [name, prop] of Object.entries(input)) {
    if (prop.enum) enums[name] = prop.enum;
    const ref = prop.allOf?.[0]?.$ref?.split("/").pop();
    if (ref && schemas[ref]?.enum) enums[name] = schemas[ref].enum;
  }
  const info = { version, input, enums };
  cache.set(model, { at: Date.now(), info });
  return info;
}

/** Field whose name matches `pattern` and takes a file/URL, if the model has one. */
export function uriField(info: ModelInfo, pattern: RegExp, exclude?: RegExp): string | null {
  return Object.entries(info.input).find(([name, p]) => p.format === "uri" && pattern.test(name) && !exclude?.test(name))?.[0] ?? null;
}

export async function startPrediction(key: string, version: string, input: Record<string, unknown>): Promise<Prediction> {
  const res = await fetch(`${API}/predictions`, { method: "POST", headers: headers(key), body: JSON.stringify({ version, input }) });
  const data = await json(res);
  if (!res.ok || !data.id) throw new Error(`Replicate: ${data.detail ?? data.title ?? res.status}`);
  return data as Prediction;
}

export async function getPrediction(key: string, id: string): Promise<Prediction> {
  if (!/^[a-z0-9]{10,64}$/i.test(id)) throw new Error("Invalid prediction id");
  const res = await fetch(`${API}/predictions/${id}`, { headers: headers(key) });
  const data = await json(res);
  if (!res.ok) throw new Error(`Replicate: ${data.detail ?? res.status}`);
  return data as Prediction;
}

/** First URL in a prediction's output (outputs are a URL, a list, or an object of URLs). */
export function outputUrl(output: unknown, prefer?: RegExp): string | null {
  const urls: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string" && /^https?:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(output);
  return (prefer && urls.find((u) => prefer.test(u))) ?? urls[0] ?? null;
}
