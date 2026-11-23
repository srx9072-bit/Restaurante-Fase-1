import jwt from 'jsonwebtoken';

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const falla = (status, mensaje) => Object.assign(new Error(mensaje), { status });

// Evita errores si alguien escribe una dirección con un id que no es número
export const validarId = (req, res, next, id) =>
  /^\d+$/.test(id) ? next() : res.status(404).json({ error: 'No se encontró el registro.' });

export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Tu sesión venció. Inicia sesión de nuevo.' });
  }
}

export const roles = (...permitidos) => (req, res, next) =>
  permitidos.includes(req.usuario.rol)
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para hacer esto.' });
