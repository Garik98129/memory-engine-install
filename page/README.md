# The setup page

The way without a copy (the engine's `docs/DESIGN_PHASE3.md` §5a): one public page that builds, in the browser of
her phone, what the Issue of the full way gives — the one text to paste, where it goes, the connections, the first
message with her part, what works on her AI — from her seven answers. English, Russian and Hebrew. Nothing to copy,
no sign-in, nothing kept.

**Files.**
- `index.html`, `main.js`, `app.js`, `style.css` — the page: the question what she comes for (her first setup, a change of
  her settings, another AI), the seven answers from lists — her AI, her language, up to three other languages, her
  country, her time zone, the grammar — and her name typed; two buttons of the same size and look, «Build and tell
  Grafyla's creator» and «Build without sending»; a change of settings has one, «Build», and sends nothing.
- `build.js` — what she gets, built from her answers: `setup.build`'s user's part, `setup.first_message`, the one text,
  the fingerprints of `field_issue.marker` — of the text, and of her part without its outer line breaks, as
  `setup_run.open_issue` gives them — kept in the page as comments, unseen; the counter's line. Pure: the page
  and the tests import it.
- `i18n.js` — the page's own words in three languages; Russian and Hebrew say «настройка», «הגדרה», the words of the
  site's «Get started» (`grafyla/site`). What she pastes and sends stays the engine's English. Where the text goes
  (`field` of the platform table — one place on every platform from v0.1.15, the field for every chat) is said in
  Russian and Hebrew as a path through the menus (`PLACES`), the buttons named as the screen shows them: ChatGPT in the
  browser by the owner's own screens (Safari on an iPhone, Russian interface, 19.11.2026) — his name at the foot of the
  side menu, «Персонализация», «Пользовательские инструкции», scrolled down to it, by «ChatGPT», «Редактировать»; Claude by the English names of
  Anthropic's help («Settings», «Your Claude», «Instructions», read 19.11.2026) in both — its interface in Russian or
  Hebrew was not seen; Hebrew names ChatGPT's English buttons; Grok's app is said in words. English keeps the release's
  words, held to the Issue. A link in a sentence is written `[words](address)` and drawn by `app.js` (`rich`): the
  words as text, the address https only — three of them, GitHub's and Notion's sign-up and GitHub's «new repository».
  In Hebrew each run of Latin words is an isolate (FSI … PDI, `app.js`, `isolate`), a short one with its spaces
  unbroken, so a button's name or «TEXT MARK 5.» keeps its quotes and arrows in a right-to-left line; what she copies
  is left as it is.
- `done.html`, `done.js` — the page «it worked»: her AI's last message of setup links to it (INSTALL-12, from
  v0.1.14; at this address from v0.1.15), and her AI never opens it itself: `done.html?p=<her AI>&l=<her language>&c=<her country>`. One line goes only
  when she presses «Tell Grafyla's creator it worked», once: her answer outlives a change of language (`ended`).
- `data.js` — written by `write.py` from a published release; never edited by hand.
- `write.py` — writes `data.js`: `python3.12 page/write.py --release <checkout of grafyla/releases at a tag>`.
  It imports that release's `engine.setup.setup` and takes from it the one text, the installable rows of the platform
  table (with the line `setup` writes for each), the grammar lines, the messages, the limits; from the Python that runs
  it — the Unicode tables `setup.name_ok` and C5 read, and the time zones `setup` accepts on that machine (without
  `Etc/`; a machine whose tzdata also holds the old aliases, as GitHub's runner does — «America/Buenos_Aires» —, has
  setup take those too, and the page does not offer them: `--check` says so in a NOTE). Run it with
  Python 3.12: the full way's `setup` runs on GitHub's ubuntu-24.04, whose `python3` is 3.12 (Unicode 15.0.0).
  `--check` compares `data.js` with what the release writes.

**The line it sends** (counter/README.md): `{"e": "start", "p": …, "l": …, "c": …, "t": 0}` — only from a press of
«Build and tell Grafyla's creator», after the texts are built and shown, by `fetch(…, {method: "POST", keepalive: true})` as an
ordinary CORS request, never waited on; one line from the page, however often she presses. The line has no day: the
counter puts the day, in UTC, on which it takes the line, and the pages say so. Opening «it worked» from her AI's link
hands GitHub that link, with her AI, language and country in it, as any visit does: the page says «nothing reaches the
creator unless you press», not «nothing is sent». `?test=1` on the page's
address marks a run as a test (`t: 1`, counted apart): the owner's own runs carry it, and anyone can set it, so in the
numbers it means «marked as a test», not «the owner's run». Both pages load nothing but their own files and may
connect to the counter alone (a Content-Security-Policy in each).

**Its words** are its own, in three languages, and only what a setup needs (the owner's word, 26.11.2026): how
Grafyla works, what is seen by whom — GitHub, Cloudflare, the counter — and what each platform can do are the site's.
Until 26.11.2026 the English followed the Issue of the full way sentence for sentence; that way is set aside, and the
page no longer follows it. What is held, byte for byte, is what she pastes and sends: the text of step 1, her part and
the two messages (`test:parity`). Beside each button that sends, the page says what the one line holds. Which platform is in
beta, and what is not known yet, is the site's too: the page is written once for every platform, and its AI menu
names the AI only — the minimum plan is said once, under «Before you start». Russian and Hebrew are read by a second reader; Hebrew still waits
for a native speaker. Where the text carries its mark (`TEXT MARK 2.`, from v0.1.14), the page asks her to keep that
last line; a text without it — v0.1.13 — ends with the words that release's Issue named.

**Its order** is not the Issue's, on purpose (the owner's word, 26.11.2026): once she has copied a text she goes to her
AI and may not come back, so whatever she is to read comes before the box it is about, and nothing after the last box.
The output opens with the two texts and, in Russian and Hebrew, one line that they are in English on purpose; under
«2.» what the AI does from there (how long — about 20–30 minutes, as the site says; how to stop and go on), her old
instructions and what the first message holds — the answers and service lines for extra features not in use now — come before «Send your AI…» and its box. `page/test/page.test.js` holds the order and that
nothing follows the last box. The message after a change of settings keeps its one line after the box: its lead ends
with a colon on the box, and that line asks nothing of her.

**What it does not check, and why.** `setup` also refuses a user's part in which C4 finds a number. The page does not
port C4's patterns: a name the page takes has no digit, and everything else in the part comes from its lists — the
parity test runs every list value through `setup.build`, so none is one setup refuses. The page offers its own list of
languages, so a language setup would take but the list lacks (`es-419`) is not on it, and its countries are ISO
3166-1's, as the counter's: `XK`, which setup takes as any two letters, is not on it. The full way still takes both.
These three — C4 not ported, the language list, the country list — are where the page is narrower than DESIGN_PHASE3
§5a says («the codes, … no number in her part (C4's patterns)»); the PR that brings the page names them.

**Tests.**
- `npm test` — the page's own, without Python: its words in three languages, its lists against the counter's, the line
  it sends against what the counter takes, the rules it holds the answers to.
- `RELEASE_DIR=<checkout> PYTHON=python3.12 npm run test:parity` — the page against the engine, byte for byte, at the
  release its data names: the same names taken and refused; for each set of answers the same refusal, or the same part,
  first message and message after a change of settings; and every list value through `setup.build`. CI runs it
  (`.github/workflows/test.yml`, job `parity`).

**Publishing.** GitHub Pages, «Deploy from a branch», `main`, `/ (root)`, with the custom domain `setup.grafyla.com`
(the file `CNAME`; a CNAME record in the owner's DNS leads to `grafyla.github.io`): the page is at `https://setup.grafyla.com/page/`, the page «it worked» at `…/page/done.html` —
the address the rules give her AI from v0.1.15 (INSTALL-12), and the origin `counter/wrangler.toml` names. The counter
takes lines from that origin only once it is deployed with that file: until then it refuses them (403), and the page,
which never waits for the answer, still says the line was sent. «Enforce HTTPS» is on: the plain http address leads to
https, and without https the page has no fingerprints and the counter would refuse its origin. What `main` holds is
what people get — at once, so two things come before a merge here: the release the page names is tagged in
`grafyla/releases`, and the branch `stable` there is on a release whose index that text can read (the text she pastes
sends her AI to `rules-index.md` at `stable`; with no such branch her AI says the rules are unavailable): `data.js` is v0.1.18's, written again by `write.py`
with each release the page follows. `.nojekyll` keeps GitHub from building the folder. Until 23.11.2026 the page's
address was `https://garik98129.github.io/memory-engine-install/page/`; GitHub Pages does not lead from an old address
to a new one.

---

**Страница настройки.** Путь без личной копии: страница прямо в браузере телефона собирает из семи ответов то же, что
даёт Issue полного пути, — общий текст для вставки, первое сообщение с личной частью и проверку подключений. Три языка: русский, английский, иврит. Ничего не хранит. Одну строку в счётчик отправляет
только по нажатию «Собрать и сообщить создателю Grafyla», после того как тексты собраны; день к строке ставит сам счётчик. Тексты
сверяются с движком байт в байт тестом `test:parity`. По-русски и на иврите место для текста показано путём по меню со
стрелками: кнопки ChatGPT — так, как они написаны на экране (по скриншотам владельца с chatgpt.com в Safari, русский
интерфейс), кнопки Claude — английскими названиями из справки Anthropic. Страница опубликована на GitHub Pages по
адресу `https://setup.grafyla.com/page/`; данные собраны из выпуска `v0.1.18`. Порядок блоков — не как в Issue (слово владельца
26.11.2026): скопировав текст, человек уходит в свой ИИ и может не вернуться, поэтому всё, что нужно прочесть, стоит
до окошка, к которому относится, а после последнего окошка ничего нет. И только то, что нужно для настройки (слово
владельца 26.11.2026): как устроена Grafyla, кто что видит (GitHub, Cloudflare, счётчик) и что умеет каждая платформа —
на сайте; у кнопок, которые отправляют строку, сказано, что в ней. Бета и что ещё не проверено — тоже на сайте: страница
пишется один раз для всех ИИ, в меню — только название ИИ, минимальный тариф — один раз, в «Перед началом». Пояснения страницы — свои, к тексту полного пути
они больше не привязаны; байт в байт сверяются только тексты для вставки и отправки.
