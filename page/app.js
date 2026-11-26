// The setup page in the browser (the engine's docs/DESIGN_PHASE3.md §5a). It builds the texts from her answers
// with build.js and shows them; it sends one line to the counter only when she presses «Build and tell Grafyla's creator»,
// after the texts are built, and never waits on the answer (counter/README.md, «What the page must do»).

import { DATA } from "./data.js";
import { T, LANGS, RTL, PLACES } from "./i18n.js";
import { refusal, part, firstMessage, fieldText, lastLine, lastWords, MARK_RE, length, marker, line } from "./build.js";

export const COUNTER = "https://memory-engine-counter.memory-engine.workers.dev/e";

const params = new URLSearchParams(location.search);
// ?test=1 marks a run as a test — the owner's own runs carry it; anyone can set it — and the counter counts it apart.
export const TEST = params.get("test") === "1";
let sentOnce = false;            // one line from this page, however often she presses

export function uiLanguage() {
  const asked = params.get("lang");
  if (LANGS.includes(asked)) return asked;
  const browser = (navigator.language || "en").toLowerCase();
  if (browser.startsWith("he") || browser.startsWith("iw")) return "he";
  if (browser.startsWith("ru")) return "ru";
  return "en";
}

// In a right-to-left page a run of Latin words — a button's name, «ChatGPT», «TEXT MARK 2.» — is set apart as
// an isolate (FSI … PDI), so the browser keeps its quotes and arrows where the sentence has them; without it a path
// such as «New project» ← «Project settings» came out jumbled (seen in a phone-sized render, 19.11.2026). A full stop
// goes inside only before a closing «»», where it belongs to the words quoted; a short run keeps its spaces unbroken,
// for a line that wraps inside it turns it round («TEXT» on one line, «MARK 2.» on the next). What she copies is set
// apart from this: a copy box holds its text as it is.
const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9 ,:/_.-]*[A-Za-z0-9])?(?:\.(?=»))?/g;
export const isolate = (s) => s.replace(LATIN_RUN, (m) => `\u2068${m.length <= 24 ? m.replaceAll(" ", "\u00a0") : m}\u2069`);

// A sentence of the page's own words with a link in it — «[Sign up for GitHub](https://github.com/signup)» — as text
// and links: the words go in as text, never as markup, and a link opens only an https address the page's own words
// name (i18n.js). In a right-to-left page each piece is isolated by itself, so an address is never taken for words.
const LINK = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;
export function rich(text) {
  const shown = (s) => (document.documentElement.dir === "rtl" ? isolate(s) : s);
  const out = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > at) out.push(shown(text.slice(at, m.index)));
    const a = document.createElement("a");
    a.href = m[2];
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    a.textContent = shown(m[1]);
    out.push(a);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(shown(text.slice(at)));
  return out;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = document.documentElement.dir === "rtl" ? isolate(v) : v;
    else if (k === "rich") node.append(...rich(v));
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) if (child) node.append(child);
  return node;
}

export function languageSwitch(current, onPick) {
  return el("nav", { class: "langs" }, LANGS.map((code) =>
    el("button", { type: "button", lang: code, "aria-pressed": String(code === current), text: T[code].lang_name,
      onclick: () => onPick(code) })));
}

export function setDirection(code) {
  document.documentElement.lang = code;
  document.documentElement.dir = RTL.has(code) ? "rtl" : "ltr";
}

// Sends the counter's one line — only from a press of hers. keepalive lets it go while the page changes; an
// ordinary CORS request, so the browser sends the page's Origin; nothing waits on the answer.
export function send(text) {
  try {
    fetch(COUNTER, { method: "POST", body: text, keepalive: true, credentials: "omit" }).catch(() => {});
  } catch {
    // a browser that cannot send changes nothing for her
  }
}

function copyBox(text, t) {
  const pre = el("pre", { dir: "ltr", lang: "en", tabindex: "0" });
  pre.textContent = text;
  const button = el("button", { type: "button", class: "copy", text: t.copy });
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("copy");
    }
    button.textContent = t.copied;
    setTimeout(() => { button.textContent = t.copy; }, 2000);
  });
  return el("div", { class: "box" }, pre, button);
}

function names(code, type) {
  try {
    return new Intl.DisplayNames([code], { type, fallback: "code" });
  } catch {
    return { of: (x) => x };
  }
}

function select(id, options, placeholder) {
  const s = el("select", { id, name: id });
  if (placeholder !== undefined) s.append(el("option", { value: "", text: placeholder }));
  for (const [value, label] of options) s.append(el("option", { value, text: label }));
  return s;
}

function field(label, control, hint) {
  return el("div", { class: "field" }, el("label", { for: control.id, text: label }), control,
    hint ? el("p", { class: "hint", text: hint }) : null);
}

function zoneOptions() {
  const groups = new Map();
  for (const zone of DATA.timezones) {
    const area = zone.split("/")[0];
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(zone);
  }
  const s = el("select", { id: "timezone", name: "timezone" });
  for (const [area, zones] of groups) {
    const g = el("optgroup", { label: area });
    for (const zone of zones) g.append(el("option", { value: zone, text: zone.replaceAll("_", " ") }));
    s.append(g);
  }
  const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
  s.value = DATA.timezones.includes(own) ? own : "";
  if (!s.value) s.prepend(el("option", { value: "", text: "—", selected: true }));
  return s;
}

export function render(code) {
  const t = T[code];
  setDirection(code);
  document.title = t.title;
  const root = document.getElementById("app");
  root.replaceChildren();
  const lang = names(code, "language");
  const region = names(code, "region");
  const byName = (a, b) => a[1].localeCompare(b[1], code);

  // The menu names the AI and nothing else (the owner's word, 26.11.2026): a plan beside it reads as the one she must
  // have, and «Before you start» says the minimum once, above.
  const platformSel = select("platform", Object.entries(DATA.platforms).map(([k, row]) => [k, row.title]), "—");
  const languages = DATA.languages.map((c) => [c, `${lang.of(c)} (${c})`]).sort(byName);
  const languageSel = select("language", languages, "—");
  languageSel.value = DATA.languages.includes(code) ? code : "";
  const workSels = [1, 2, 3].map((n) => select(`work${n}`, languages, t.q_work_none));
  const countrySel = select("country", DATA.countries.map((c) => [c, region.of(c)]).sort(byName), "—");
  const zoneSel = zoneOptions();
  const nameInput = el("input", { id: "name", name: "name", type: "text", autocomplete: "given-name",
    maxlength: String(DATA.limits.name), dir: "auto" });
  const genders = el("div", { class: "radios", role: "radiogroup", "aria-label": t.q_gender },
    DATA.genders.map((g) => el("label", {}, el("input", { type: "radio", name: "gender", value: g }), ` ${t[`gender_${g}`]}`)));
  const purposes = el("div", { class: "radios", role: "radiogroup", "aria-label": t.purpose_q },
    ["first", "settings", "another"].map((p) => el("label", {},
      el("input", { type: "radio", name: "purpose", value: p, checked: p === "first" }), ` ${t[`purpose_${p}`]}`)));

  const error = el("p", { class: "error", role: "alert" });
  const out = el("section", { id: "out", "aria-live": "polite" });
  const tellBtn = el("button", { type: "button", class: "build", text: t.build_tell });
  const onlyBtn = el("button", { type: "button", class: "build", text: t.build_only });
  const buildBtn = el("button", { type: "button", class: "build", text: t.build });
  const note = el("p", { class: "hint" });

  const purpose = () => purposes.querySelector("input:checked")?.value || "first";
  const showButtons = () => {
    const settings = purpose() === "settings";
    tellBtn.hidden = settings;
    onlyBtn.hidden = settings;
    buildBtn.hidden = !settings;
    note.textContent = settings ? t.settings_note : t.buttons_note;
  };
  purposes.addEventListener("change", showButtons);

  const answers = () => ({
    platform: platformSel.value,
    language: languageSel.value,
    work_languages: workSels.map((s) => s.value).filter(Boolean),
    country: countrySel.value,
    timezone: zoneSel.value,
    name: nameInput.value,
    gender: genders.querySelector("input:checked")?.value || "",
  });

  const go = (tell) => async () => {
    const a = answers();
    const why = refusal(a);
    out.replaceChildren();
    if (why) {
      error.textContent = t.err[why] || t.err.name;
      return;
    }
    error.textContent = "";
    const p = part(a);
    const field = fieldText();
    if (purpose() === "settings") out.append(...settingsOutput(t, p));
    else out.append(...installOutput(t, a, field, p));
    // The texts are built and shown first; the line goes after them, once from this page, and nothing waits on it.
    const asked = tell && purpose() !== "settings";
    const sendIt = asked && !sentOnce;
    if (sendIt) {
      sentOnce = true;
      send(line("start", a, TEST));
    }
    out.append(el("p", { class: "sent", text: sendIt
      ? t.sent(`start · ${DATA.platforms[a.platform].title} · ${a.language} · ${a.country}${TEST ? " · test" : ""}`)
      : asked ? t.sent_before : t.not_sent }));
    try {
      for (const mark of await marker(field, p)) out.append(document.createComment(` ${mark} `));
    } catch {
      // no crypto.subtle (a page not served over https): the texts stand, without their fingerprints
    }
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  tellBtn.addEventListener("click", go(true));
  onlyBtn.addEventListener("click", go(false));
  buildBtn.addEventListener("click", go(false));
  showButtons();

  root.append(
    languageSwitch(code, (c) => {
      const url = new URL(location.href);
      url.searchParams.set("lang", c);
      history.replaceState(null, "", url);
      render(c);
    }),
    el("h1", { text: t.title }),
    el("p", { text: t.intro }),
    el("section", {}, el("h2", { text: t.need_h }), el("ul", {}, t.need.map((x) => el("li", { rich: x })))),
    el("section", {},
      el("h2", { text: t.purpose_q }), purposes,
      el("h2", { text: t.form_h }),
      field(t.q_platform, platformSel),
      field(t.q_language, languageSel),
      el("div", { class: "field" }, el("label", { for: "work1", text: t.q_work }), ...workSels),
      field(t.q_country, countrySel),
      field(t.q_timezone, zoneSel),
      field(t.q_name, nameInput, t.q_name_hint),
      el("div", { class: "field" }, el("span", { class: "label", text: t.q_gender }), genders),
      error,
      el("div", { class: "buttons" }, tellBtn, onlyBtn, buildBtn),
      note),
    out,
    el("footer", {}, el("p", { class: "hint", text: t.footer(DATA.release) })),
  );
}

function installOutput(t, a, field, p) {
  const row = DATA.platforms[a.platform];
  // English names the place in the release's own words; the others go by the menus.
  const place = (words) => (t === T.en ? words : PLACES[words]?.[langOf(t)] || words);
  // One place on every platform from v0.1.15 — the field for every chat; a release that brings a second place back
  // (`field_all`) fails page/test/page.test.js until the page has words for the choice again.
  const where = t.where_one(place(row.field));
  // Everything she is to read comes before the box it is about, and nothing after the last box: once she has
  // copied a text she goes to her AI and may not come back to this page (the owner's word, 26.11.2026). And only what
  // she needs to set it up: how the system works, what is seen by whom and what each platform can do are the site's
  // (the owner's word, 26.11.2026); so is which platform is in beta. The page is written once for every platform.
  return [
    el("h2", { text: t.out_h }),
    row.plan === "any" ? null : el("p", { class: "plan", text: t.need_plan(row.plan) }),
    el("h3", { text: t.later_h }),
    el("p", { text: t.later }),
    el("p", { text: t.two_texts }),
    el("h3", { text: t.check_h }),
    el("p", { rich: t.check(DATA.manifests) }),
    el("h3", { text: t.step1_h }),
    el("p", { text: `${t.step1} ${where}` }),
    el("p", { text: t.paste(lastLine(field), lastWords(field), length(field), MARK_RE.test(lastLine(field))) }),
    copyBox(field, t),
    el("h3", { text: t.step2_h }),
    el("p", { text: t.after }),
    el("p", { text: t.old }),
    el("p", { text: t.step2 }),
    copyBox(firstMessage(p), t),
  ];
}

function settingsOutput(t, p) {
  return [
    el("h2", { text: t.out_settings_h }),
    el("p", { text: t.settings_lead }),
    copyBox(firstMessage(p, DATA.messages.settings), t),
    el("p", { text: t.settings_after }),
  ];
}

const langOf = (t) => LANGS.find((code) => T[code] === t);
