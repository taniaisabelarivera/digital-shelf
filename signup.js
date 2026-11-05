import express from 'express';
import sqlite3 from 'sqlite3';

const app = express();
const db = new sqlite3.Database('usersdata.db');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;

  db.run(
    'INSERT INTO UsersData (name, email, password) VALUES (?, ?, ?)',
    [username, email.toLowerCase(), password],
    function (err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).send('This email is already associated with another account.');
        }
        console.error(err);
        return res.status(500).send('Something went wrong.');
      }
      res.send('Account created!');
    }
  );
});

// app.listen(3000, () => console.log('Running at http://localhost:3000'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));