-- The installation counter: counts, and nothing of a person (memory-engine, docs/DESIGN_PHASE3.md §5a).
CREATE TABLE IF NOT EXISTS counts (
  day      TEXT    NOT NULL,              -- UTC date, YYYY-MM-DD: never a time finer than the day
  event    TEXT    NOT NULL,              -- start | done
  platform TEXT    NOT NULL,              -- chatgpt | claude | grok
  language TEXT    NOT NULL,              -- her answer, a language code: ru, he, pt-BR
  country  TEXT    NOT NULL,              -- her answer, two letters: IL, DE — never from her address
  test     INTEGER NOT NULL,              -- 1: a run of the owner's own tests, counted apart
  n        INTEGER NOT NULL,
  PRIMARY KEY (day, event, platform, language, country, test)
);
