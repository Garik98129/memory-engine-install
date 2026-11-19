// The counter's tests: a real SQLite under the same SQL D1 runs (node:sqlite), the Worker's own handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handle, parse, CEILING, BODY_MAX, KEY_MIN } from "../src/worker.js";
import { COUNTRIES } from "../src/countries.js";
import { LANGUAGES, ALIASES } from "../src/languages.js";

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
        async run() { const result = statement.run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
        async all() { return { results: statement.all(...args).map((row) => ({ ...row })) }; },
      };
      return bound;
    },
    // D1's batch: one transaction, statements in order, all rolled back when one fails.
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const env = (db, extra = {}) => ({ DB: db, ALLOWED_ORIGIN: ORIGIN, STATS_KEY: KEY, ...extra });
const rows = (db) => db.raw.prepare("SELECT * FROM counts ORDER BY day, event, test").all().map((row) => ({ ...row }));
const total = (db, day) => (db.raw.prepare("SELECT total FROM days WHERE day = ?").get(day) || { total: 0 }).total;
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
  assert.equal(total(db, "2026-11-19"), 2);
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
  for (const seen of ["203.0.113.7", "iPhone", "Mozilla", "23:59", "DE", "pt-BR"]) assert.ok(!all.includes(seen), seen);
  assert.equal(kept[0].country, "BR", "her answer, never the request's country");
  assert.equal(kept[0].language, "pt", "the primary code alone: no region, no subtag that could single anybody out");
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
    { ...LINE, l: "xx-Ab12Cd" }, { ...LINE, l: "qq" }, { ...LINE, l: "qzx" },
    { ...LINE, c: "il" }, { ...LINE, c: "ISR" }, { ...LINE, c: "" }, { ...LINE, c: "QQ" }, { ...LINE, c: "ZZ" },
    { ...LINE, t: 2 }, { ...LINE, t: "0" },
    { ...LINE, ip: "203.0.113.7" }, { e: "start", p: "chatgpt", l: "ru", c: "IL" },
    "not json", "[]", "null", "{}", "", JSON.stringify({ ...LINE, l: "x".repeat(BODY_MAX) }),
  ];
  for (const body of bad) {
    const db = d1();
    const response = await handle(post(body), env(db), NOW);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
    assert.deepEqual(rows(db), []);
    assert.equal(total(db, "2026-11-19"), 0);
  }
});

test("a body that is no short UTF-8 line is refused, and read no further than its limit", async () => {
  const db = d1();
  const declared = await handle(post(JSON.stringify(LINE), { "Content-Length": String(BODY_MAX + 1) }), env(db), NOW);
  assert.equal(declared.status, 400);
  assert.equal((await handle(post(JSON.stringify(LINE), { "Content-Length": "abc" }), env(db), NOW)).status, 400);
  let pulled = 0;
  const chunk = new Uint8Array(64 * 1024).fill(0x20);
  const stream = new ReadableStream({
    pull(controller) {
      pulled += chunk.byteLength;
      if (pulled > 5 * 1024 * 1024) controller.close(); else controller.enqueue(chunk);
    },
  });
  const chunked = new Request("https://counter.example/e", { method: "POST", headers: { Origin: ORIGIN }, body: stream, duplex: "half" });
  assert.equal((await handle(chunked, env(db), NOW)).status, 400);
  assert.ok(pulled <= 4 * chunk.byteLength, `read ${pulled} bytes of a stream with no length`);
  const broken = new Request("https://counter.example/e", {
    method: "POST", headers: { Origin: ORIGIN }, body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
  });
  assert.equal((await handle(broken, env(db), NOW)).status, 400, "not UTF-8");
  assert.deepEqual(rows(db), []);
});

test("another page's browser may not send a line; a script that sets the page's Origin can — said in DESIGN", async () => {
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
  assert.equal((await handle(post(LINE), env(db), NOW)).status, 204, "Origin is a header a script sets: the limit, named");
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

test("past the ceiling a day counts no more and reads one row for it; the next day counts again", async () => {
  const db = d1();
  db.raw.prepare("INSERT INTO days VALUES ('2026-11-19', ?)").run(CEILING);
  assert.equal((await handle(post(LINE), env(db), NOW)).status, 429);
  assert.deepEqual(rows(db), []);
  assert.equal(total(db, "2026-11-19"), CEILING, "the total never passes the ceiling");
  assert.equal((await handle(post(LINE), env(db), new Date("2026-11-20T00:00:01Z"))).status, 204);
  assert.equal(total(db, "2026-11-20"), 1);
});

test("the day's total and its counts agree, line by line", async () => {
  const db = d1();
  for (const [i, c] of ["IL", "DE", "US", "IL"].entries()) await handle(post({ ...LINE, c, t: i % 2 }), env(db), NOW);
  const sum = rows(db).reduce((s, row) => s + row.n, 0);
  assert.equal(sum, 4);
  assert.equal(total(db, "2026-11-19"), 4);
});

test("a failure inside the count rolls the day's total back: the two never part", async () => {
  const db = d1();
  db.raw.exec("DROP TABLE counts");
  for (let i = 0; i < 3; i++) assert.equal((await handle(post(LINE), env(db), NOW)).status, 503);
  assert.equal(total(db, "2026-11-19"), 0, "no ceiling spent on lines never counted");
});

test("the base out of reach answers 503, and the page is told so with its CORS", async () => {
  const broken = { prepare() { throw new Error("D1_ERROR: daily limit"); } };
  const response = await handle(post(LINE), env(broken), NOW);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal((await handle(new Request(`https://counter.example/stats?key=${KEY}`), env(broken), NOW)).status, 503);
});

test("the day is the UTC date, whatever the hour", async () => {
  const db = d1();
  await handle(post(LINE), env(db), new Date("2026-11-19T00:00:00Z"));
  await handle(post(LINE), env(db), new Date("2026-11-19T23:59:59.999Z"));
  assert.deepEqual(rows(db).map((row) => [row.day, row.n]), [["2026-11-19", 2]]);
});

test("a key a link cannot carry as it is opens nothing; a hex key does", async () => {
  const db = d1();
  const plus = "abc+def/ghi" + "x".repeat(KEY_MIN);
  const ask = (key, secret) => handle(new Request(`https://counter.example/stats?key=${encodeURIComponent(key)}`), env(db, { STATS_KEY: secret }), NOW);
  assert.equal((await ask(plus, plus)).status, 403, "a key with + / # % is refused even when it matches");
  const hex = "0123456789abcdef".repeat(4);
  assert.equal((await ask(hex, hex)).status, 200, "openssl rand -hex 32 makes such a key");
});

test("the numbers need the owner's key, and a short key opens nothing", async () => {
  const db = d1();
  await handle(post(LINE), env(db), NOW);
  await handle(post({ ...LINE, e: "done" }), env(db), new Date("2026-11-21T10:00:00Z"));
  const ask = (query, extra) => handle(new Request(`https://counter.example/stats${query}`), env(db, extra), NOW);
  assert.equal((await ask("")).status, 403);
  assert.equal((await ask("?key=wrong")).status, 403);
  assert.equal((await ask(`?key=${KEY}x`)).status, 403);
  assert.equal((await ask("?key=", { STATS_KEY: "" })).status, 403, "no key set opens nothing");
  const short = "k".repeat(KEY_MIN - 1);
  assert.equal((await ask(`?key=${short}`, { STATS_KEY: short })).status, 403, "a key shorter than KEY_MIN opens nothing");
  assert.equal((await ask(`?key=${KEY}&since=yesterday`)).status, 400);
  const all = await ask(`?key=${KEY}`);
  assert.equal(all.status, 200);
  assert.equal(all.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await all.json()).map((row) => [row.day, row.event, row.n]), [["2026-11-19", "start", 1], ["2026-11-21", "done", 1]]);
  assert.deepEqual((await (await ask(`?key=${KEY}&since=2026-11-20`)).json()).map((row) => row.day), ["2026-11-21"]);
});

test("languages come from the list of ISO 639, not from the runtime: one code a language", () => {
  for (const l of ["bo", "ce", "cv", "ba", "ks", "sat", "dz", "iu", "kl", "nv", "se", "kw", "os"]) {
    assert.ok(parse(JSON.stringify({ ...LINE, l })), `${l} — missing from Cloudflare's Intl data, kept here`);
  }
  for (const [given, kept] of [["iw", "he"], ["in", "id"], ["ji", "yi"], ["sh", "sr"], ["heb", "he"], ["rus", "ru"], ["deu", "de"], ["ger", "de"]]) {
    assert.equal(parse(JSON.stringify({ ...LINE, l: given })).language, kept, given);
  }
  assert.equal(parse(JSON.stringify({ ...LINE, l: "fil" })).language, "fil", "no two-letter code: three letters kept");
  for (const l of ["qq", "qzx", "xx", "zz"]) assert.equal(parse(JSON.stringify({ ...LINE, l })), null, l);
  for (const kept of ALIASES.values()) assert.ok(LANGUAGES.has(kept), kept);
  assert.equal(parse(JSON.stringify({ ...LINE, c: "XK" })), null, "a code outside ISO 3166-1 is not counted — said in README");
});

test("parse knows the engine's language codes and keeps their primary code; countries are ISO 3166-1", () => {
  for (const l of ["ru", "he", "pt-BR", "zh-Hant-TW", "fil", "uk", "de"]) assert.ok(parse(JSON.stringify({ ...LINE, l })), l);
  for (const l of ["r", "ruso", "pt_BR", "pt-", "-BR", "zh-Hant-TWX"]) assert.equal(parse(JSON.stringify({ ...LINE, l })), null, l);
  assert.equal(parse(JSON.stringify({ ...LINE, l: "zh-Hant-TW" })).language, "zh");
  assert.equal(COUNTRIES.size, 249);
  for (const c of ["IL", "DE", "US", "UA", "BR", "RU"]) assert.ok(COUNTRIES.has(c), c);
});

test("Workers Logs and traces stay off in the configuration, and the key is no part of it", () => {
  const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /\[observability\]\nenabled = false\n/);
  assert.match(config, /\[observability\.traces\]\nenabled = false\n/);
  assert.doesNotMatch(config, /enabled = true/);
  assert.doesNotMatch(config, /STATS_KEY\s*=/, "the key is a secret, never in the file");
});
