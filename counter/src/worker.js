// The installation counter (memory-engine, docs/DESIGN_PHASE3.md §5a, «The counter»).
//
// It keeps counts — one table of day, event, AI, language, country, a mark for the owner's own tests,
// and a count — and no name or address. A line comes only when she presses a button on the
// installation page; the page sends her answers as she gave them. Of the request the code reads its
// path, its method, the headers Origin and Content-Length and its body — never its address, its
// other headers or Cloudflare's guess of where it came from. Workers Logs and traces are off
// (wrangler.toml); Cloudflare's live view can still show a request to whoever watches at that moment.

import { COUNTRIES } from "./countries.js";

export const EVENTS = new Set(["start", "done"]);
export const PLATFORMS = new Set(["chatgpt", "claude", "grok"]);   // engine/platforms.toml, installable rows
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;              // engine/checks/config_check.py
const LANGUAGE_MAX = 10;                                           // engine/setup/setup.py
const LANGUAGES = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
const FIELDS = ["e", "p", "l", "c", "t"];
export const CEILING = 5000;     // events a day; past it the day counts no more
export const BODY_MAX = 256;     // bytes: a line is far shorter
export const KEY_MIN = 32;       // characters of the owner's key, or the numbers stay shut

// One line, or null when it is not one this counter knows. Her language is kept by its primary code
// alone, and only when it names a language; her country only when it is one of ISO 3166-1.
export function parse(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== FIELDS.length || !FIELDS.every((k) => keys.includes(k))) return null;
  const { e, p, l, c, t } = data;
  if (!EVENTS.has(e) || !PLATFORMS.has(p)) return null;
  if (typeof l !== "string" || l.length > LANGUAGE_MAX || !LANGUAGE.test(l)) return null;
  const language = l.split("-")[0];
  if (LANGUAGES.of(language) === undefined) return null;
  if (typeof c !== "string" || !COUNTRIES.has(c)) return null;
  if (t !== 0 && t !== 1) return null;
  return { event: e, platform: p, language, country: c, test: t };
}

export function day(now) {
  return now.toISOString().slice(0, 10);
}

// Equal or not, in a time that tells nothing of either string: both are hashed first.
async function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length < KEY_MIN) return false;
  const encode = (s) => new TextEncoder().encode(s);
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", encode(a)), crypto.subtle.digest("SHA-256", encode(b))]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// The day's total grows by one only below the ceiling, in one statement, and the line is counted only
// when it did: one row read and written a day's total, past the ceiling no more.
async function count(db, line, today) {
  const step = await db
    .prepare("INSERT INTO days (day, total) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET total = total + 1 WHERE total < ?")
    .bind(today, CEILING)
    .run();
  if (!(step && step.meta && step.meta.changes > 0)) return false;
  await db
    .prepare(
      "INSERT INTO counts (day, event, platform, language, country, test, n) VALUES (?, ?, ?, ?, ?, ?, 1) " +
        "ON CONFLICT (day, event, platform, language, country, test) DO UPDATE SET n = n + 1",
    )
    .bind(today, line.event, line.platform, line.language, line.country, line.test)
    .run();
  return true;
}

// The body, at most BODY_MAX bytes of UTF-8, read no further than that; null otherwise.
async function readBody(request) {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > BODY_MAX)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_MAX) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export async function handle(request, env, now = new Date()) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  try {
    if (url.pathname === "/e") {
      if (!allowed || origin !== allowed) return new Response(null, { status: 403 });
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(allowed) });
      if (request.method !== "POST") return new Response(null, { status: 405, headers: cors(allowed) });
      const text = await readBody(request);
      const line = text === null ? null : parse(text);
      if (line === null) return new Response(null, { status: 400, headers: cors(allowed) });
      const counted = await count(env.DB, line, day(now));
      return new Response(null, { status: counted ? 204 : 429, headers: cors(allowed) });
    }
    if (url.pathname === "/stats" && request.method === "GET") {
      if (!(await same(url.searchParams.get("key"), env.STATS_KEY))) return new Response(null, { status: 403 });
      const since = url.searchParams.get("since") || "0000-00-00";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return new Response(null, { status: 400 });
      const { results } = await env.DB
        .prepare(
          "SELECT day, event, platform, language, country, test, n FROM counts WHERE day >= ? " +
            "ORDER BY day, event, platform, language, country, test",
        )
        .bind(since)
        .all();
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return new Response(null, { status: 404 });
  } catch {
    // The base out of reach or past its own daily limit: the count stops, the page goes on.
    const headers = url.pathname === "/e" && allowed && origin === allowed ? cors(allowed) : {};
    return new Response(null, { status: 503, headers });
  }
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
