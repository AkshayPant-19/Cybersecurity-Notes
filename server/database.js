const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cybersec',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS streaks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visit_date DATE NOT NULL,
        UNIQUE(user_id, visit_date)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        section_id TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        UNIQUE(user_id, section_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        section_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database tables ready');
  } finally {
    client.release();
  }
}

function query(text, params) {
  return pool.query(text, params);
}

const database = {
  findUserByUsername: { get: async (username) => { const r = await query('SELECT * FROM users WHERE username = $1', [username]); return r.rows[0]; } },
  findUserByEmail: { get: async (email) => { const r = await query('SELECT * FROM users WHERE email = $1', [email]); return r.rows[0]; } },
  findUserById: { get: async (id) => { const r = await query('SELECT id, username, email, created_at FROM users WHERE id = $1', [id]); return r.rows[0]; } },
  insertUser: { run: async (username, email, password) => { const r = await query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id', [username, email, password]); return r.rows[0]; } },
  addVisit: { run: async (userId, date) => { await query('INSERT INTO streaks (user_id, visit_date) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, date]); } },
  getStreaks: { all: async (userId) => { const r = await query('SELECT visit_date FROM streaks WHERE user_id = $1 ORDER BY visit_date DESC', [userId]); return r.rows; } },
  getTotalVisits: { get: async (userId) => { const r = await query('SELECT COUNT(DISTINCT visit_date) as count FROM streaks WHERE user_id = $1', [userId]); return { count: parseInt(r.rows[0].count, 10) }; } },
  upsertProgress: { run: async (userId, sectionId, completed) => { await query('INSERT INTO progress (user_id, section_id, completed) VALUES ($1, $2, $3) ON CONFLICT (user_id, section_id) DO UPDATE SET completed = $3', [userId, sectionId, completed]); } },
  getProgress: { all: async (userId) => { const r = await query('SELECT section_id, completed FROM progress WHERE user_id = $1', [userId]); return r.rows; } },
  saveQuizScore: { run: async (userId, sectionId, score, total) => { await query('INSERT INTO quiz_scores (user_id, section_id, score, total) VALUES ($1, $2, $3, $4)', [userId, sectionId, score, total]); } },
  getQuizScores: { all: async (userId) => { const r = await query('SELECT section_id, score, total, taken_at FROM quiz_scores WHERE user_id = $1 ORDER BY taken_at DESC', [userId]); return r.rows; } },
  getBestQuizScore: { get: async (userId, sectionId) => { const r = await query('SELECT score, total, taken_at FROM quiz_scores WHERE user_id = $1 AND section_id = $2 ORDER BY score DESC LIMIT 1', [userId, sectionId]); return r.rows[0] || null; } }
};

module.exports = { initDatabase, database, pool };
