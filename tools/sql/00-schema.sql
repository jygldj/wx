CREATE TABLE IF NOT EXISTS articles (
  aid        INTEGER PRIMARY KEY AUTOINCREMENT,
  seq        INTEGER NOT NULL DEFAULT 0,
  title      TEXT    NOT NULL,
  category   TEXT    NOT NULL DEFAULT '其它',
  date       TEXT    NOT NULL DEFAULT '',
  body       TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'published',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_seq    ON articles(seq);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, seq);
