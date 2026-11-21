PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  username TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chats (
  chat_id TEXT PRIMARY KEY,
  chat_type TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stories (
  story_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL DEFAULT 'مغامرة',
  estimated_minutes INTEGER NOT NULL DEFAULT 15,
  content_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mode TEXT NOT NULL CHECK(mode IN ('private','group')),
  poll_id TEXT,
  poll_message_id INTEGER,
  pending_poll_scene TEXT,
  poll_due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(story_id) REFERENCES stories(story_id)
);

CREATE TABLE IF NOT EXISTS votes (
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  option_ids TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(poll_id,user_id)
);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_due ON sessions(status,poll_due_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_live_session_per_chat ON sessions(chat_id) WHERE status IN ('active','waiting_poll','polling');
CREATE INDEX IF NOT EXISTS idx_users_seen ON users(last_seen_at);
