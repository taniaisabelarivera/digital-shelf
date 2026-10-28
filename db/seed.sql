-- Demo data
INSERT OR IGNORE INTO users (id, username, email, password_hash) VALUES
 (1,'alex','alex@csu.fullerton.edu','placeholder'),
 (2,'bree','bree@csu.fullerton.edu','placeholder'),
 (3,'cam','cam@csu.fullerton.edu','placeholder'),
 (4,'dani','dani@csu.fullerton.edu','placeholder');

-- TMDB ids: 603 Matrix, 27205 Inception, 157336 Interstellar, 155 Dark Knight,
--           129 Spirited Away, 496243 Parasite, 680 Pulp Fiction
INSERT OR IGNORE INTO user_movies (user_id, tmdb_id, status, liked, title) VALUES
 (1,603,'completed',1,'The Matrix'),(1,27205,'completed',1,'Inception'),
 (1,157336,'completed',1,'Interstellar'),(1,129,'dropped',0,'Spirited Away'),
 (2,603,'completed',1,'The Matrix'),(2,27205,'completed',1,'Inception'),
 (2,155,'completed',1,'The Dark Knight'),
 (3,129,'completed',1,'Spirited Away'),(3,496243,'completed',1,'Parasite'),
 (4,603,'completed',1,'The Matrix'),(4,157336,'completed',1,'Interstellar'),
 (4,27205,'completed',1,'Inception'),(4,680,'completed',1,'Pulp Fiction');

INSERT OR IGNORE INTO friendships (requester_id, addressee_id, status) VALUES (1,2,'accepted');