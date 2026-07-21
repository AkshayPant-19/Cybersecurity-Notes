const { app, ensureDb } = require('../server/app');

// Initialize DB on first request
let initialized = false;
async function handler(req, res) {
  if (!initialized) {
    try { await ensureDb(); } catch (e) { console.error('DB init error:', e.message); }
    initialized = true;
  }
  return app(req, res);
}

module.exports = handler;
