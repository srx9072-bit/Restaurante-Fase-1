import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { asyncH, auth } from '../middleware/auth.js';

const r = Router();

r.post('/login', asyncH(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  const usuario = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  const token = jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, usuario });
}));

r.get('/me', auth, (req, res) => {
  const { id, nombre, email, rol } = req.usuario;
  res.json({ usuario: { id, nombre, email, rol } });
});

export default r;
