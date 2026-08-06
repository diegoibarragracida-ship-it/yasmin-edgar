const { Pool } = require('pg');

// Render inyecta DATABASE_URL automáticamente si conectas una base de datos Postgres.
// En local puedes poner tu propia cadena de conexión en un archivo .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_tables (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 8,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      passes INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | yes | no
      responded_count INTEGER,
      table_id INTEGER REFERENCES event_tables(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      responded_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rsvp_anonimo (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      attending BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guestbook (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      guest_name TEXT,
      caption TEXT,
      image_data TEXT NOT NULL, -- imagen en base64 (data URL)
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  console.log('Base de datos lista ✅');
}

module.exports = { pool, initDb };
