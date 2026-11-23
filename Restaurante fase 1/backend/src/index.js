import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { aplicarEsquema } from './db.js';
import { crudRouter } from './routes/crud.js';
import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';
import insumosRoutes from './routes/insumos.js';
import platosRoutes from './routes/platos.js';
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
  if (err.code === '22P02') return res.status(400).json({ error: 'Alguno de los datos no tiene un formato válido.' });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un problema en el servidor. Intenta de nuevo.' });
});

await aplicarEsquema();
if (process.env.CARGAR_DATOS_EJEMPLO === 'true') console.log(await sembrar());

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Listo en http://localhost:${PORT}`));
