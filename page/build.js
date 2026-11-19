// What the installation page builds from her answers — the user's part, the first message, the one text — as the
// engine's `setup.build` and `setup.first_message` do (memory-engine, engine/setup/setup.py; docs/DESIGN_PHASE3.md
// §5a). A second implementation of those rules, in another language: page/test/parity.py holds it to the
// first, byte for byte, on a set of answers. Pure: no page, no network — the page (app.js) and the tests import it.

import { DATA } from "./data.js";

const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;           // engine/checks/config_check.py
const COUNTRY_RE = /^[A-Z]{2}$/;

function inRanges(cp, table) {
  let lo = 0;
  let hi = table.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < table[mid][0]) hi = mid - 1;
    else if (cp > table[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}

// UTF-16 units, as C6 counts a field (limits_check.length): a JS string's own length.
export const length = (text) => text.length;

// setup.name_ok: letters with their marks, in words joined by one space, ' . or -; a full stop after one or
// two letters only; no digit, quote, line break, invisible mark or letter; at most five words.
export function nameOk(name, d = DATA) {
  const U = d.unicode;
  const L = d.limits;
  const invisibleLetters = new Set(d.invisible.letters);
  let prev = "";
  let marks = 0;
  let run = 0;
  let words = 0;
  for (const ch of name) {
    const cp = ch.codePointAt(0);
    if (inRanges(cp, U.letters)) {
      if (invisibleLetters.has(cp)) return false;
      if (prev === "" || prev === " " || prev === ".") words += 1;
      prev = "L";
      marks = 0;
      run += 1;
    } else if (inRanges(cp, U.marks)) {
      marks += 1;
      if (prev !== "L" || marks > L.marks || d.invisible.marks.some(([lo, hi]) => lo <= cp && cp <= hi)) return false;
    } else if (" '.-".includes(ch) && (prev === "L" || (prev === "." && ch === " "))) {
      if (ch === "." && run > L.stop_after) return false;
      prev = ch;
      run = 0;
    } else {
      return false;
    }
  }
  return (prev === "L" || prev === ".") && words <= L.words;
}

// C5's text_check.mixed_words: a word that mixes Latin and Cyrillic letters — but a Latin name of two or more
// letters with a Russian ending of up to three («GitHubом»).
export function mixedWords(line, d = DATA) {
  const U = d.unicode;
  const script = (cp) => (inRanges(cp, U.latin) ? "latin" : inRanges(cp, U.cyrillic) ? "cyrillic" : null);
  const words = [];
  let word = [];
  for (const ch of line) {
    if (inRanges(ch.codePointAt(0), U.word)) word.push(ch);
    else if (word.length) {
      words.push(word);
      word = [];
    }
  }
  if (word.length) words.push(word);
  return words
    .filter((chars) => {
      const runs = [];
      for (const ch of chars) {
        const s = script(ch.codePointAt(0));
        if (s && (!runs.length || runs[runs.length - 1] !== s)) runs.push(s);
      }
      if (runs.length < 2) return false;
      if (runs.length === 2 && runs[0] === "latin" && runs[1] === "cyrillic") {
        const latin = chars.filter((ch) => script(ch.codePointAt(0)) === "latin").length;
        const cyrillic = chars.filter((ch) => script(ch.codePointAt(0)) === "cyrillic").length;
        return latin < 2 || cyrillic > 3;
      }
      return true;
    })
    .map((chars) => chars.join(""));
}

// setup._check, in its order: the first answer it would refuse, as a key the page words in her language;
// null when it takes them all. The page offers its lists alone, so most of these never fire from it — they
// hold an answer that came in some other way (a link, a hand-edited page) to what setup takes.
export function refusal(a, d = DATA) {
  const row = d.platforms[a.platform];
  if (!row) return "platform";
  if (a.language.length > d.limits.language || !LANGUAGE_RE.test(a.language) || !d.languages.includes(a.language)) return "language";
  if (!COUNTRY_RE.test(a.country) || !d.countries.includes(a.country)) return "country";
  if (!a.timezone.includes("/") || a.timezone.length > d.limits.timezone || !d.timezones.includes(a.timezone)) return "timezone";
  if (length(a.name) > d.limits.name || !nameOk(a.name, d)) return "name";
  if (mixedWords(a.name, d).length) return "name_mixed";
  if (!d.genders.includes(a.gender)) return "gender";
  const work = a.work_languages;
  if (work.length > d.limits.work_languages) return "work_many";
  for (const lang of work) {
    if (lang.length > d.limits.language || !LANGUAGE_RE.test(lang) || !d.languages.includes(lang)) return "work_language";
  }
  if (new Set(work).size < work.length) return "work_twice";
  if (work.includes(a.language)) return "work_own";
  return null;
}

// setup.build's user's part, line for line. The release's own lines are in data.js; the shape of the part is
// here, so a release that changes it changes this file in the same step — page/test/parity.py fails until it does.
export function part(a, d = DATA) {
  const why = refusal(a, d);
  if (why) throw new Error(`refused: ${why}`);
  const row = d.platforms[a.platform];
  return (
    `PERSON PART — ${a.name} (v2).\n` +
    `The user's name: ${a.name}; address the user as the map's «How we talk» says. ${d.grammar[a.gender]}\n` +
    `Language codes — the user's: ${a.language}; work: ${a.work_languages.join(", ") || "none"}.\n` +
    `The user's time zone: ${a.timezone}.\n` +
    `The user's country: ${a.country}. Its emergency number — name it from what you know; not sure → ` +
    "«call your local emergency number».\n" +
    `The user's Notion: the map, the page titled «… · ${d.map_key}» (NOTION-10, 11).\n` +
    `${row.works}\n` +
    "Trusted contact: none.\n"
  );
}

const stripNewlines = (text) => text.replace(/^\n+/, "").replace(/\n+$/, "");

// setup.first_message: the lead, an empty line, the user's part.
export function firstMessage(partText, lead = DATA.messages.first) {
  return `${lead}\n\n${stripNewlines(partText)}`;
}

// setup.field_text: the one text she pastes, as the release holds it, without its outer line breaks.
export function fieldText(d = DATA) {
  return stripNewlines(d.fixed);
}

export const lastLine = (field) => field.slice(field.lastIndexOf("\n") + 1);

// field_issue.marker: the fingerprints of what a page hands over, as every Issue of the full way keeps them.
export async function digest(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function marker(field, partText = "") {
  return [`field-digest: ${await digest(field)}`, ...(partText ? [`part-digest: ${await digest(partText)}`] : [])];
}

// The counter's line (counter/README.md, «What it takes»): the event, her AI, her language, her country as she
// answered them, and a mark for a test run. Nothing else.
export function line(event, a, test = false) {
  return JSON.stringify({ e: event, p: a.platform, l: a.language, c: a.country, t: test ? 1 : 0 });
}

// What the link to the page «it worked» brings — done.html?p=chatgpt&l=ru&c=IL —, or null when it is no line the
// counter would take. Her AI writes the link from the map, so her language may be any code setup takes; the counter
// keeps it by its primary code and checks it again itself (counter/src/counter.js).
export function doneAnswers(params, d = DATA) {
  const a = { platform: params.get("p") || "", language: params.get("l") || "", country: params.get("c") || "" };
  const ok = Object.hasOwn(d.platforms, a.platform) && a.language.length <= d.limits.language
    && LANGUAGE_RE.test(a.language) && d.countries.includes(a.country);
  return ok ? a : null;
}
