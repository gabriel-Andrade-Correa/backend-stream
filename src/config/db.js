const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let db;

async function initDb() {
  if (db) return db;

  db = await open({
    filename: path.join(__dirname, '..', 'db', 'streamhub.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      user_id INTEGER PRIMARY KEY,
      favorite_genre TEXT DEFAULT 'Action',
      theme TEXT DEFAULT 'dark',
      selected_platforms TEXT DEFAULT '[]',
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  const user = await db.get('SELECT id FROM users WHERE id = 1');
  if (!user) {
    await db.run('INSERT INTO users (id, name) VALUES (1, ?)', ['Usuário StreamHub']);
    await db.run(
      'INSERT INTO preferences (user_id, favorite_genre, theme, selected_platforms) VALUES (1, ?, ?, ?)',
      ['Action', 'dark', JSON.stringify(['Netflix', 'Prime Video'])]
    );
  }

  return db;
}

async function getDb() {
  if (!db) {
    await initDb();
  }
  return db;
}

module.exports = { initDb, getDb };
