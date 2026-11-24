import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { asyncH, auth } from '../middleware/auth.js';

const r = Router();
const datos = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol });
const sesion = (u) => jwt.sign(datos(u), process.env.JWT_SECRET, { expiresIn: '12h' });

r.post('/login', asyncH(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  const respuesta = { token: sesion(u), usuario: datos(u) };
  // Cuando el administrador entra con contraseña, ese navegador queda autorizado para entrar con PIN
  if (u.rol === 'admin') {
    respuesta.dispositivo = jwt.sign({ tipo: 'dispositivo', por: u.id }, process.env.JWT_SECRET, { expiresIn: '180d' });
  }
  res.json(respuesta);
}));

// Freno contra quien intente adivinar PINs: 5 intentos fallidos seguidos bloquean 1 minuto
const fallos = new Map(); // clave -> { n, hasta }
const MAX_FALLOS = 5;
const BLOQUEO_MS = 60_000;

r.post('/pin', asyncH(async (req, res) => {
  const pin = String(req.body.pin || '');
  let disp;
  try {
    disp = jwt.verify(String(req.body.dispositivo || ''), process.env.JWT_SECRET);
    if (disp.tipo !== 'dispositivo') throw new Error();
  } catch {
    return res.status(401).json({ error: 'Este equipo ya no está autorizado. El administrador debe entrar con su contraseña.', dispositivo_invalido: true });
  }
  const clave = `${req.ip}|${disp.por}`;
  const f = fallos.get(clave);
  if (f && f.hasta > Date.now()) {
    const seg = Math.ceil((f.hasta - Date.now()) / 1000);
    return res.status(429).json({ error: `Demasiados intentos. Espera ${seg} segundos.` });
  }
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'El PIN tiene 4 números.' });

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE activo = TRUE AND pin_hash IS NOT NULL');
  let u = null;
  for (const x of rows) if (await bcrypt.compare(pin, x.pin_hash)) { u = x; break; }
  if (!u) {
    const n = (f && f.hasta ? 0 : f?.n || 0) + 1; // si ya pasó un bloqueo, empieza a contar de nuevo
    fallos.set(clave, { n, hasta: n >= MAX_FALLOS ? Date.now() + BLOQUEO_MS : 0 });
    return res.status(401).json({ error: 'PIN incorrecto.' });
  }
  fallos.delete(clave);
  res.json({ token: sesion(u), usuario: datos(u) });
}));

r.get('/me', auth, (req, res) => {
  const { id, nombre, email, rol } = req.usuario;
  res.json({ usuario: { id, nombre, email, rol } });
});

export default r;
