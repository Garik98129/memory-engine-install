# The installation page

The way without a copy (memory-engine, `docs/DESIGN_PHASE3.md` §5a): one public page that builds, in the browser of
her phone, what the Issue of the full way gives — the one text to paste, where it goes, the connections, the first
message with her part, what works on her AI — from her seven answers. English, Russian and Hebrew. Nothing to copy,
no sign-in, nothing kept.

**Files.**
- `index.html`, `app.js`, `style.css` — the page: the question what she comes for (her first installation, a change of
  her settings, another AI), the seven answers from lists — her AI, her language, up to three other languages, her
  country, her time zone, the grammar — and her name typed; two buttons of the same size and look, «Build and tell
  the author» and «Build without it»; a change of settings has one, «Build», and sends nothing.
- `build.js` — what she gets, built from her answers: `setup.build`'s user's part, `setup.first_message`, the one text,
  the fingerprints of `field_issue.marker` (kept in the page as comments, unseen), the counter's line. Pure: the page
  and the tests import it.
- `i18n.js` — the page's own words in three languages. What she pastes and sends stays the engine's English.
- `done.html`, `done.js` — the page «it worked»: her AI's last message of installation links to it (INSTALL-12, a rules'
  PR), and her AI never opens it itself: `done.html?p=<her AI>&l=<her language>&c=<her country>`. One line goes only when
  she presses «Tell the author it worked».
- `data.js` — written by `write.py` from a published release; never edited by hand.
- `write.py` — writes `data.js`: `python3.12 page/write.py --release <checkout of Garik98129/memory-engine-releases at a tag>`.
  It imports that release's `engine.setup.setup` and takes from it the one text, the installable rows of the platform
  table (with the line `setup` writes for each), the grammar lines, the messages, the limits; from the Python that runs
  it — the Unicode tables `setup.name_ok` and C5 read, and the time zones `setup` accepts (without `Etc/`). Run it with
  Python 3.12: the full way's `setup` runs on GitHub's ubuntu-24.04, whose `python3` is 3.12 (Unicode 15.0.0).
  `--check` compares `data.js` with what the release writes.

**The line it sends** (counter/README.md): `{"e": "start", "p": …, "l": …, "c": …, "t": 0}` — only from a press of
«Build and tell the author», after the texts are built and shown, by `fetch(…, {method: "POST", keepalive: true})` as an
ordinary CORS request, never waited on. `?test=1` on the page's address marks the owner's own runs: `t: 1`, counted
apart.

**What it does not check, and why.** `setup` also refuses a user's part in which C4 finds a number. The page does not
port C4's patterns: a name the page takes has no digit, and everything else in the part comes from its lists — the
parity test runs every list value through `setup.build`, so none is one setup refuses. The page offers its own list of
languages, so a language setup would take but the list lacks (`es-419`) is not on it: the full way still takes it.

**Tests.**
- `npm test` — the page's own, without Python: its words in three languages, its lists against the counter's, the line
  it sends against what the counter takes, the rules it holds the answers to.
- `RELEASE_DIR=<checkout> PYTHON=python3.12 npm run test:parity` — the page against the engine, byte for byte, at the
  release its data names: the same names taken and refused; for each set of answers the same refusal, or the same part,
  first message and message after a change of settings; and every list value through `setup.build`. CI runs it
  (`.github/workflows/test.yml`, job `parity`).

**Publishing** — by the owner, after the release that carries the text's mark (`v0.1.14` or later, DESIGN_PHASE3 §5a,
«The order»), with `data.js` written again from it: GitHub Pages, «Deploy from a branch», `main`, `/ (root)`. The page is
then at `https://garik98129.github.io/memory-engine-install/page/`, the page «it worked» at `…/page/done.html` — the
counter takes lines from that origin (`counter/wrangler.toml`). `.nojekyll` keeps GitHub from building the folder.

---

**Страница установки.** Путь без личной копии: страница прямо в браузере телефона собирает из семи ответов то же, что
даёт Issue полного пути, — общий текст для вставки, первое сообщение с личной частью, подключения и что работает на
выбранном ИИ. Три языка: русский, английский, иврит. Ничего не хранит. Одну строку в счётчик отправляет только по
нажатию «Собрать и сообщить автору», после того как тексты собраны. Тексты сверяются с движком байт в байт тестом
`test:parity`. Публикует владелец: GitHub Pages, ветка `main`, корень; не раньше выпуска с пометкой текста (`v0.1.14` или
новее) и после пересборки `data.js` из него.
