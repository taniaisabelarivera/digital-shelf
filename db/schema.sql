-- Digital Shelf schema (SQLite).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,                 -- bcrypt/argon2 hash, NEVER the password
  dob           TEXT,                          -- ISO date, optional
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))   -- "Active Since"
);

-- One row per (user, movie). Only the TMDB id is required; title/poster are a display cache.
CREATE TABLE IF NOT EXISTS user_movies (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id      INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned','watching','completed','dropped')),
  liked        INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0,1)),
  rating       INTEGER CHECK (rating BETWEEN 1 AND 10),
  title        TEXT,
  poster_path  TEXT,
  release_date TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tmdb_id)
);
CREATE INDEX IF NOT EXISTS idx_um_movie ON user_movies (tmdb_id, liked);   -- speeds up matching

-- Friend requests. Store each pair once (requester -> addressee).
CREATE TABLE IF NOT EXISTS friendships (
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

-- Forum (community page)
CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id    INTEGER,                          -- optional: post about a specific movie
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);

-- Feeds the three profile stats directly.
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT u.id AS user_id,
  (SELECT COUNT(*) FROM user_movies m WHERE m.user_id = u.id AND m.status = 'completed') AS movies_completed,
  (SELECT COUNT(*) FROM user_movies m WHERE m.user_id = u.id AND m.status = 'dropped')   AS movies_dropped,
  (SELECT COUNT(*) FROM friendships f
     WHERE f.status = 'accepted' AND u.id IN (f.requester_id, f.addressee_id))           AS friends_made
FROM users u;