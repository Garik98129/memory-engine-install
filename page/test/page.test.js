// The page's own tests, without Python: its words in three languages, its lists against the counter's, the line it
// sends against what the counter takes, and the rules it holds the answers to. The byte-for-byte test against the
// engine is page/test/parity.test.js (npm run test:parity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DATA } from "../data.js";
import { T, LANGS, PLACES } from "../i18n.js";
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

test("every refusal has its words", () => {
  const keys = ["platform", "language", "country", "timezone", "name", "name_mixed", "gender", "work_many",
    "work_language", "work_twice", "work_own"];
  for (const code of LANGS) for (const key of keys) assert.ok(T[code].err[key], `${code}.err.${key}`);
});

test("every place the text goes is a path through the menus in Russian and Hebrew — one place a platform", () => {
  for (const [k, row] of Object.entries(DATA.platforms)) {
    assert.equal(row.field_all, "", `${k}: a second place for the text — the page has no words for a choice (v0.1.15: one place, every chat)`);
    for (const words of [row.field]) {
      assert.ok(PLACES[words], `${k}: «${words}» has no path in i18n.js`);
      for (const code of LANGS) {
        assert.ok(PLACES[words][code], `${k} ${code}`);
        assert.ok(PLACES[words][code].includes(code === "he" ? " ← " : " → "), `${k} ${code}: a path, step by step`);
      }
    }
  }
  assert.match(source("app.js"), /const place = \(words\) => PLACES\[words\]\?\.\[langOf\(t\)\] \|\| words;/,
    "every language goes by the menus, English too");
  assert.deepEqual(Object.keys(PLACES).sort(), Object.values(DATA.platforms).map((row) => row.field).sort(),
    "no path is kept for a place no platform of the release has");
});

// Every string the page can show from a group of its words: plain ones, the two shapes a sentence built from values
// takes, lists and groups.
const all = (v) => (typeof v === "string" ? [v] : typeof v === "function" ? [v("x", "y", 1, true), v("x", "y", 1, false)]
  : Array.isArray(v) ? v.flatMap(all) : v && typeof v === "object" ? Object.values(v).flatMap(all) : []);

test("the page says «setup» in every language, and names the repositories as they are called now", () => {
  // «install» in any form, but in the one sentence that means it: there is nothing to download or install
  const old = { en: /install/i, ru: /установ/i, he: /התקנ|להתקין/ };
  const meant = { en: "nothing to download or install", ru: "", he: "לא צריך להוריד או להתקין" };
  const project = { en: /project/i, ru: /проект/i, he: /פרויקט/ };
  for (const code of LANGS) {
    assert.ok(!meant[code] || T[code].intro.includes(meant[code]), `${code}: the sentence set aside is the intro's`);
    const shown = [...all(T[code]), ...Object.values(PLACES).map((g) => g[code] || "")];
    for (const words of shown) {
      const rest = meant[code] ? words.replace(meant[code], "") : words;
      assert.ok(!old[code].test(rest), `${code}: «${words.slice(0, 60)}…» still says installation`);
      assert.ok(!project[code].test(words), `${code}: «${words.slice(0, 60)}…» names a project — the text has one place, the field for every chat`);
      assert.ok(!/Garik98129|memory-engine|memory engine|движ[ко]к? памяти|מנוע הזיכרון/i.test(words), `${code}: «${words.slice(0, 60)}…» names the old place`);
    }
    assert.ok(T[code].footer("v0.0.0").includes("v0.0.0") && !T[code].footer("v0.0.0").includes("grafyla/setup"), `${code}: the footer names the release only`);
  }
  for (const page of ["index.html", "done.html"]) assert.ok(!/<title>[^<]*install/i.test(source(page)), page);
});

const LINK_IN_WORDS = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

test("a link in the page's words is an https address of GitHub or Notion, the same in every language, and only where the page draws links", () => {
  const links = (s) => [...s.matchAll(LINK_IN_WORDS)].map((m) => m[2]);
  const en = [...T.en.need.flatMap(links), ...links(T.en.check("m"))];
  assert.deepEqual(en, ["https://github.com/signup", "https://www.notion.so/signup"]);
  // No «create an empty repository» link: the owner, 25.11.2026 — it confused more than it helped.
  for (const code of LANGS) assert.ok(!T[code].check("m").includes("github.com/new"), code);
  for (const code of LANGS) {
    assert.deepEqual([...T[code].need.flatMap(links), ...links(T[code].check("m"))], en, code);
    const { need, check, ...plain } = T[code];
    for (const words of [...all(plain), ...Object.values(PLACES).map((g) => g[code] || "")]) {
      assert.ok(!/\]\(/.test(words), `${code}: «${words.slice(0, 60)}…» has a link where the page draws plain text`);
    }
  }
  const app = source("app.js");
  assert.match(app, /t\.need\.map\(\(x\) => el\("li", \{ rich: x \}\)\)/);
  assert.match(app, /el\("p", \{ rich: t\.check\(DATA\.manifests\) \}\)/);
  assert.equal((app.match(/\brich: /g) || []).length, 2, "two places draw links: the list «Before you start» and the check of the connections");
});

test("a link is drawn as its words and an https address; everything else stays text, and nothing is dropped", async () => {
  // app.js needs a browser to load: the two things it reads at once are stood in for, and `rich` is run as it is
  globalThis.location ??= { search: "" };
  const doc = { documentElement: { dir: "ltr" }, createElement: (tag) => ({ tag }) };
  globalThis.document = doc;
  const { rich } = await import("../app.js");
  const text = (pieces) => pieces.map((x) => (typeof x === "string" ? x : x.textContent)).join("");
  const got = rich("a [x y](https://e.example/p?a=1&b=2) b");
  assert.deepEqual(got, ["a ", { tag: "a", href: "https://e.example/p?a=1&b=2", rel: "noopener noreferrer", target: "_blank", textContent: "x y" }, " b"]);
  for (const words of ["[x](javascript:alert(1))", "[x](http://e.example/)", "[x](data:text/html,x)", "<b>bold</b> <a href=x>y</a>", "[x] (https://e.example/)"]) {
    assert.deepEqual(rich(words), [words], `«${words}» stays text`);
  }
  assert.deepEqual(rich("[x](https://e.example/)"), [{ tag: "a", href: "https://e.example/", rel: "noopener noreferrer", target: "_blank", textContent: "x" }]);
  assert.deepEqual(rich(""), []);
  const bare = (s) => s.replace(/[⁨⁩]/g, "").replaceAll(" ", " ");
  for (const code of LANGS) {
    doc.documentElement.dir = code === "he" ? "rtl" : "ltr";
    for (const words of [...T[code].need, T[code].check(DATA.manifests)]) {
      const pieces = rich(words);
      assert.equal(bare(text(pieces)), words.replace(LINK_IN_WORDS, "$1"), `${code}: every word is drawn, before, between and after the links`);
      for (const x of pieces) if (typeof x !== "string") assert.match(x.href, /^https:\/\/(github\.com|www\.notion\.so)\//, `${code}: ${x.href}`);
    }
  }
  doc.documentElement.dir = "rtl";
  const [before, link, after] = rich("ל-GitHub [להירשם ל-GitHub](https://github.com/signup) כאן");
  assert.equal(before, "ל-⁨GitHub⁩ ");
  assert.equal(link.textContent, "להירשם ל-⁨GitHub⁩", "a link's words are isolated by themselves");
  assert.equal(link.href, "https://github.com/signup", "an address is never taken for words");
  assert.equal(after, " כאן");
  doc.documentElement.dir = "ltr";
});

// Not the Issue's order on purpose (the owner's word, 26.11.2026): once she has copied a text she goes to her AI and may
// not come back, so whatever she is to read comes before the box it is about, and nothing comes after the last box.
test("the page shows what she gets with nothing after the last box: the two texts, the check, the instructions, the first message", () => {
  const app = source("app.js");
  const out = app.slice(app.indexOf("function installOutput("), app.indexOf("function settingsOutput("));
  const order = ["t.out_h", "t.two_texts", "t.english", "t.check_h",
    "t.check(DATA.manifests)", "t.step1_h", "`${t.step1} ${where}`", "t.paste(", "copyBox(field, t)", "t.step2_h", "t.after }",
    "t.old }", "t.box2 }", "t.step2 }", "copyBox(firstMessage(p), t)"];
  let at = out.indexOf("return [");
  for (const piece of order) {
    const next = out.indexOf(piece, at);
    assert.ok(next > at, `«${piece}» is not there, or not after the piece before it`);
    at = next;
  }
  const end = out.indexOf("];", at);
  assert.equal(out.slice(at + "copyBox(firstMessage(p), t)".length, end).replace(/[\s,]/g, ""), "",
    "nothing after the first message's box: she may not come back to read it");
});

// What the page says of the text of step 1 is said where that text is still below, in every language.
// The owner, 26.11.2026: the plan once, under «Before you start»; no «Later»; the texts' English said once, in the
// reader's language — an English page says nothing of it.
test("after «Build»: no plan, no «Later», and one line on the texts being English — not on the English page", () => {
  for (const code of LANGS) for (const key of ["need_plan", "later", "later_h"]) assert.ok(!(key in T[code]), `${code}.${key}`);
  assert.equal(T.en.english, "");
  assert.ok(T.ru.english.includes("на английском") && T.ru.english.includes("на вашем языке"));
  assert.ok(T.he.english.includes("באנגלית") && T.he.english.includes("בשפה שלכם"));
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
  assert.ok(p.startsWith("PERSON PART — Марина (v3).\n"));
  assert.ok(p.includes("; no map read, or no form of address chosen there → the formal «you» where the user's " +
    "language has one. "));
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
  for (const [k, row] of Object.entries(DATA.platforms)) {
    assert.ok(length(fieldText(DATA, k)) <= row.limit, k);
    assert.equal(lastLine(fieldText(DATA, k)), lastLine(field), `${k}: the mark stays the last line`);
    assert.equal(fieldText(DATA, k).includes(DATA.addendum.trim().split("\n")[0]), row.addendum === true,
      `${k}: the addendum where the row asks for it, and nowhere else`);
  }
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
  assert.equal((app.match(/send\(line\(/g) || []).length, 1, "one place sends, behind «Build and tell Grafyla's creator»");
  assert.match(go, /const sendIt = asked && !sentOnce;/, "one line from this page, however often she presses");
  assert.ok(go.indexOf("send(line(") < go.indexOf("await marker("), "the fingerprints never hold the line back");
  assert.equal((source("done.js").match(/send\(line\(/g) || []).length, 1, "one place sends on «it worked», on her press");
  // Tolik's reading of #4: a change of language drew «it worked?» again with live buttons — a second line could go.
  const done = source("done.js");
  assert.match(done, /^let ended = null;$/m, "her answer is kept outside a render");
  assert.match(done, /disabled: !a \|\| ended !== null/, "drawn again, the buttons stay off once she has answered");
  assert.ok(done.indexOf("if (ended !== null) return;") < done.indexOf("send(line("), "a press after an answer sends nothing");
});

// What is seen by whom is the site's now (the owner's word, 26.11.2026); the page keeps, beside each button that
// sends, what that one line holds — and no more than is true.
test("the page says what the line holds beside each button that sends it, and nothing reaches the creator without her press", () => {
  const holds = { en: "your AI, your language and your country, with no name", ru: "ваш ИИ, язык и стран", he: "ה-AI, השפה והמדינה שלכם, בלי שם" };
  for (const code of LANGS) {
    for (const words of [T[code].buttons_note, T[code].done_text]) {
      assert.ok(words.includes(holds[code]), `${code}: «${words.slice(0, 60)}…» does not say what the line holds`);
      assert.ok(!/, and the day\.|, и день\.|, והיום\./.test(words), `${code}: the line holds no day — the counter adds it`);
    }
  }
  assert.ok(T.ru.buttons_note.includes("без имени") && T.ru.done_text.includes("без имени"), "ru: with no name");
  assert.ok(T.en.done_text.includes("Nothing reaches the creator unless you press the button"),
    "opening the page sends its address to GitHub: «nothing is sent» would say more than is true");
});

// What the cut must not lose (Tolik's note on #13): the words a setup needs, held by their words, not by the call.
test("the words a setup needs stay: not back into the field, the last line, Notion not seen, how long, stop and resume, old instructions", () => {
  const need = {
    en: { paste: ["Do not put them back into the instructions field you copied them from", "Check that its last line came in too", "keep it"],
          after: ["If it says it cannot see your Notion, check the connection and send the same message again", "send your AI the same first message again — it will not ask what you have already answered", "about 20–30 minutes", "you can skip each one"],
          old: ["My old instructions"] },
    ru: { paste: ["Не возвращайте их в поле инструкций, откуда скопировали", "Проверьте, что вошла и его последняя строка", "не удаляйте её"],
          after: ["не видит ваш Notion, проверьте подключение и отправьте то же сообщение снова", "отправьте ИИ то же первое сообщение ещё раз — уже отвеченное он не спросит", "примерно 20–30 минут", "каждый можно пропустить"],
          old: ["Мои старые инструкции"] },
    he: { paste: ["אל תחזירו אותן לשדה ההוראות שממנו העתקתם", "בדקו שגם השורה האחרונה שלו נכנסה", "השאירו אותה"],
          after: ["לא רואה את ה-Notion שלכם, בדקו את החיבור ושלחו שוב את אותה הודעה", "שלחו ל-AI שוב את אותה הודעה ראשונה", "בערך 20–30 דקות", "אפשר לדלג על כל אחת"],
          old: ["ההוראות הישנות שלי"] },
  };
  for (const code of LANGS) {
    const shown = { paste: T[code].paste("LAST", "WORDS", 1, true), after: T[code].after, old: T[code].old };
    for (const [key, words] of Object.entries(need[code])) {
      for (const w of words) assert.ok(shown[key].includes(w), `${code}.${key}: «${w}» is gone`);
    }
    assert.ok(shown.paste.includes("«LAST»"), `${code}: the last line itself is quoted`);
    // What the first message holds, said before its box, in the owner's words of 26.11.2026: its service lines name extra
    // features not in use now — and no «off» or «none» quoted.
    const box2 = { en: ["service lines", "not in use now"], ru: ["служебных строк", "сейчас не используются"], he: ["שורות שירות", "לא בשימוש כרגע"] };
    for (const w of box2[code]) assert.ok(T[code].box2.includes(w), `${code}: «${w}»`);
    assert.ok(!/«off»|«none»/.test(T[code].box2), `${code}: no «off» or «none» quoted`);
    assert.ok(T[code].paste("LAST", "WORDS", 1, false).includes("«WORDS»"), `${code}: a text without its mark — its last words`);
  }
});

// The menu names the AI only (the owner's word, 26.11.2026); the minimum plan is said once, under «Before you start».
// Which platform is in beta, and what is not known yet, is the site's (the owner's word, 26.11.2026): the page is
// written once for every platform.
test("the AI menu shows the AI's name only, the page says nothing of beta; «Before you start» names each one's minimum plan", () => {
  const app = source("app.js");
  assert.ok(!/row\.(unknown|status)/.test(app), "the page reads no platform's beta status or «not known yet»");
  assert.match(app, /select\("platform", Object\.entries\(DATA\.platforms\)\.map\(\(\[k, row\]\) => \[k, row\.title\]\), "—"\)/);
  for (const code of LANGS) {
    assert.ok(!("plan" in T[code]) && !("beta" in T[code]) && !("unknown" in T[code]), `${code}: no plan, beta or «not known yet» words`);
    for (const words of all(T[code])) assert.ok(!/\bbeta\b|бет[аеуы]|בטא/i.test(words), `${code}: «${words.slice(0, 60)}…» speaks of beta`);
    for (const row of Object.values(DATA.platforms)) {
      assert.ok(T[code].need[0].includes(row.title) && T[code].need[0].includes(row.plan), `${code}: «${row.title}» and its ${row.plan} in «Before you start»`);
    }
  }
});

// Where the text goes, for every AI (the owner's word, 26.11.2026): the field for standing instructions, not a chat,
// and saved — by «Save» or the ✓ at the top; the path for the chosen AI is a hint under it.
test("step 1 says, for every AI: the instructions field, not a chat, and save — with «Save» or the ✓", () => {
  const notChat = { en: "not into a chat", ru: "не в чат", he: "לא בצ'אט" };
  const save = { en: ["be sure to save", "✓"], ru: ["обязательно сохраните", "✓"], he: ["והקפידו לשמור", "✓"] };
  for (const code of LANGS) {
    assert.ok(T[code].step1.includes(notChat[code]), `${code}: not a chat`);
    for (const w of save[code]) assert.ok(T[code].paste("L", "W", 1, true).includes(w), `${code}: «${w}»`);
  }
  const claude = PLACES["Claude: Settings, Your Claude, Instructions"];
  assert.ok(claude.ru.includes("«Профиль» → «Инструкции»") && claude.ru.includes("✓"), "Claude, ru: the owner's screens");
  assert.ok(claude.en.includes("Profile → Instructions") && claude.en.includes("✓"), "Claude, en: the same steps");
  assert.ok(claude.he.includes("הפרופיל ← ההוראות") && claude.he.includes("✓"), "Claude, he: the same steps");
  // ChatGPT — the owner's screen and words of 26.11.2026: scroll down «Персонализация» to «Пользовательские инструкции»,
  // then «Редактировать» by «ChatGPT»; no word of the row beside it.
  const chatgpt = PLACES["chatgpt.com in your browser: the menu under your name, Personalization"];
  assert.ok(chatgpt.ru.includes("пролистайте вниз до «Пользовательские инструкции» → у «ChatGPT» нажмите «Редактировать»"), "ChatGPT, ru");
  assert.ok(chatgpt.en.includes("scroll down to «Custom instructions» → by «ChatGPT», tap «Edit»"), "ChatGPT, en");
  assert.ok(chatgpt.he.includes("גללו למטה עד «Custom instructions» ← ליד «ChatGPT» לחצו «Edit»"), "ChatGPT, he");
  for (const code of LANGS) assert.ok(!chatgpt[code].includes("Codex"), `ChatGPT, ${code}: no word of Codex`);
  // Grok — the owner's screens of the iPhone app, 26.11.2026: every AI is saved, by «Save» or the ✓.
  const grok = PLACES["Grok app: the instructions field"];
  assert.ok(grok.ru.includes("«Персонализировать Grok» → «Инструкции»") && grok.ru.includes("✓"), "Grok, ru: the owner's screens");
  assert.ok(grok.en.includes("Personalize Grok → Instructions") && grok.en.includes("✓"), "Grok, en: the same steps");
  assert.ok(grok.he.includes("התאמה אישית של Grok ← ההוראות") && grok.he.includes("✓"), "Grok, he: the same steps");
  for (const [words, path] of Object.entries(PLACES)) {
    for (const code of LANGS) assert.ok(/Save|Сохранить|✓/.test(path[code]), `${words}, ${code}: the path ends with saving`);
  }
  const lead = { en: "Where it is: ", ru: "Где это поле: ", he: "איפה השדה: " };
  for (const code of LANGS) assert.ok(T[code].where_one("X").startsWith(lead[code]), `${code}: the path is a hint`);
  // The line that the texts are English: in Russian and Hebrew only, and drawn only when there is one.
  assert.match(source("app.js"), /t\.english \? el\("p", \{ text: t\.english \}\) : null/);
});

// The page is for a setup, not for how the system works (the owner's word, 26.11.2026): no word of IP addresses,
// Cloudflare, cookies or the e-mail a user dictates, and no section of what the page does and does not.
test("the page says nothing a setup does not need: no IP, Cloudflare, cookies or dictated e-mail", () => {
  const away = (words) => /\bIP\b/.test(words) || /cloudflare|cookie|dictat|диктуе|מכתיב|עוגיות/i.test(words);
  for (const code of LANGS) {
    for (const words of all(T[code])) assert.ok(!away(words), `${code}: «${words.slice(0, 70)}…»`);
    assert.ok(!("privacy" in T[code]) && !("privacy_h" in T[code]), `${code}: no section of what the page does`);
  }
  assert.ok(!/t\.privacy/.test(source("app.js")), "the page draws no such section");
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
