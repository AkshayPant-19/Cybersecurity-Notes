const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'cybersec.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    visit_date DATE NOT NULL,
    UNIQUE(user_id, visit_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    section_id TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    UNIQUE(user_id, section_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  saveDb();
  return db;
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function prepare(sql) {
  return {
    run: (...params) => {
      db.run(sql, params);
      saveDb();
      return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] };
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const obj = {};
        cols.forEach((c, i) => { obj[c] = vals[i]; });
        return obj;
      }
      stmt.free();
      return undefined;
    },
    all: (...params) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const obj = {};
        cols.forEach((c, i) => { obj[c] = vals[i]; });
        results.push(obj);
      }
      stmt.free();
      return results;
    }
  };
}

// Wrapper to match the original API
const database = {
  insertUser: { run: (username, email, password) => prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, password) },
  findUserByUsername: { get: (username) => prepare('SELECT * FROM users WHERE username = ?').get(username) },
  findUserByEmail: { get: (email) => prepare('SELECT * FROM users WHERE email = ?').get(email) },
  findUserById: { get: (id) => prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(id) },
  addVisit: { run: (userId, date) => prepare('INSERT OR IGNORE INTO streaks (user_id, visit_date) VALUES (?, ?)').run(userId, date) },
  getStreaks: { all: (userId) => prepare('SELECT visit_date FROM streaks WHERE user_id = ? ORDER BY visit_date DESC').all(userId) },
  getTotalVisits: { get: (userId) => prepare('SELECT COUNT(DISTINCT visit_date) as count FROM streaks WHERE user_id = ?').get(userId) },
  upsertProgress: { run: (userId, sectionId, completed) => prepare('INSERT OR REPLACE INTO progress (user_id, section_id, completed) VALUES (?, ?, ?)').run(userId, sectionId, completed) },
  getProgress: { all: (userId) => prepare('SELECT section_id, completed FROM progress WHERE user_id = ?').all(userId) }
};

module.exports = { initDatabase, database, saveDb };
