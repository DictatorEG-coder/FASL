CREATE TABLE IF NOT EXISTS session_interrogations (
  session_id TEXT NOT NULL,
  suspect_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  asked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(session_id, question_key),
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_interrogations_session ON session_interrogations(session_id);
