// The installation counter (memory-engine, docs/DESIGN_PHASE3.md §5a, «The counter»).
//
// It keeps counts and nothing of a person: one table — day, event, AI, language, country, a mark
// for the owner's own tests, and a count. A line comes only when she presses a button on the
// installation page; the page sends her answers as she gave them, and nothing else is read from
// the request — not its address, not its headers, not Cloudflare's guess of where it came from.
// Workers Logs are off (wrangler.toml), so nothing of a request outlives it.

export const EVENTS = new Set(["start", "done"]);
export const PLATFORMS = new Set(["chatgpt", "claude", "grok"]);   // engine/platforms.toml, installable
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;              // engine/checks/config_check.py
const LANGUAGE_MAX = 10;                                           // engine/setup/setup.py
const COUNTRY = /^[A-Z]{2}$/;                                       // ISO 3166-1 alpha-2
const FIELDS = ["e", "p", "l", "c", "t"];
export const CEILING = 5000;     // events a day; past it the day counts no more
export const BODY_MAX = 256;     // bytes: a line is far shorter

// One line, or null when it is not one this counter knows.
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
  if (typeof c !== "string" || !COUNTRY.test(c)) return null;
  if (t !== 0 && t !== 1) return null;
  return { event: e, platform: p, language: l, country: c, test: t };
}

export function day(now) {
  return now.toISOString().slice(0, 10);
}

function same(a, b) {
  // Compares two strings in a time that does not depend on where they first differ.
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
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

async function count(db, line, today) {
  const row = await db.prepare("SELECT COALESCE(SUM(n), 0) AS total FROM counts WHERE day = ?").bind(today).first();
  if (row && row.total >= CEILING) return false;
  await db
    .prepare(
      "INSERT INTO counts (day, event, platform, language, country, test, n) VALUES (?, ?, ?, ?, ?, ?, 1) " +
        "ON CONFLICT (day, event, platform, language, country, test) DO UPDATE SET n = n + 1",
    )
    .bind(today, line.event, line.platform, line.language, line.country, line.test)
    .run();
  return true;
}

async function readBody(request) {
  const declared = Number(request.headers.get("Content-Length") || "0");
  if (declared > BODY_MAX) return null;
  const text = await request.text();
  return new TextEncoder().encode(text).length > BODY_MAX ? null : text;
}

export async function handle(request, env, now = new Date()) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;

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
    if (!same(url.searchParams.get("key"), env.STATS_KEY)) return new Response(null, { status: 403 });
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
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
