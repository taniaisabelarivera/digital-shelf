import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(new URL("./shelf.db", import.meta.url).pathname);

console.log("\n== Profile stats (user_stats view) ==");
console.table(db.prepare(
  `SELECT u.username, s.movies_completed, s.movies_dropped, s.friends_made
   FROM user_stats s JOIN users u ON u.id = s.user_id`).all());

console.log("\n== Taste matches for alex (Jaccard similarity of liked movies) ==");
console.table(db.prepare(
  `SELECT u.username AS match_with, COUNT(*) AS shared_likes,
          ROUND(100.0 * COUNT(*) /
            ((SELECT COUNT(*) FROM user_movies WHERE user_id = :me AND liked = 1)
             + (SELECT COUNT(*) FROM user_movies WHERE user_id = o.user_id AND liked = 1)
             - COUNT(*)), 1) AS similarity_pct
   FROM user_movies mine
   JOIN user_movies o ON o.tmdb_id = mine.tmdb_id AND o.liked = 1 AND o.user_id <> :me
   JOIN users u ON u.id = o.user_id
   WHERE mine.user_id = :me AND mine.liked = 1
   GROUP BY o.user_id ORDER BY similarity_pct DESC`).all({ me: 1 }));