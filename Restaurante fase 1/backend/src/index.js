import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, aplicarEsquema } from './db.js';
import { crudRouter } from './routes/crud.js';
import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';
import insumosRoutes from './routes/insumos.js';
import platosRoutes from './routes/platos.js';
import pedidosRoutes from './routes/pedidos.js';
import mesasRoutes from './routes/mesas.js';
import cajaRoutes from './routes/caja.js';
import reportesRoutes from './routes/reportes.js';
import comprasRoutes from './routes/compras.js';
import { sembrar } from './seed.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET. Copia .env.example a .env y complétalo.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/platos', platosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/mesas', mesasRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/proveedores', crudRouter({
  tabla: 'proveedores',
  campos: ['nombre', 'contacto', 'telefono', 'email', 'direccion'],
  requeridos: { nombre: 'el nombre del proveedor' },
  escribir: ['admin'],
}));
app.use('/api/clientes', crudRouter({
  tabla: 'clientes',
  campos: ['nombre', 'telefono', 'email', 'notas'],
  requeridos: { nombre: 'el nombre del cliente' },
  escribir: ['admin', 'cajero'],
}));

// En producción el mismo servidor entrega la interfaz (frontend/dist)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con ese dato (por ejemplo, el correo).' });
  if (err.code === '23503') return res.status(400).json({ error: 'Alguno de los datos elegidos ya no existe.' });
  if (err.code === '23514') return res.status(400).json({ error: 'Alguno de los datos no es válido.' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Alguno de los datos no tiene un formato válido.' });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un problema en el servidor. Intenta de nuevo.' });
});

await aplicarEsquema();
// REINICIAR_DATOS=true borra TODO (pedidos, cajas, inventario, usuarios...) y carga la carta de ejemplo.
// Sirve para pasar la demo a la carta nueva. Quita la variable después del primer arranque.
if (process.env.REINICIAR_DATOS === 'true') {
  console.log(await sembrar({ reset: true }));
  console.log('Datos reiniciados. Quita REINICIAR_DATOS de las variables de entorno para que no se borre todo en cada arranque.');
} else if (process.env.CARGAR_DATOS_EJEMPLO === 'true') {
  console.log(await sembrar());
}

// Recuperación: si defines NUEVA_CLAVE_ADMIN, esa pasa a ser la clave de admin@restaurante.com
// (la crea si no existe). Quita la variable después de entrar, para que no se repita en cada arranque.
const nuevaClave = (process.env.NUEVA_CLAVE_ADMIN || '').trim();
if (process.env.NUEVA_CLAVE_ADMIN) {
  if (nuevaClave.length < 6) {
    console.log('NUEVA_CLAVE_ADMIN debe tener al menos 6 caracteres. No se cambió nada.');
  } else {
    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Administrador', 'admin@restaurante.com', $1, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'admin', activo = TRUE`,
      [await bcrypt.hash(nuevaClave, 10)]);
    console.log('Clave del administrador restablecida. Quita NUEVA_CLAVE_ADMIN de las variables de entorno.');
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Listo en http://localhost:${PORT}`));
