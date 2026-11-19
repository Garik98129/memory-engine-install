-- The installation counter: counts, and no name or address (memory-engine, docs/DESIGN_PHASE3.md §5a).
CREATE TABLE IF NOT EXISTS counts (
  day      TEXT    NOT NULL,              -- UTC date, YYYY-MM-DD: never a time finer than the day
  event    TEXT    NOT NULL,              -- start | done
  platform TEXT    NOT NULL,              -- chatgpt | claude | grok
  language TEXT    NOT NULL,              -- her answer's primary code only: pt for pt-BR
  country  TEXT    NOT NULL,              -- her answer, ISO 3166-1: IL, DE — never from her address
  test     INTEGER NOT NULL,              -- 1: marked as a test (anyone can set it), counted apart
  n        INTEGER NOT NULL,
  PRIMARY KEY (day, event, platform, language, country, test)
);
-- One row a day: its total, held below the ceiling in the same statement that adds to it.
CREATE TABLE IF NOT EXISTS days (
  day   TEXT    NOT NULL PRIMARY KEY,
  total INTEGER NOT NULL
);
