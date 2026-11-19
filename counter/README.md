# The installation counter

A small Worker on Cloudflare with a D1 base (memory-engine, `docs/DESIGN_PHASE3.md` §5a, «The counter»).
It counts installations people choose to report, and nothing of a person.

**What it keeps.** One table, `counts` (`schema.sql`): the UTC day, the event (`start` — she pressed
«Build and tell the author» on the installation page; `done` — she pressed «tell the author it worked»
on the page her AI's last message of installation links to), her AI, her language and her country as
she answered them, a mark for the owner's own test runs, and a count. No address, no header, no cookie,
no time finer than the day. Workers Logs are off (`wrangler.toml`).

**What it takes.** `POST /e` from the installation page alone (its `Origin`), a body of at most 256
bytes: `{"e": "start", "p": "chatgpt", "l": "ru", "c": "IL", "t": 0}` — exactly those five fields, each a
value it knows; anything else → 400, another page → 403, past 5 000 events a day → 429. `GET
/stats?key=…[&since=YYYY-MM-DD]` gives the owner the rows; without the key → 403.

**Tests.** `npm test` (Node 22: `node:sqlite` runs the same SQL as D1).

**Deployment** — by Claude Code with a token the owner gives, never in this repository; the steps, to be
checked when it is done: `npx wrangler d1 create memory-engine-counter` (its id goes into `wrangler.toml`
by a PR), `npx wrangler d1 execute memory-engine-counter --remote --file=counter/schema.sql`,
`npx wrangler secret put STATS_KEY`, `npx wrangler deploy`.

---

**Счётчик установок.** Маленький сервер на Cloudflare. Считает установки, о которых человек сам решил
сообщить, и ничего о самом человеке: день, событие («начал» — нажал «собрать и сообщить автору»;
«получилось» — нажал кнопку на странице, на которую в конце установки ссылается его ИИ), ИИ, язык и
страна из его ответов, пометка тестов владельца и число. Без IP, без cookies, без времени точнее дня,
журналы выключены.
