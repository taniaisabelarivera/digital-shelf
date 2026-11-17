import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { hashPassword, verifyPassword } from "./password.js";
const PORT = process.env.PORT || 3000;
const DB_PATH = new URL("../db/shelf.db", import.meta.url).pathname;
const DIST = new URL("../dist", import.meta.url).pathname;

if (!existsSync(DB_PATH)) {
  console.error("Database not found. Run `npm run db:init` first.");
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

if (!db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "bio")) {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT");
}

const app = express();
app.use(express.json({ limit: "250kb" }));

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map(); // token -> { userId, expires }

function getCookie(req, name) {
  const found = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : null;
}

function startSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { userId, expires: Date.now() + SESSION_MS });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`
  );
}

function currentUserId(req) {
  const token = getCookie(req, "sid");
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s.userId;
}

function requireAuth(req, res, next) {
  const userId = currentUserId(req);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  req.userId = userId;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (s.expires < now) sessions.delete(t);
}, 60 * 60 * 1000).unref();

const isStr = (v) => typeof v === "string";

function toInt(v, fallback = null) {
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

const attempts = new Map();
function throttled(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) return false;
  return rec.count >= 10;
}
function noteFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) attempts.set(ip, { count: 1, reset: now + 15 * 60 * 1000 });
  else rec.count++;
}

function findUserByName(username) {
  return db.prepare("SELECT id, username FROM users WHERE username = ?").get(String(username));
}

app.post("/api/signup", (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (!isStr(username) || !/^[\w.-]{3,30}$/.test(username))
    return res.status(400).json({ error: "Username must be 3-30 letters, numbers, . _ or -" });
  if (!isStr(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: "Enter a valid email." });
  if (!isStr(password) || password.length < 8 || password.length > 200)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  try {
    const r = db
      .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
      .run(username, email.trim(), hashPassword(password));
    startSession(res, Number(r.lastInsertRowid));
    res.status(201).json({ username });
  } catch (err) {
    if (String(err.message).includes("UNIQUE"))
      return res.status(409).json({ error: "That username or email is already taken." });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  if (throttled(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again later." });
  const { email, password } = req.body ?? {};
  if (!isStr(email) || !isStr(password))
    return res.status(400).json({ error: "Email and password are required." });

  const user = db
    .prepare("SELECT id, username, password_hash FROM users WHERE email = ?")
    .get(email.trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    noteFailure(req.ip);
    return res.status(401).json({ error: "Invalid email or password." });
  }
  attempts.delete(req.ip);
  startSession(res, user.id);
  res.json({ username: user.username });
});

app.post("/api/logout", (req, res) => {
  sessions.delete(getCookie(req, "sid"));
  res.setHeader("Set-Cookie", "sid=; Max-Age=0; Path=/");
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  const me = db
    .prepare(
      `SELECT u.username, u.email, u.dob, u.bio, u.avatar_url, u.created_at,
              s.movies_completed, s.movies_dropped, s.friends_made
       FROM users u JOIN user_stats s ON s.user_id = u.id WHERE u.id = ?`
    )
    .get(req.userId);
  if (!me) return res.status(401).json({ error: "Not logged in" });
  res.json(me);
});

const AVATAR_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

app.patch("/api/me", requireAuth, (req, res) => {
  const b = req.body ?? {};
  const sets = [];
  const vals = [];
  const bad = (msg) => res.status(400).json({ error: msg });

  if (b.username !== undefined) {
    if (!isStr(b.username) || !/^[\w.-]{3,30}$/.test(b.username))
      return bad("Username must be 3-30 letters, numbers, . _ or -");
    sets.push("username = ?");
    vals.push(b.username);
  }
  if (b.bio !== undefined) {
    if (b.bio !== null && (!isStr(b.bio) || b.bio.length > 300))
      return bad("Bio can be at most 300 characters.");
    sets.push("bio = ?");
    vals.push(b.bio?.trim() || null);
  }
  if (b.dob !== undefined) {
    const dob = b.dob || null;
    const today = new Date().toISOString().slice(0, 10);
    if (dob !== null && (!isStr(dob) || !validDate(dob) || dob < "1900-01-01" || dob > today))
      return bad("Enter a valid date of birth.");
    sets.push("dob = ?");
    vals.push(dob);
  }
  if (b.avatar_url !== undefined) {
    const a = b.avatar_url || null;
    if (a !== null && (!isStr(a) || a.length > 150000 || !AVATAR_RE.test(a)))
      return bad("Photo must be a PNG, JPEG or WebP image.");
    sets.push("avatar_url = ?");
    vals.push(a);
  }
  if (!sets.length) return bad("Nothing to update.");

  try {
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals, req.userId);
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes("UNIQUE"))
      return res.status(409).json({ error: "That username is already taken." });
    throw err;
  }
});

const STATUSES = ["planned", "watching", "completed", "dropped"];

app.get("/api/shelf", requireAuth, (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT tmdb_id, status, liked, rating, title, poster_path, release_date
         FROM user_movies WHERE user_id = ? ORDER BY updated_at DESC`
      )
      .all(req.userId)
  );
});

app.get("/api/shelf/:tmdbId", requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT tmdb_id, status, liked, rating, title, poster_path, release_date
       FROM user_movies WHERE user_id = ? AND tmdb_id = ?`
    )
    .get(req.userId, toInt(req.params.tmdbId, -1));
  if (!row) return res.status(404).json({ error: "Not on your shelf" });
  res.json(row);
});

app.put("/api/shelf/:tmdbId", requireAuth, (req, res) => {
  const tmdbId = toInt(req.params.tmdbId);
  if (!tmdbId || tmdbId < 1) return res.status(400).json({ error: "Invalid movie id." });

  const b = req.body ?? {};
  if (b.status !== undefined && !STATUSES.includes(b.status))
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(", ")}` });
  if (b.rating != null && !(Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 10))
    return res.status(400).json({ error: "Rating must be a whole number 1-10." });
  for (const f of ["title", "poster_path", "release_date"])
    if (b[f] != null && (!isStr(b[f]) || b[f].length > 300))
      return res.status(400).json({ error: `Invalid ${f}.` });

  const old = db
    .prepare("SELECT * FROM user_movies WHERE user_id = ? AND tmdb_id = ?")
    .get(req.userId, tmdbId);

  const next = {
    status: b.status ?? old?.status ?? "planned",
    liked: b.liked !== undefined ? (b.liked ? 1 : 0) : old?.liked ?? 0,
    rating: b.rating !== undefined ? b.rating : old?.rating ?? null,
    title: b.title ?? old?.title ?? null,
    poster_path: b.poster_path ?? old?.poster_path ?? null,
    release_date: b.release_date ?? old?.release_date ?? null,
  };

  db.prepare(
    `INSERT INTO user_movies (user_id, tmdb_id, status, liked, rating, title, poster_path, release_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, tmdb_id) DO UPDATE SET
       status = excluded.status, liked = excluded.liked, rating = excluded.rating,
       title = excluded.title, poster_path = excluded.poster_path,
       release_date = excluded.release_date, updated_at = datetime('now')`
  ).run(req.userId, tmdbId, next.status, next.liked, next.rating, next.title, next.poster_path, next.release_date);

  res.status(old ? 200 : 201).json({ tmdb_id: tmdbId, ...next });
});

app.delete("/api/shelf/:tmdbId", requireAuth, (req, res) => {
  const r = db
    .prepare("DELETE FROM user_movies WHERE user_id = ? AND tmdb_id = ?")
    .run(req.userId, toInt(req.params.tmdbId, -1));
  if (!r.changes) return res.status(404).json({ error: "Not on your shelf" });
  res.json({ ok: true });
});

app.get("/api/matches", requireAuth, (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT u.username, COUNT(*) AS shared_likes,
                ROUND(100.0 * COUNT(*) /
                  ((SELECT COUNT(*) FROM user_movies WHERE user_id = :me AND liked = 1)
                   + (SELECT COUNT(*) FROM user_movies WHERE user_id = o.user_id AND liked = 1)
                   - COUNT(*)), 1) AS similarity
         FROM user_movies mine
         JOIN user_movies o ON o.tmdb_id = mine.tmdb_id AND o.liked = 1 AND o.user_id <> :me
         JOIN users u ON u.id = o.user_id
         WHERE mine.user_id = :me AND mine.liked = 1
         GROUP BY o.user_id ORDER BY similarity DESC LIMIT 10`
      )
      .all({ me: req.userId })
  );
});

app.get("/api/users/:username", requireAuth, (req, res) => {
  const user = db
    .prepare(
      `SELECT u.id, u.username, u.bio, u.avatar_url, u.created_at,
              s.movies_completed, s.movies_dropped, s.friends_made
       FROM users u JOIN user_stats s ON s.user_id = u.id WHERE u.username = ?`
    )
    .get(req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const liked = db
    .prepare(
      `SELECT tmdb_id, title, poster_path, release_date FROM user_movies
       WHERE user_id = ? AND liked = 1 ORDER BY updated_at DESC LIMIT 50`
    )
    .all(user.id);
  const { id, ...profile } = user;
  res.json({ ...profile, liked });
});

app.get("/api/friends", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT f.status, f.created_at,
              CASE WHEN f.requester_id = :me THEN 'outgoing' ELSE 'incoming' END AS direction,
              u.username
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = :me THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = :me OR f.addressee_id = :me) AND f.status IN ('pending','accepted')
       ORDER BY f.created_at DESC`
    )
    .all({ me: req.userId });
  res.json({
    friends: rows.filter((r) => r.status === "accepted"),
    incoming: rows.filter((r) => r.status === "pending" && r.direction === "incoming"),
    outgoing: rows.filter((r) => r.status === "pending" && r.direction === "outgoing"),
  });
});

app.post("/api/friends/:username", requireAuth, (req, res) => {
  const other = findUserByName(req.params.username);
  if (!other) return res.status(404).json({ error: "User not found" });
  if (other.id === req.userId) return res.status(400).json({ error: "You can't friend yourself." });

  const existing = db
    .prepare(
      `SELECT requester_id, addressee_id, status FROM friendships
       WHERE (requester_id = :a AND addressee_id = :b) OR (requester_id = :b AND addressee_id = :a)`
    )
    .get({ a: req.userId, b: other.id });

  if (existing) {
    if (existing.status === "accepted") return res.status(409).json({ error: "Already friends." });
    if (existing.status === "pending" && existing.requester_id === other.id) {
      db.prepare(
        "UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ?"
      ).run(other.id, req.userId);
      return res.json({ status: "accepted" });
    }
    if (existing.status === "pending") return res.status(409).json({ error: "Request already sent." });
    db.prepare("DELETE FROM friendships WHERE requester_id = ? AND addressee_id = ?").run(
      existing.requester_id,
      existing.addressee_id
    );
  }

  db.prepare("INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)").run(req.userId, other.id);
  res.status(201).json({ status: "pending" });
});

function answerRequest(status) {
  return (req, res) => {
    const other = findUserByName(req.params.username);
    if (!other) return res.status(404).json({ error: "User not found" });
    const r = db
      .prepare(
        `UPDATE friendships SET status = ?
         WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`
      )
      .run(status, other.id, req.userId);
    if (!r.changes) return res.status(404).json({ error: "No pending request from that user." });
    res.json({ status });
  };
}
app.post("/api/friends/:username/accept", requireAuth, answerRequest("accepted"));
app.post("/api/friends/:username/decline", requireAuth, answerRequest("declined"));

app.delete("/api/friends/:username", requireAuth, (req, res) => {
  const other = findUserByName(req.params.username);
  if (!other) return res.status(404).json({ error: "User not found" });
  const r = db
    .prepare(
      `DELETE FROM friendships
       WHERE (requester_id = :a AND addressee_id = :b) OR (requester_id = :b AND addressee_id = :a)`
    )
    .run({ a: req.userId, b: other.id });
  if (!r.changes) return res.status(404).json({ error: "No friendship found." });
  res.json({ ok: true });
});

app.get("/api/posts", (req, res) => {
  const tmdb = req.query.tmdb_id !== undefined ? toInt(req.query.tmdb_id) : null;
  const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 100);
  const offset = Math.max(toInt(req.query.offset, 0), 0);
  res.json(
    db
      .prepare(
        `SELECT p.id, p.tmdb_id, p.title, p.body, p.created_at, u.username,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE (:tmdb IS NULL OR p.tmdb_id = :tmdb)
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT :limit OFFSET :offset`
      )
      .all({ tmdb, limit, offset })
  );
});

app.post("/api/posts", requireAuth, (req, res) => {
  const { title, body, tmdb_id } = req.body ?? {};
  if (!isStr(title) || !title.trim() || title.length > 120)
    return res.status(400).json({ error: "Title is required (max 120 characters)." });
  if (!isStr(body) || !body.trim() || body.length > 5000)
    return res.status(400).json({ error: "Post body is required (max 5000 characters)." });
  const tmdb = tmdb_id == null ? null : toInt(tmdb_id);
  if (tmdb_id != null && (!tmdb || tmdb < 1)) return res.status(400).json({ error: "Invalid movie id." });

  const r = db
    .prepare("INSERT INTO posts (user_id, tmdb_id, title, body) VALUES (?, ?, ?, ?)")
    .run(req.userId, tmdb, title.trim(), body.trim());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const r = db
    .prepare("DELETE FROM posts WHERE id = ? AND user_id = ?")
    .run(toInt(req.params.id, -1), req.userId);
  if (!r.changes) return res.status(404).json({ error: "Post not found (or not yours)." });
  res.json({ ok: true });
});

app.get("/api/posts/:id/comments", (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT c.id, c.body, c.created_at, u.username
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`
      )
      .all(toInt(req.params.id, -1))
  );
});

app.post("/api/posts/:id/comments", requireAuth, (req, res) => {
  const postId = toInt(req.params.id, -1);
  const { body } = req.body ?? {};
  if (!isStr(body) || !body.trim() || body.length > 1000)
    return res.status(400).json({ error: "Comment is required (max 1000 characters)." });
  if (!db.prepare("SELECT 1 FROM posts WHERE id = ?").get(postId))
    return res.status(404).json({ error: "Post not found." });

  const r = db
    .prepare("INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)")
    .run(postId, req.userId, body.trim());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.delete("/api/comments/:id", requireAuth, (req, res) => {
  const r = db
    .prepare("DELETE FROM comments WHERE id = ? AND user_id = ?")
    .run(toInt(req.params.id, -1), req.userId);
  if (!r.changes) return res.status(404).json({ error: "Comment not found (or not yours)." });
  res.json({ ok: true });
});

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

if (existsSync(DIST)) app.use(express.static(DIST));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That request is too large." });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));