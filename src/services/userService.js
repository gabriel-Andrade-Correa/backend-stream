const { getDb } = require('../config/db');

async function getPreferences(userId = 1) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM preferences WHERE user_id = ?', [userId]);

  return {
    userId,
    favoriteGenre: row?.favorite_genre || 'Action',
    theme: row?.theme || 'dark',
    selectedPlatforms: JSON.parse(row?.selected_platforms || '[]')
  };
}

async function updatePreferences({ userId = 1, favoriteGenre, theme, selectedPlatforms }) {
  const db = await getDb();

  const current = await getPreferences(userId);
  const next = {
    favoriteGenre: favoriteGenre || current.favoriteGenre,
    theme: theme || current.theme,
    selectedPlatforms: selectedPlatforms || current.selectedPlatforms
  };

  await db.run(
    `UPDATE preferences
      SET favorite_genre = ?, theme = ?, selected_platforms = ?
      WHERE user_id = ?`,
    [next.favoriteGenre, next.theme, JSON.stringify(next.selectedPlatforms), userId]
  );

  return getPreferences(userId);
}

async function addSearchHistory(query, userId = 1) {
  const db = await getDb();
  await db.run('INSERT INTO search_history (user_id, query) VALUES (?, ?)', [userId, query]);
}

async function getRecentSearches(userId = 1) {
  const db = await getDb();
  return db.all(
    'SELECT query, created_at as createdAt FROM search_history WHERE user_id = ? ORDER BY id DESC LIMIT 10',
    [userId]
  );
}

module.exports = {
  getPreferences,
  updatePreferences,
  addSearchHistory,
  getRecentSearches
};
