require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { pool, initDb } = require('./db');

const app = express();
app.use(express.json({ limit: '12mb' })); // las fotos y videos van en base64, necesitan más espacio que el default
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'yasminedgar2026';

function requireAdmin(req, res, next) {
  const supplied = req.headers['x-admin-password'];
  if (supplied && supplied === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'invitado';
}

/* ---------- LOGIN DEL PANEL ---------- */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  return res.status(401).json({ ok: false });
});

/* ---------- RUTAS PARA INVITADOS (públicas) ---------- */

// Obtener los datos de un invitado a partir de su link personalizado (?g=id)
app.get('/api/guests/:id', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT g.*, t.name AS table_name
    FROM guests g
    LEFT JOIN event_tables t ON t.id = g.table_id
    WHERE g.id = $1
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Invitación no encontrada' });
  res.json(rows[0]);
});

// Confirmar asistencia de un invitado con link personalizado
app.post('/api/guests/:id/rsvp', async (req, res) => {
  const { attending, count } = req.body || {};
  if (typeof attending !== 'boolean') return res.status(400).json({ error: 'Falta el campo attending' });
  const { rows } = await pool.query(
    `UPDATE guests
     SET status = $1, responded_count = $2, responded_at = now()
     WHERE id = $3
     RETURNING *`,
    [attending ? 'yes' : 'no', attending ? (count || 1) : 0, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Invitación no encontrada' });
  res.json(rows[0]);
});

// RSVP anónimo (cuando alguien entra sin link personalizado)
app.post('/api/rsvp', async (req, res) => {
  const { name, count, attending } = req.body || {};
  if (!name || typeof attending !== 'boolean') return res.status(400).json({ error: 'Datos incompletos' });
  const { rows } = await pool.query(
    `INSERT INTO rsvp_anonimo (name, count, attending) VALUES ($1, $2, $3) RETURNING *`,
    [name, count || 1, attending]
  );
  res.json(rows[0]);
});

/* ---------- RUTAS DEL PANEL (protegidas con contraseña) ---------- */

app.post('/api/admin/guests', requireAdmin, async (req, res) => {
  const { name, passes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Falta el nombre' });
  const passCount = Math.max(1, parseInt(passes, 10) || 1);
  const id = slugify(name) + '-' + crypto.randomBytes(3).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO guests (id, name, passes) VALUES ($1, $2, $3) RETURNING *`,
    [id, name, passCount]
  );
  res.json(rows[0]);
});

app.get('/api/admin/guests', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT g.*, t.name AS table_name
    FROM guests g
    LEFT JOIN event_tables t ON t.id = g.table_id
    ORDER BY g.created_at DESC
  `);
  res.json(rows);
});

app.delete('/api/admin/guests/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM guests WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/admin/guests/:id/table', requireAdmin, async (req, res) => {
  const { table_id } = req.body || {};
  const { rows } = await pool.query(
    'UPDATE guests SET table_id = $1 WHERE id = $2 RETURNING *',
    [table_id || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Invitado no encontrado' });
  res.json(rows[0]);
});

app.get('/api/admin/rsvp', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM rsvp_anonimo ORDER BY created_at DESC');
  res.json(rows);
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const guests = await pool.query('SELECT status, passes, responded_count FROM guests');
  const anon = await pool.query('SELECT attending, count FROM rsvp_anonimo');

  const g = guests.rows;
  const a = anon.rows;

  const confirmed = g.filter(x => x.status === 'yes').length + a.filter(x => x.attending).length;
  const declined = g.filter(x => x.status === 'no').length + a.filter(x => !x.attending).length;
  const pending = g.filter(x => x.status === 'pending').length;
  const people = g.filter(x => x.status === 'yes').reduce((s, x) => s + (x.responded_count || 0), 0)
    + a.filter(x => x.attending).reduce((s, x) => s + (x.count || 0), 0);
  const passesIssued = g.reduce((s, x) => s + (x.passes || 0), 0);

  res.json({
    confirmed, declined, pending, people, passesIssued,
    totalGuests: g.length, totalAnon: a.length
  });
});

/* ---------- MESAS (gestión de mesas) ---------- */

app.get('/api/admin/tables', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT t.*, COUNT(g.id) FILTER (WHERE g.status = 'yes') AS assigned_confirmed,
           COALESCE(SUM(g.responded_count) FILTER (WHERE g.status = 'yes'), 0) AS seats_taken
    FROM event_tables t
    LEFT JOIN guests g ON g.table_id = t.id
    GROUP BY t.id
    ORDER BY t.name ASC
  `);
  res.json(rows);
});

app.post('/api/admin/tables', requireAdmin, async (req, res) => {
  const { name, capacity } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Falta el nombre de la mesa' });
  const { rows } = await pool.query(
    'INSERT INTO event_tables (name, capacity) VALUES ($1, $2) RETURNING *',
    [name, Math.max(1, parseInt(capacity, 10) || 8)]
  );
  res.json(rows[0]);
});

app.delete('/api/admin/tables/:id', requireAdmin, async (req, res) => {
  await pool.query('UPDATE guests SET table_id = NULL WHERE table_id = $1', [req.params.id]);
  await pool.query('DELETE FROM event_tables WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- LIBRO DE FIRMAS (público) ---------- */

app.get('/api/guestbook', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM guestbook ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});

app.post('/api/guestbook', async (req, res) => {
  const { name, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: 'Faltan datos' });
  const { rows } = await pool.query(
    'INSERT INTO guestbook (name, message) VALUES ($1, $2) RETURNING *',
    [String(name).slice(0, 100), String(message).slice(0, 500)]
  );
  res.json(rows[0]);
});

app.delete('/api/admin/guestbook/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM guestbook WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- FOTOS COMPARTIDAS (público para subir, todos pueden ver) ---------- */

app.get('/api/photos', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, guest_name, caption, image_data, created_at FROM photos ORDER BY created_at DESC LIMIT 100'
  );
  res.json(rows);
});

app.post('/api/photos', async (req, res) => {
  const { guest_name, caption, image_data } = req.body || {};
  const isImage = image_data && image_data.startsWith('data:image/');
  const isVideo = image_data && image_data.startsWith('data:video/');
  if (!isImage && !isVideo) {
    return res.status(400).json({ error: 'Archivo inválido' });
  }
  const maxBytes = isVideo ? 9_000_000 : 4_000_000; // los videos ya vienen limitados a ~5MB crudos desde el navegador
  if (image_data.length > maxBytes) {
    return res.status(413).json({ error: 'El archivo es demasiado pesado' });
  }
  const { rows } = await pool.query(
    'INSERT INTO photos (guest_name, caption, image_data) VALUES ($1, $2, $3) RETURNING id, guest_name, caption, created_at',
    [guest_name ? String(guest_name).slice(0, 100) : null, caption ? String(caption).slice(0, 200) : null, image_data]
  );
  res.json(rows[0]);
});

app.delete('/api/admin/photos/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM photos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Cualquier ruta que no sea /api sirve la invitación (deja que el front maneje ?g=)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No encontrado' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
  })
  .catch(err => {
    console.error('Error al iniciar la base de datos:', err);
    process.exit(1);
  });
