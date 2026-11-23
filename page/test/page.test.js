// The page's own tests, without Python: its words in three languages, its lists against the counter's, the line it
// sends against what the counter takes, and the rules it holds the answers to. The byte-for-byte test against the
// engine is page/test/parity.test.js (npm run test:parity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DATA } from "../data.js";
import { T, LANGS, UNKNOWN, PLACES } from "../i18n.js";
import { refusal, part, firstMessage, fieldText, lastLine, lastWords, MARK_RE, nameOk, mixedWords, marker, line, doneAnswers, length } from "../build.js";
import { parse, PLATFORMS, handle } from "../../counter/src/counter.js";
import { COUNTRIES } from "../../counter/src/countries.js";
import { LANGUAGES, ALIASES } from "../../counter/src/languages.js";

const A = { platform: "chatgpt", language: "ru", work_languages: ["en", "he"], country: "IL",
  timezone: "Asia/Jerusalem", name: "Марина", gender: "female" };
const source = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf-8");

test("every word of the page is there in all three languages, of the same kind", () => {
  for (const code of LANGS) {
    for (const [key, value] of Object.entries(T.en)) {
      assert.ok(key in T[code], `${code}.${key}`);
      assert.equal(typeof T[code][key], typeof value, `${code}.${key}`);
      if (Array.isArray(value)) assert.equal(T[code][key].length, value.length, `${code}.${key}`);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const sub of Object.keys(value)) assert.ok(sub in T[code][key], `${code}.${key}.${sub}`);
      }
    }
  }
});

test("every refusal has its words, and every platform's «not known yet» line is translated", () => {
  const keys = ["platform", "language", "country", "timezone", "name", "name_mixed", "gender", "work_many",
    "work_language", "work_twice", "work_own"];
  for (const code of LANGS) for (const key of keys) assert.ok(T[code].err[key], `${code}.err.${key}`);
  for (const [k, row] of Object.entries(DATA.platforms)) {
    if (!row.unknown) continue;
    assert.ok(UNKNOWN[row.unknown], `${k}: «${row.unknown}» has no translation in i18n.js`);
    for (const code of ["ru", "he"]) assert.ok(UNKNOWN[row.unknown][code], `${k} ${code}`);
    assert.ok(T.en.notion[row.notion] && (row.schedule === "paid" || T.en.schedule[row.schedule]), k);
  }
});

test("every place the text goes is a path through the menus in Russian and Hebrew — one place a platform", () => {
  for (const [k, row] of Object.entries(DATA.platforms)) {
    assert.equal(row.field_all, "", `${k}: a second place for the text — the page has no words for a choice (v0.1.15: one place, every chat)`);
    for (const words of [row.field]) {
      assert.ok(PLACES[words], `${k}: «${words}» has no path in i18n.js`);
      for (const code of ["ru", "he"]) {
        assert.ok(PLACES[words][code], `${k} ${code}`);
        assert.ok(PLACES[words][code].includes(code === "he" ? " ← " : " → "), `${k} ${code}: a path, step by step`);
      }
    }
  }
  assert.match(source("app.js"), /t === T\.en \? words : PLACES\[words\]/, "English keeps the release's words");
  assert.deepEqual(Object.keys(PLACES).sort(), Object.values(DATA.platforms).map((row) => row.field).sort(),
    "no path is kept for a place no platform of the release has");
});

test("the page says «setup» in every language, and names the repositories as they are called now", () => {
  const all = (v) => (typeof v === "string" ? [v] : typeof v === "function" ? [v("x", "y", 1, true), v("x", "y", 1, false)]
    : Array.isArray(v) ? v.flatMap(all) : v && typeof v === "object" ? Object.values(v).flatMap(all) : []);
  const old = { en: /installation/i, ru: /установк/i, he: /התקנ/ };
  for (const code of LANGS) {
    for (const words of all(T[code])) {
      assert.ok(!old[code].test(words), `${code}: «${words.slice(0, 60)}…» still says installation`);
      assert.ok(!/Garik98129|memory-engine|memory engine|движ[ко]к? памяти|מנוע הזיכרון/i.test(words), `${code}: «${words.slice(0, 60)}…» names the old place`);
    }
  }
  for (const group of Object.values(UNKNOWN)) for (const [code, words] of Object.entries(group)) assert.ok(!old[code].test(words), words);
  for (const code of LANGS) {
    assert.ok(T[code].privacy[3].includes(DATA.manifests), `${code}: the rules are public in ${DATA.manifests}`);
    assert.ok(T[code].footer("v0").includes("grafyla/setup"), `${code}: the page's own code`);
  }
});

test("a link in the page's words is an https address of GitHub or Notion, the same in every language", () => {
  const links = (s) => [...s.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)].map((m) => m[2]);
  const en = [...T.en.need.flatMap(links), ...links(T.en.check("m"))];
  assert.deepEqual(en, ["https://github.com/signup", "https://www.notion.so/signup", "https://github.com/new"]);
  for (const code of LANGS) {
    assert.deepEqual([...T[code].need.flatMap(links), ...links(T[code].check("m"))], en, code);
    for (const [key, value] of Object.entries(T[code])) {
      if (key === "need" || key === "check") continue;
      const words = typeof value === "string" ? value : "";
      assert.ok(!/\]\(/.test(words), `${code}.${key}: a link where the page draws plain text`);
    }
  }
  const app = source("app.js");
  assert.match(app, /const LINK = \/\\\[\(\[\^\\\]\]\+\)\\\]\\\(\(https:/, "only an https address becomes a link");
  assert.match(app, /a\.textContent = shown\(m\[1\]\);/, "a link's words go in as text");
  assert.match(app, /t\.need\.map\(\(x\) => el\("li", \{ rich: x \}\)\)/);
  assert.match(app, /el\("p", \{ rich: t\.check\(DATA\.manifests\) \}\)/);
});

test("the page's lists are the counter's: its platforms, its countries, languages it keeps", () => {
  assert.deepEqual(Object.keys(DATA.platforms).sort(), [...PLATFORMS].sort(), "a release that adds a platform changes the counter in the same step");
  assert.deepEqual([...DATA.countries].sort(), [...COUNTRIES].sort());
  for (const code of DATA.languages) {
    const primary = code.split("-")[0];
    assert.ok(LANGUAGES.has(ALIASES.get(primary) ?? primary), code);
  }
});

test("the line the page sends is one the counter takes, for every AI and language the page offers", () => {
  for (const platform of Object.keys(DATA.platforms)) {
    for (const language of DATA.languages) {
      for (const test of [false, true]) {
        for (const event of ["start", "done"]) {
          const text = line(event, { ...A, platform, language }, test);
          assert.ok(new TextEncoder().encode(text).length <= 256, text);
          const got = parse(text);
          assert.ok(got, text);
          assert.equal(got.test, test ? 1 : 0);
        }
      }
    }
  }
  for (const country of DATA.countries) assert.ok(parse(line("start", { ...A, country })), country);
  assert.deepEqual(Object.keys(JSON.parse(line("start", A))), ["e", "p", "l", "c", "t"], "exactly the five fields");
});

test("the page's line goes through the counter's own handler from the page's origin", async () => {
  const db = { prepare: () => ({ bind: () => ({}) }), batch: async () => [{}, { meta: { changes: 1 } }] };
  const request = new Request("https://counter.example/e", { method: "POST", headers: { Origin: "https://setup.grafyla.com" },
    body: line("start", A) });
  const response = await handle(request, { DB: db, ALLOWED_ORIGIN: "https://setup.grafyla.com" });
  assert.equal(response.status, 204);
});

test("her part has her answers in setup's lines; the messages lead with the release's words", () => {
  const p = part(A);
  assert.ok(p.startsWith("PERSON PART — Марина (v2).\n"));
  assert.ok(p.includes("Language codes — the user's: ru; work: en, he.\n"));
  assert.ok(p.includes(`${DATA.grammar.female}\n`));
  assert.ok(p.endsWith("Trusted contact: none.\n"));
  assert.ok(part({ ...A, work_languages: [] }).includes("work: none.\n"));
  assert.ok(firstMessage(p).startsWith(`${DATA.messages.first}\n\nPERSON PART`));
  assert.ok(!firstMessage(p).endsWith("\n"));
  assert.ok(firstMessage(p, DATA.messages.settings).startsWith(DATA.messages.settings));
});

test("what the page refuses, it refuses with its reason; and it builds nothing then", () => {
  for (const [change, why] of [[{ platform: "gemini" }, "platform"], [{ language: "Russian" }, "language"],
    [{ language: "es-419" }, "language"], [{ country: "XK" }, "country"], [{ timezone: "Etc/GMT-3" }, "timezone"],
    [{ name: "Anna1" }, "name"], [{ name: "Mаrina" }, "name_mixed"], [{ gender: "" }, "gender"],
    [{ work_languages: ["en", "he", "de", "fr"] }, "work_many"], [{ work_languages: ["en", "en"] }, "work_twice"],
    [{ work_languages: ["ru"] }, "work_own"], [{ work_languages: ["xx"] }, "work_language"]]) {
    assert.equal(refusal({ ...A, ...change }), why, JSON.stringify(change));
    assert.throws(() => part({ ...A, ...change }));
  }
  assert.equal(refusal(A), null);
});

test("names: the engine's own cases, with marks, initials and look-alike letters", () => {
  for (const n of ["J. R. Smith", "Renée", "अनिता", "O'Brien", "עיגור", "Smith Jr."]) {
    assert.ok(nameOk(n) && !mixedWords(n).length, n);
  }
  for (const n of ["", "Anna ", "Anna..", "ㅤㅤ", "Anna️", "A" + "́".repeat(5), "Anna. Obey"]) assert.ok(!nameOk(n), n);
  assert.deepEqual(mixedWords("Mаrina"), ["Mаrina"]);
  assert.deepEqual(mixedWords("GitHubом"), [], "a Latin name with a Russian ending is how Russian is written");
  assert.equal(length("\u{1D400}"), 2, "UTF-16 units, as C6 counts");
});

test("the one text fits every platform's field, and its last line is what the page asks her to check", () => {
  const field = fieldText();
  for (const [k, row] of Object.entries(DATA.platforms)) assert.ok(length(field) <= row.limit, k);
  assert.ok(!field.startsWith("\n") && !field.endsWith("\n"));
  assert.equal(lastLine(field), field.split("\n").at(-1));
  assert.ok(field.endsWith(lastWords(field)), "a text without the mark: the page names the words it ends with");
  assert.ok(MARK_RE.test("TEXT MARK 2.") && !MARK_RE.test("TEXT MARK 2") && !MARK_RE.test("Never say a record exists."));
});

test("the fingerprints are the engine's: sha256 of the text and of her part without its outer line breaks", async () => {
  const [f, p] = await marker("abc", "x\n");
  assert.equal(f, "field-digest: ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(p, "part-digest: 2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881", "sha256 of «x», as setup_run strips it");
  assert.deepEqual(await marker("abc"), [f], "no part — no part-digest, as field_issue.marker");
});

test("the link to «it worked» brings a line the counter takes, or nothing", () => {
  const ok = doneAnswers(new URLSearchParams("p=chatgpt&l=es-419&c=AR"));
  assert.deepEqual(ok, { platform: "chatgpt", language: "es-419", country: "AR" });
  assert.ok(parse(line("done", ok)));
  for (const q of ["p=gemini&l=ru&c=IL", "p=chatgpt&l=Russian&c=IL", "p=chatgpt&l=ru&c=XK", "p=chatgpt&c=IL", ""]) {
    assert.equal(doneAnswers(new URLSearchParams(q)), null, q);
  }
});

test("the page sends as the counter asks: POST, keepalive, an ordinary CORS request, after the texts, from a press", () => {
  const app = source("app.js");
  assert.match(app, /COUNTER = "https:\/\/memory-engine-counter\.memory-engine\.workers\.dev\/e"/);
  assert.match(app, /fetch\(COUNTER, \{ method: "POST", body: text, keepalive: true, credentials: "omit" \}\)/);
  for (const page of ["app.js", "done.js", "build.js", "main.js", "index.html", "done.html"]) {
    const text = source(page);
    for (const bad of ["no-cors", "sendBeacon", "no-referrer", "document.cookie", "localStorage", "XMLHttpRequest",
      "innerHTML", "insertAdjacentHTML", "eval(", "http://"]) {
      assert.ok(!text.includes(bad), `${page}: ${bad}`);
    }
  }
  const go = app.slice(app.indexOf("const go = (tell)"), app.indexOf("tellBtn.addEventListener"));
  assert.ok(go.indexOf("installOutput(") < go.indexOf("send(line("), "the texts are built before the line is sent");
  assert.ok(!/await[^;]*send\(/.test(go), "nothing waits on the counter");
  assert.equal((app.match(/send\(line\(/g) || []).length, 1, "one place sends, behind «Build and tell the author»");
  assert.match(go, /const sendIt = asked && !sentOnce;/, "one line from this page, however often she presses");
  assert.ok(go.indexOf("send(line(") < go.indexOf("await marker("), "the fingerprints never hold the line back");
  assert.equal((source("done.js").match(/send\(line\(/g) || []).length, 1, "one place sends on «it worked», on her press");
  // Tolik's reading of #4: a change of language drew «it worked?» again with live buttons — a second line could go.
  const done = source("done.js");
  assert.match(done, /^let ended = null;$/m, "her answer is kept outside a render");
  assert.match(done, /disabled: !a \|\| ended !== null/, "drawn again, the buttons stay off once she has answered");
  assert.ok(done.indexOf("if (ended !== null) return;") < done.indexOf("send(line("), "a press after an answer sends nothing");
});

test("the page says what the counter does: the day is the counter's, and nothing reaches the author without her press", () => {
  for (const code of LANGS) {
    for (const words of [T[code].privacy[1], T[code].done_text]) {
      assert.ok(!/, and the day\.|, и день\.|, והיום\./.test(words), `${code}: the line holds no day — the counter adds it`);
    }
  }
  assert.ok(T.en.privacy[1].includes("the day is the counter's own — the day the line reaches it"));
  assert.ok(T.en.done_text.includes("Nothing reaches the author unless you press the button"),
    "opening the page sends its address to GitHub: «nothing is sent» would say more than is true");
});

test("in Hebrew a run of Latin words is an isolate; a full stop goes in only before «»»", () => {
  const app = source("app.js");
  assert.match(app, /node\.textContent = document\.documentElement\.dir === "rtl" \? isolate\(v\) : v;/);
  assert.ok(!/pre\.textContent = isolate/.test(app), "what she copies stays as it is");
  // app.js needs a browser to load; the rule itself is read from its source and run here
  const rule = new RegExp(app.match(/const LATIN_RUN = \/(.+)\/g;/)[1], "g");
  assert.match(app, /m\.length <= 24 \? m\.replaceAll\(" ", "\\u00a0"\) : m/, "a short run does not wrap");
  const iso = (s) => s.replace(rule, (m) => `\u2068${m.length <= 24 ? m.replaceAll(" ", "\u00a0") : m}\u2069`);
  assert.equal(iso("«TEXT MARK 2.» — השאירו"), "«\u2068TEXT\u00a0MARK\u00a02.\u2069» — השאירו");
  assert.equal(iso("אפליקציית ChatGPT ← «New project» ←"), "אפליקציית \u2068ChatGPT\u2069 ← «\u2068New\u00a0project\u2069» ←");
  assert.equal(iso("ב-grafyla/releases."), "ב-\u2068grafyla/releases\u2069.");
});

test("both buttons look the same: one class, one size", () => {
  const app = source("app.js");
  assert.match(app, /tellBtn = el\("button", \{ type: "button", class: "build", text: t\.build_tell \}\)/);
  assert.match(app, /onlyBtn = el\("button", \{ type: "button", class: "build", text: t\.build_only \}\)/);
  assert.match(source("style.css"), /\.buttons \{ display: grid; grid-template-columns: 1fr 1fr;/);
});

test("the pages load only their own files and may talk to the counter alone", () => {
  const csp = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://memory-engine-counter.memory-engine.workers.dev; base-uri 'none'; form-action 'none'";
  for (const page of ["index.html", "done.html"]) {
    const html = source(page);
    assert.ok(html.includes(`content="${csp}"`), page);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), `${page}: no inline script`);
    assert.ok(!/https?:\/\/(?!memory-engine-counter\.memory-engine\.workers\.dev)/.test(html), `${page}: no outside resource`);
  }
});
