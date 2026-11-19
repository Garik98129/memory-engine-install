// The counter's tests: a real SQLite under the same SQL D1 runs (node:sqlite), the Worker's own handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handle, parse, CEILING, BODY_MAX } from "../src/worker.js";

const ORIGIN = "https://garik98129.github.io";
const KEY = "a-key-of-the-owner-0123456789abcdef";
const NOW = new Date("2026-11-19T23:59:59Z");
const LINE = { e: "start", p: "chatgpt", l: "ru", c: "IL", t: 0 };

function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return {
    raw: db,
    prepare(sql) {
      const statement = db.prepare(sql);
      let args = [];
      const bound = {
        bind(...values) { args = values; return bound; },
        async first() { const row = statement.get(...args); return row ? { ...row } : null; },
        async run() { statement.run(...args); return { success: true }; },
        async all() { return { results: statement.all(...args).map((row) => ({ ...row })) }; },
      };
      return bound;
    },
  };
}

const env = (db, extra = {}) => ({ DB: db, ALLOWED_ORIGIN: ORIGIN, STATS_KEY: KEY, ...extra });
const rows = (db) => db.raw.prepare("SELECT * FROM counts ORDER BY day, event, test").all().map((row) => ({ ...row }));
const post = (body, headers = {}) =>
  new Request("https://counter.example/e", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "text/plain", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("a line she sends is counted, and the same line again adds one", async () => {
  const db = d1();
  assert.equal((await handle(post(LINE), env(db), NOW)).status, 204);
  assert.equal((await handle(post(LINE), env(db), NOW)).status, 204);
  assert.deepEqual(rows(db), [
    { day: "2026-11-19", event: "start", platform: "chatgpt", language: "ru", country: "IL", test: 0, n: 2 },
  ]);
});

test("nothing of the request is kept but the five answers: no address, no header, no time of day", async () => {
  const db = d1();
  const response = await handle(
    post({ ...LINE, e: "done", l: "pt-BR", c: "BR" }, {
      "CF-Connecting-IP": "203.0.113.7",
      "X-Forwarded-For": "203.0.113.7",
      "User-Agent": "Mozilla/5.0 (iPhone)",
      "CF-IPCountry": "DE",
    }),
    env(db),
    NOW,
  );
  assert.equal(response.status, 204);
  const kept = rows(db);
  assert.deepEqual(Object.keys(kept[0]).sort(), ["country", "day", "event", "language", "n", "platform", "test"]);
  const all = JSON.stringify(kept);
  for (const seen of ["203.0.113.7", "iPhone", "Mozilla", "23:59", "DE"]) assert.ok(!all.includes(seen), seen);
  assert.equal(kept[0].country, "BR", "her answer, never the request's country");
});

test("her own test runs are counted apart", async () => {
  const db = d1();
  await handle(post(LINE), env(db), NOW);
  await handle(post({ ...LINE, t: 1 }), env(db), NOW);
  assert.deepEqual(rows(db).map((row) => [row.test, row.n]), [[0, 1], [1, 1]]);
});

test("a line the counter does not know is dropped, and nothing is written", async () => {
  const bad = [
    { ...LINE, e: "stuck" }, { ...LINE, e: "START" }, { ...LINE, p: "gemini" }, { ...LINE, p: "ChatGPT" },
    { ...LINE, l: "RU" }, { ...LINE, l: "russian" }, { ...LINE, l: "zh-Hant-TWX" }, { ...LINE, l: 7 },
    { ...LINE, c: "il" }, { ...LINE, c: "ISR" }, { ...LINE, c: "" }, { ...LINE, t: 2 }, { ...LINE, t: "0" },
    { ...LINE, ip: "203.0.113.7" }, { e: "start", p: "chatgpt", l: "ru", c: "IL" },
    "not json", "[]", "null", "{}", JSON.stringify({ ...LINE, l: "x".repeat(BODY_MAX) }),
  ];
  for (const body of bad) {
    const db = d1();
    const response = await handle(post(body), env(db), NOW);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
    assert.deepEqual(rows(db), []);
  }
});

test("a body longer than a line is refused before it is read whole", async () => {
  const db = d1();
  const response = await handle(post(JSON.stringify(LINE), { "Content-Length": String(BODY_MAX + 1) }), env(db), NOW);
  assert.equal(response.status, 400);
  assert.deepEqual(rows(db), []);
});

test("another page, or no page, may not send a line", async () => {
  for (const origin of ["https://evil.example", "null", "https://garik98129.github.io.evil.example"]) {
    const db = d1();
    assert.equal((await handle(post(LINE, { Origin: origin }), env(db), NOW)).status, 403, origin);
    assert.deepEqual(rows(db), []);
  }
  const db = d1();
  const noOrigin = new Request("https://counter.example/e", { method: "POST", body: JSON.stringify(LINE) });
  assert.equal((await handle(noOrigin, env(db), NOW)).status, 403);
  assert.equal((await handle(post(LINE), env(db, { ALLOWED_ORIGIN: "" }), NOW)).status, 403, "no page set, none allowed");
  assert.deepEqual(rows(db), []);
});

test("the page's preflight is answered for the page alone, and /e takes only POST", async () => {
  const db = d1();
  const preflight = await handle(new Request("https://counter.example/e", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env(db), NOW);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const get = await handle(new Request("https://counter.example/e", { headers: { Origin: ORIGIN } }), env(db), NOW);
  assert.equal(get.status, 405);
  assert.equal((await handle(new Request("https://counter.example/other"), env(db), NOW)).status, 404);
});

test("past the ceiling a day counts no more, and the next day counts again", async () => {
  const db = d1();
  db.raw.prepare("INSERT INTO counts VALUES ('2026-11-19', 'start', 'grok', 'en', 'US', 0, ?)").run(CEILING);
  assert.equal((await handle(post(LINE), env(db), NOW)).status, 429);
  assert.equal(rows(db).length, 1);
  assert.equal((await handle(post(LINE), env(db), new Date("2026-11-20T00:00:01Z"))).status, 204);
});

test("the day is the UTC date, whatever the hour", async () => {
  const db = d1();
  await handle(post(LINE), env(db), new Date("2026-11-19T00:00:00Z"));
  await handle(post(LINE), env(db), new Date("2026-11-19T23:59:59.999Z"));
  assert.deepEqual(rows(db).map((row) => [row.day, row.n]), [["2026-11-19", 2]]);
});

test("the numbers need the owner's key", async () => {
  const db = d1();
  await handle(post(LINE), env(db), NOW);
  await handle(post({ ...LINE, e: "done" }), env(db), new Date("2026-11-21T10:00:00Z"));
  const ask = (query, extra) => handle(new Request(`https://counter.example/stats${query}`), env(db, extra), NOW);
  assert.equal((await ask("")).status, 403);
  assert.equal((await ask("?key=wrong")).status, 403);
  assert.equal((await ask(`?key=${KEY}x`)).status, 403);
  assert.equal((await ask("?key=", { STATS_KEY: "" })).status, 403, "no key set opens nothing");
  assert.equal((await ask(`?key=${KEY}&since=yesterday`)).status, 400);
  const all = await ask(`?key=${KEY}`);
  assert.equal(all.status, 200);
  assert.equal(all.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await all.json()).map((row) => [row.day, row.event, row.n]), [["2026-11-19", "start", 1], ["2026-11-21", "done", 1]]);
  assert.deepEqual((await (await ask(`?key=${KEY}&since=2026-11-20`)).json()).map((row) => row.day), ["2026-11-21"]);
});

test("parse knows the engine's language codes and refuses what setup refuses", () => {
  for (const l of ["ru", "he", "pt-BR", "zh-Hant-TW", "fil"]) assert.ok(parse(JSON.stringify({ ...LINE, l })), l);
  for (const l of ["r", "ruso", "pt_BR", "pt-", "-BR", "zh-Hant-TWX"]) assert.equal(parse(JSON.stringify({ ...LINE, l })), null, l);
});

test("Workers Logs stay off in the configuration", () => {
  const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /\[observability\]\nenabled = false\n/);
  assert.doesNotMatch(config, /enabled = true/);
  assert.doesNotMatch(config, /STATS_KEY\s*=/, "the key is a secret, never in the file");
});
