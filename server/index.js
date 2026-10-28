import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";

const db = new DatabaseSync(new URL("../db/shelf.db", import.meta.url).pathname);
db.exec("PRAGMA foreign_keys = ON");

const app = express();
app.use(express.json());

const sessions = new Map();

function getCookie(req, name) {
  const found = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : null;
}
function startSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/`);
}
function requireAuth(req, res, next) {
  const userId = sessions.get(getCookie(req, "sid"));
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  req.userId = userId;
  next();
}

app.post("/api/signup", (req, res) => {
  const { username = "", email = "", password = "" } = req.body ?? {};
  if (!/^[\w.-]{3,30}$/.test(username)) return res.status(400).json({ error: "Username must be 3-30 letters, numbers, . _ or -" });
  if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  try {
    const r = db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
      .run(username, email.trim(), hashPassword(password));
    startSession(res, Number(r.lastInsertRowid));
    res.status(201).json({ username });
  } catch {
    res.status(409).json({ error: "That username or email is already taken." });
  }
});

app.post("/api/login", (req, res) => {
  const { email = "", password = "" } = req.body ?? {};
  const user = db.prepare("SELECT id, username, password_hash FROM users WHERE email = ?").get(email.trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  startSession(res, user.id);
  res.json({ username: user.username });
});

app.post("/api/logout", (req, res) => {
  sessions.delete(getCookie(req, "sid"));
  res.setHeader("Set-Cookie", "sid=; Max-Age=0; Path=/");
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  const me = db.prepare(
    `SELECT u.username, u.email, u.dob, u.created_at, s.movies_completed, s.movies_dropped, s.friends_made
     FROM users u JOIN user_stats s ON s.user_id = u.id WHERE u.id = ?`).get(req.userId);
  res.json(me);
});

app.get("/api/shelf", requireAuth, (req, res) => {
  res.json(db.prepare(
    `SELECT tmdb_id, status, liked, rating, title, poster_path, release_date
     FROM user_movies WHERE user_id = ? ORDER BY updated_at DESC`).all(req.userId));
});

// People with similar taste: Jaccard similarity on liked movies.
app.get("/api/matches", requireAuth, (req, res) => {
  res.json(db.prepare(
    `SELECT u.username, COUNT(*) AS shared_likes,
            ROUND(100.0 * COUNT(*) /
              ((SELECT COUNT(*) FROM user_movies WHERE user_id = :me AND liked = 1)
               + (SELECT COUNT(*) FROM user_movies WHERE user_id = o.user_id AND liked = 1)
               - COUNT(*)), 1) AS similarity
     FROM user_movies mine
     JOIN user_movies o ON o.tmdb_id = mine.tmdb_id AND o.liked = 1 AND o.user_id <> :me
     JOIN users u ON u.id = o.user_id
     WHERE mine.user_id = :me AND mine.liked = 1
     GROUP BY o.user_id ORDER BY similarity DESC LIMIT 10`).all({ me: req.userId }));
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));