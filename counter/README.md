# The installation counter

A small Worker on Cloudflare with a D1 base (memory-engine, `docs/DESIGN_PHASE3.md` §5a, «The counter»).
It counts installations people choose to report, and nothing of a person.

**What it keeps.** Two tables (`schema.sql`). `counts`: the UTC day, the event (`start` — she pressed
«Build and tell the author» on the installation page; `done` — she pressed «tell the author it worked» on
the page her AI's last message of installation links to), her AI, her language's primary code (`pt` for
`pt-BR`) and her country as she answered them, a mark for the owner's own test runs, and a count. `days`:
each day's total, held below the ceiling. No name, no address, no header, no cookie, no time finer than
the day. Still, a row of one may point to one person for someone who knows who installed that day: the
numbers are the owner's alone, behind his key. Workers Logs and traces are off (`wrangler.toml`).

**What it takes.** `POST /e` with the installation page's `Origin`, a body of at most 256 bytes of UTF-8,
read no further: `{"e": "start", "p": "chatgpt", "l": "ru", "c": "IL", "t": 0}` — exactly those five
fields, each a value it knows: an installable platform, a language code whose primary part names a
language, a country of ISO 3166-1 (`src/countries.js`, tzdata's `iso3166.tab`); anything else → 400,
another page's browser → 403, past 5 000 events a day → 429, the base out of reach → 503. `Origin` keeps
other pages out, not a script, which sets any header: a script can fill a day's ceiling, or the account's
100 000 requests a day — the count then stops for the day, and an installation never waits on it.
`GET /stats?key=…[&since=YYYY-MM-DD]` gives the owner the rows; a key shorter than 32 characters, or a
wrong one → 403. The key is 32 random characters or more, a Worker secret.

**Tests.** `npm test` (Node 22: `node:sqlite` runs the same SQL as D1).

**Deployment** — by Claude Code with a token the owner gives, never in this repository; the steps, to be
checked when it is done: `npx wrangler d1 create memory-engine-counter` (its id goes into `wrangler.toml`
by a PR), `npx wrangler d1 execute memory-engine-counter --remote --file=counter/schema.sql`,
`npx wrangler secret put STATS_KEY`, `npx wrangler deploy`.

---

**Счётчик установок.** Маленький сервер на Cloudflare. Считает установки, о которых человек сам решил
сообщить, и ничего о самом человеке: день, событие («начал» — нажал «собрать и сообщить автору»;
«получилось» — нажал кнопку на странице, на которую в конце установки ссылается его ИИ), ИИ, язык и
страна из его ответов (у языка — только основной код), пометка тестов владельца и число. Без IP, без cookies, без времени точнее дня,
журналы и трассировки выключены. Строка с числом 1 может указать на одного человека тому, кто знает,
кто ставил в тот день, — поэтому цифры видит только владелец, по своему ключу.
