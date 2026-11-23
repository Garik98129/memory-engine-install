# The setup counter

A small Worker on Cloudflare with a D1 base (memory-engine, `docs/DESIGN_PHASE3.md` §5a, «The counter»).
It counts setups people choose to report, and nothing of a person.

**What it keeps.** Two tables (`schema.sql`). `counts`: the UTC day, the event (`start` — she pressed
«Build and tell the author» on the setup page; `done` — she pressed «tell the author it worked» on
the page her AI's last message of setup links to), her AI, her language's primary code (`pt` for
`pt-BR`) and her country as she answered them, a mark «test» — anyone can set it, so it says «marked as a test», not «the owner's run» —, and a count. `days`:
each day's total, held below the ceiling. No name, no address, no header, no cookie, no time finer than
the day. Still, a row of one may point to one person for someone who knows who set her AI up that day: the
numbers are the owner's alone, behind his key. Workers Logs and traces are off (`wrangler.toml`).

**What it takes.** `POST /e` with the `Origin` of the setup page's own address (`https://setup.grafyla.com` — every page
served there, which is this repository's alone; `wrangler.toml`, and a change of it reaches the counter only with a
deployment), a body of at most 256 bytes of UTF-8,
read no further: `{"e": "start", "p": "chatgpt", "l": "ru", "c": "IL", "t": 0}` — exactly those five
fields, each a value it knows: an installable platform, a language code whose primary part is in ISO 639
(`src/languages.js`, from SIL's ISO 639-3 table, without `und`, `zxx`, `mul`, `mis`; one code a
language: `iw` and `heb` are kept as `he`), a country of ISO 3166-1 (`src/countries.js`, tzdata's `iso3166.tab` — the engine takes any two
letters, so a code outside it, such as `XK`, is not counted); anything else → 400,
a browser on another site → 403, past 5 000 events a day → 429, the base out of reach → 503. `Origin` keeps
other sites' pages out, not a script, which sets any header: a script can fill a day's ceiling, or the account's
100 000 requests a day — the count then stops for the day, and a setup never waits on it.
`GET /stats?key=…[&since=YYYY-MM-DD]` gives the owner the rows; a key shorter than 32 characters, or a
wrong one → 403. The key is a Worker secret of 32 or more letters, digits, `_` or `-` — a key with `+`,
`/`, `#` or `%` would not survive a link and opens nothing: make it with `openssl rand -hex 32`.

**What the page must do.** Send the line with `fetch(…, {method: "POST", keepalive: true})` as an
ordinary CORS request — not `no-cors` or `sendBeacon`, and with no `no-referrer` policy, either of which
can make the browser send `Origin: null`, which is refused. Build the texts first and never wait on the
answer: a 4xx or 5xx changes nothing for her.

**Files.** `src/worker.js` — the Worker's main module, exporting its handler and nothing else (workerd
refuses a main module that exports anything but handlers); `src/counter.js` — the logic;
`src/languages.js`, `src/countries.js` — the lists.

**Tests.** `npm test` (Node 22: `node:sqlite` runs the same SQL as D1); GitHub runs them on every PR and on
`main` (`.github/workflows/test.yml`). They do not run workerd: build
and start the real bundle (`wrangler deploy --dry-run`) before a deployment.

**Deployment** — 19.11.2026, on the owner's Cloudflare account, with nothing secret in this repository: a
clean clone of `main` at `808eb73`, wrangler 4.165.0, `wrangler login` (logged out afterwards); in
`counter/`: `npx wrangler d1 create memory-engine-counter` (its id is in `wrangler.toml`),
`npx wrangler d1 execute memory-engine-counter --remote --file=schema.sql`, `npx wrangler deploy`, then
`openssl rand -hex 32` through stdin into `npx wrangler secret put STATS_KEY`, the key never printed. It
runs at `https://memory-engine-counter.memory-engine.workers.dev`. Checked that day: the Worker's settings
show Workers Logs and traces off; from outside, a line → 204 and again 204, another site's `Origin`,
`Origin: null` or none → 403, a body of 256 bytes → 204 and of 257 → 400, `/stats` without the key or with
a wrong one → 403; on a test Worker and base, deleted afterwards, 60 lines at once against a day at 4 990 →
10 × 204 and 50 × 429, and the counts summed to 5 000. A later deployment of a change: `npx wrangler deploy`
in `counter/` on `main`.

---

**Счётчик настроек.** Маленький сервер на Cloudflare. Считает настройки, о которых человек сам решил
сообщить, и ничего о самом человеке: день, событие («начал» — нажал «собрать и сообщить автору»;
«получилось» — нажал кнопку на странице, на которую в конце настройки ссылается его ИИ), ИИ, язык и
страна из его ответов (у языка — только основной код), пометка «тест» (её может поставить кто угодно — это не «прогон владельца») и число. Без IP, без cookies, без времени точнее дня,
журналы и трассировки выключены. Строка с числом 1 может указать на одного человека тому, кто знает,
кто настраивал свой ИИ в тот день, — поэтому цифры видит только владелец, по своему ключу.
