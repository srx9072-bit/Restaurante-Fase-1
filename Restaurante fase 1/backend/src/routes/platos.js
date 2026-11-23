import { Router } from 'express';
import { pool, conTransaccion, insertarVarios } from '../db.js';
import { asyncH, auth, roles, falla, validarId } from '../middleware/auth.js';

const r = Router();
r.use(auth);
r.param('id', validarId);

const EPS = 1e-9; // evita errores de redondeo con decimales

// Devuelve los platos con su receta y si se pueden servir según el stock actual
async function cargarPlatos() {
  const { rows: platos } = await pool.query(
    'SELECT id, nombre, descripcion, categoria, precio FROM platos WHERE activo = TRUE ORDER BY categoria, nombre');
  const { rows: rec } = await pool.query(
    `SELECT pi.plato_id, pi.insumo_id, pi.cantidad, i.nombre, i.unidad, i.stock, i.activo
     FROM plato_ingredientes pi JOIN insumos i ON i.id = pi.insumo_id`);

  return platos.map((p) => {
    const ingredientes = rec
      .filter((x) => x.plato_id === p.id)
      .map((x) => ({
        insumo_id: x.insumo_id, nombre: x.nombre, unidad: x.unidad,
        cantidad: Number(x.cantidad), stock: x.activo ? Number(x.stock) : 0,
      }));
    const faltantes = ingredientes.filter((i) => i.stock + EPS < i.cantidad);
    const porciones = ingredientes.length
      ? Math.min(...ingredientes.map((i) => Math.floor(i.stock / i.cantidad + EPS)))
      : null; // sin receta: no se puede calcular
    return { ...p, precio: Number(p.precio), ingredientes, faltantes, porciones, disponible: faltantes.length === 0 };
  });
}

function leerPlato(b) {
  const nombre = String(b.nombre || '').trim();
  if (!nombre) throw falla(400, 'Escribe el nombre del plato.');
  const precio = Number(b.precio);
  if (!Number.isFinite(precio) || precio < 0) throw falla(400, 'El precio no es válido.');
  const ing = Array.isArray(b.ingredientes) ? b.ingredientes : [];
  const vistos = new Set();
  for (const x of ing) {
    const id = Number(x.insumo_id);
    if (!id) throw falla(400, 'Elige el ingrediente en cada fila de la receta.');
    if (!(Number(x.cantidad) > 0)) throw falla(400, 'La cantidad de cada ingrediente debe ser mayor que 0.');
    if (vistos.has(id)) throw falla(400, 'Hay un ingrediente repetido en la receta.');
    vistos.add(id);
  }
  return {
    nombre,
    descripcion: String(b.descripcion || '').trim() || null,
    categoria: String(b.categoria || '').trim() || 'General',
    precio,
    ingredientes: ing.map((x) => [Number(x.insumo_id), Number(x.cantidad)]),
  };
}

async function guardarReceta(db, platoId, ingredientes) {
  await db.query('DELETE FROM plato_ingredientes WHERE plato_id = $1', [platoId]);
  await insertarVarios(db, 'plato_ingredientes', ['plato_id', 'insumo_id', 'cantidad'],
    ingredientes.map(([insumo, cant]) => [platoId, insumo, cant]));
}

r.get('/', asyncH(async (req, res) => res.json(await cargarPlatos())));

r.post('/', roles('admin'), asyncH(async (req, res) => {
  const p = leerPlato(req.body);
  const id = await conTransaccion(async (db) => {
    const { rows } = await db.query(
      'INSERT INTO platos (nombre, descripcion, categoria, precio) VALUES ($1, $2, $3, $4) RETURNING id',
      [p.nombre, p.descripcion, p.categoria, p.precio]);
    await guardarReceta(db, rows[0].id, p.ingredientes);
    return rows[0].id;
  });
  res.status(201).json({ id });
}));

r.put('/:id', roles('admin'), asyncH(async (req, res) => {
  const p = leerPlato(req.body);
  await conTransaccion(async (db) => {
    const rs = await db.query(
      'UPDATE platos SET nombre = $1, descripcion = $2, categoria = $3, precio = $4 WHERE id = $5 AND activo = TRUE',
      [p.nombre, p.descripcion, p.categoria, p.precio, req.params.id]);
    if (!rs.rowCount) throw falla(404, 'No se encontró el plato.');
    await guardarReceta(db, req.params.id, p.ingredientes);
  });
  res.json({ ok: true });
}));

r.delete('/:id', roles('admin'), asyncH(async (req, res) => {
  await pool.query('UPDATE platos SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

export default r;
