import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { asyncH, auth, roles, falla, validarId } from '../middleware/auth.js';

const r = Router();
r.use(auth, roles('admin'));
r.param('id', validarId);
const ROLES = ['admin', 'cajero', 'cocina'];

function leer(b, esNuevo) {
  const nombre = String(b.nombre || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!nombre) throw falla(400, 'Escribe el nombre.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw falla(400, 'Escribe un correo válido.');
  if (!ROLES.includes(b.rol)) throw falla(400, 'Elige un rol.');
  if ((esNuevo || password) && password.length < 6) throw falla(400, 'La contraseña debe tener al menos 6 caracteres.');
  const pin = String(b.pin ?? '').trim();
  if (pin && !/^\d{4}$/.test(pin)) throw falla(400, 'El PIN debe tener exactamente 4 números.');
  return { nombre, email, password, rol: b.rol, pin, quitarPin: b.quitar_pin === true };
}

// Dos personas no pueden tener el mismo PIN: el PIN es lo único que las distingue al cambiar de usuario
async function revisarPinLibre(pin, idPropio) {
  const { rows } = await pool.query(
    'SELECT id, pin_hash FROM usuarios WHERE activo = TRUE AND pin_hash IS NOT NULL AND id <> $1', [idPropio || 0]);
  for (const x of rows) if (await bcrypt.compare(pin, x.pin_hash)) throw falla(409, 'Ese PIN ya lo usa otra persona. Elige otro.');
}

r.get('/', asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol, (pin_hash IS NOT NULL) AS tiene_pin FROM usuarios WHERE activo = TRUE ORDER BY nombre');
  res.json(rows);
}));

r.post('/', asyncH(async (req, res) => {
  const u = leer(req.body, true);
  if (u.pin) await revisarPinLibre(u.pin);
  const hash = await bcrypt.hash(u.password, 10);
  const pinHash = u.pin ? await bcrypt.hash(u.pin, 10) : null;
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol, pin_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [u.nombre, u.email, hash, u.rol, pinHash]);
  res.status(201).json({ id: rows[0].id });
}));

r.put('/:id', asyncH(async (req, res) => {
  const u = leer(req.body, false);
  if (Number(req.params.id) === req.usuario.id && u.rol !== 'admin') {
    throw falla(400, 'No puedes quitarte a ti mismo el rol de administrador.');
  }
  const sets = ['nombre', 'email', 'rol'];
  const vals = [u.nombre, u.email, u.rol];
  if (u.password) { sets.push('password_hash'); vals.push(await bcrypt.hash(u.password, 10)); }
  if (u.pin) {
    await revisarPinLibre(u.pin, Number(req.params.id));
    sets.push('pin_hash'); vals.push(await bcrypt.hash(u.pin, 10));
  } else if (u.quitarPin) {
    sets.push('pin_hash'); vals.push(null);
  }
  const rs = await pool.query(
    `UPDATE usuarios SET ${sets.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${sets.length + 1} AND activo = TRUE`,
    [...vals, req.params.id]);
  if (!rs.rowCount) throw falla(404, 'No se encontró el usuario.');
  res.json({ ok: true });
}));

r.delete('/:id', asyncH(async (req, res) => {
  if (Number(req.params.id) === req.usuario.id) throw falla(400, 'No puedes quitar tu propio usuario.');
  await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

export default r;
