CREATE TABLE IF NOT EXISTS session_clues (
  session_id TEXT NOT NULL,
  clue_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(session_id, clue_id),
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_clues_session ON session_clues(session_id);
