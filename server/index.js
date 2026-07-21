const { app, ensureDb } = require('./app');
const PORT = process.env.PORT || 3000;

async function start() {
  await ensureDb();
  app.listen(PORT, () => {
    console.log(`Cybersecurity Notes app running on http://localhost:${PORT}`);
  });
}

start();
