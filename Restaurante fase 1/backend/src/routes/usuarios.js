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
  return { nombre, email, password, rol: b.rol };
}

r.get('/', asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol FROM usuarios WHERE activo = TRUE ORDER BY nombre');
  res.json(rows);
}));

r.post('/', asyncH(async (req, res) => {
  const u = leer(req.body, true);
  const hash = await bcrypt.hash(u.password, 10);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
    [u.nombre, u.email, hash, u.rol]);
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
