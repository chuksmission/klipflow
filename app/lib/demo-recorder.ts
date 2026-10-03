// Server-only: records a walkthrough of klipflowai.com in a Browserless cloud
// browser. Recording needs a live CDP connection with record=true on the
// stealth route (headful); the result is a WebM returned over CDP as base64.
// Docs: https://docs.browserless.io/baas/monitor-sessions/screen-recording
// playwright-core is loaded only when a recording starts (see recordWalkthrough),
// so the Demo Studio route still loads if the package fails to load in production
import type { Locator, Page } from "playwright-core";
import { MAX_RECORD_SECONDS, type DemoStep, type StepResult } from "./demo-studio";

export const DEMO_SITE = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")
  ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  : "https://www.klipflowai.com";

// A visible cursor (headless capture has none) that pulses on click
const CURSOR_SCRIPT = `(() => {
  if (window.__kfCursor) return; window.__kfCursor = true;
  const add = () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:rgba(109,74,255,.35);border:2px solid #fff;box-shadow:0 0 0 2px rgba(109,74,255,.85),0 4px 14px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;transition:transform .12s ease;transform:translate(-100px,-100px)";
    document.documentElement.appendChild(c);
    let x = -100, y = -100;
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; c.style.transform = "translate(" + x + "px," + y + "px)"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "translate(" + x + "px," + y + "px) scale(.7)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = "translate(" + x + "px," + y + "px)"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
})();`;

export interface RecordInput {
  apiKey: string;
  email: string;
  password: string;
  steps: DemoStep[];
  viewport: { width: number; height: number };
  samples: { video?: string; image?: string };
  endpoint?: string;   // Browserless region base, e.g. wss://production-sfo.browserless.io
}

export interface RecordOutput { video: Buffer; seconds: number; log: StepResult[] }

class Cursor {
  x: number;
  y: number;
  constructor(private page: Page, w: number, h: number) { this.x = w / 2; this.y = h / 2; }
  async moveTo(x: number, y: number) {
    await this.page.mouse.move(x, y, { steps: 22 });
    this.x = x; this.y = y;
  }
  async moveToLocator(l: Locator) {
    await l.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
    const box = await l.boundingBox();
    if (!box) throw new Error("Element isn't visible");
    await this.moveTo(box.x + box.width / 2, box.y + box.height / 2);
  }
  /** After a navigation the overlay starts hidden: put it back where the mouse is */
  async restore() { await this.page.mouse.move(this.x + 1, this.y + 1).catch(() => {}); }
}

/** Visible text, a label, a placeholder or `css=...`, tried in that order. */
async function locate(page: Page, target: string, timeoutMs = 7000): Promise<Locator | null> {
  if (target.startsWith("css=")) {
    const l = page.locator(target.slice(4)).first();
    return (await l.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false)) ? l : null;
  }
  const name = target.trim();
  const candidates = [
    page.getByRole("button", { name }), page.getByRole("link", { name }), page.getByRole("tab", { name }),
    page.getByRole("radio", { name }), page.getByRole("menuitem", { name }), page.getByLabel(name),
    page.getByPlaceholder(name), page.getByText(name),
  ];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const c of candidates) {
      const l = c.first();
      if (await l.isVisible().catch(() => false)) return l;
    }
    await page.waitForTimeout(300);
  }
  return null;
}

async function runStep(page: Page, cursor: Cursor, s: DemoStep, samples: RecordInput["samples"]) {
  const pause = (ms: number) => page.waitForTimeout(ms);
  switch (s.action) {
    case "goto": {
      const path = s.target.startsWith("/") ? s.target : `/${s.target}`;
      await page.goto(`${DEMO_SITE}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await pause(1500);
      await cursor.restore();
      return;
    }
    case "click": case "hover": {
      const l = await locate(page, s.target);
      if (!l) throw new Error(`Couldn't find "${s.target}"`);
      await cursor.moveToLocator(l);
      await pause(250);
      if (s.action === "click") await page.mouse.click(cursor.x, cursor.y);
      return;
    }
    case "type": {
      const l = await locate(page, s.target);
      if (!l) throw new Error(`Couldn't find the field "${s.target}"`);
      await cursor.moveToLocator(l);
      await page.mouse.click(cursor.x, cursor.y);
      await page.keyboard.type(s.value, { delay: 38 });
      return;
    }
    case "press":
      await page.keyboard.press(s.value || "Enter");
      return;
    case "select": {
      const l = await locate(page, s.target);
      if (!l) throw new Error(`Couldn't find the dropdown "${s.target}"`);
      await cursor.moveToLocator(l);
      await l.selectOption({ label: s.value }).catch(() => l.selectOption(s.value));
      return;
    }
    case "upload": {
      const kind = s.value === "image" ? "image" : "video";
      const url = samples[kind];
      if (!url) throw new Error(`Add a sample ${kind} in Demo Studio settings to record upload steps.`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Couldn't load the sample ${kind}.`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const input = page.locator(`input[type=file][accept*="${kind}"]`).first();
      const fallback = page.locator("input[type=file]").first();
      const target = (await input.count()) ? input : fallback;
      await target.setInputFiles({ name: kind === "video" ? "sample.mp4" : "sample.jpg", mimeType: kind === "video" ? "video/mp4" : "image/jpeg", buffer });
      await pause(1200);
      return;
    }
    case "scroll": {
      const total = (parseInt(s.value, 10) || 600) * (s.target === "up" ? -1 : 1);
      for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, total / 12); await pause(35); }
      return;
    }
    case "wait":
      await pause(Math.min(Math.max(s.seconds, 0), 30) * 1000);
      return;
    case "wait_for_text":
      await page.getByText(s.target).first().waitFor({ state: "visible", timeout: Math.min(Math.max(s.seconds || 20, 1), 90) * 1000 });
      return;
  }
}

/** Runs steps on a page with a visible cursor; failed steps are logged and skipped. */
export async function executeSteps(page: Page, steps: DemoStep[], viewport: { width: number; height: number }, samples: RecordInput["samples"]): Promise<StepResult[]> {
  const cursor = new Cursor(page, viewport.width, viewport.height);
  await cursor.restore();
  const started = Date.now();
  const log: StepResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (Date.now() - started > MAX_RECORD_SECONDS * 1000) { log.push({ index: i, ok: false, error: "Stopped: the recording time limit was reached." }); break; }
    try {
      await runStep(page, cursor, steps[i], samples);
      log.push({ index: i, ok: true });
    } catch (e) {
      log.push({ index: i, ok: false, error: e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "Step failed" });
    }
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);   // hold the last frame briefly
  return log;
}

export { CURSOR_SCRIPT };

export async function recordWalkthrough(input: RecordInput): Promise<RecordOutput> {
  const base = (input.endpoint || "wss://production-sfo.browserless.io").replace(/\/$/, "");
  const ws = `${base}?token=${encodeURIComponent(input.apiKey)}&headless=false&stealth&record=true&timeout=280000`;
  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (e) {
    throw new Error(`The browser automation library couldn't load on the server: ${e instanceof Error ? e.message : String(e)}`);
  }
  const browser = await chromium.connectOverCDP(ws, { timeout: 30_000 });
  try {
    // Recording only works on the session's existing context and page
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();
    await page.setViewportSize(input.viewport);
    await page.addInitScript(CURSOR_SCRIPT);

    // Sign in to the demo account before recording starts
    await page.goto(`${DEMO_SITE}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByRole("button", { name: "Reject" }).first().click({ timeout: 3000 }).catch(() => {});
    await page.locator('input[type="email"]').first().fill(input.email);
    await page.locator('input[autocomplete="current-password"]').first().fill(input.password);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 25_000 }).catch(() => { throw new Error("Couldn't sign in to the demo account. Check its email and password."); });
    await page.waitForTimeout(1200);

    const cdp = await context.newCDPSession(page);
    // Browserless-specific CDP commands aren't in Playwright's protocol types
    const send = cdp.send.bind(cdp) as unknown as (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    await send("Browserless.startRecording");
    const started = Date.now();

    const log = await executeSteps(page, input.steps, input.viewport, input.samples);

    const res = await send("Browserless.stopRecording", { encoding: "base64" });
    const seconds = (Date.now() - started) / 1000;
    const b64 = typeof res.value === "string" ? res.value : typeof res.data === "string" ? res.data : "";
    if (!b64) throw new Error("Browserless didn't return a recording. Check that your plan includes session recording.");
    return { video: Buffer.from(b64, "base64"), seconds, log };
  } finally {
    await browser.close().catch(() => {});
  }
}
