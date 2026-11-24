import { pool, insertarVarios } from '../db.js';
import { asyncH, roles, falla } from '../middleware/auth.js';
import { crudRouter } from './crud.js';

const r = crudRouter({
  tabla: 'mesas',
  campos: ['nombre', 'capacidad'],
  requeridos: { nombre: 'el nombre de la mesa' },
  numericos: ['capacidad'],
  orden: 'id',
  escribir: ['admin'],
});

// Estado de cada mesa: ocupada si tiene pedidos abiertos (sin cancelar y sin terminar de entregar y cobrar)
r.get('/estado', asyncH(async (req, res) => {
  const { rows: mesas } = await pool.query('SELECT id, nombre, capacidad FROM mesas WHERE activo = TRUE ORDER BY id');
  const { rows: abiertos } = await pool.query(
    `SELECT p.id, p.mesa_id, p.estado, p.total, p.pagado, p.creado_en, u.nombre AS atendio
     FROM pedidos p LEFT JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.mesa_id IS NOT NULL AND p.estado <> 'cancelado' AND NOT (p.estado = 'entregado' AND p.pagado)
     ORDER BY p.creado_en`);
  res.json(mesas.map((m) => {
    const pedidos = abiertos.filter((p) => p.mesa_id === m.id);
    const porCobrar = pedidos.filter((p) => !p.pagado).reduce((s, p) => s + Number(p.total), 0);
    return { ...m, ocupada: pedidos.length > 0, desde: pedidos[0]?.creado_en ?? null, por_cobrar: Math.round(porCobrar * 100) / 100, pedidos };
  }));
}));

// Agrega varias mesas de una vez (Mesa 1, Mesa 2...), continuando la numeración
r.post('/lote', roles('admin'), asyncH(async (req, res) => {
  const cantidad = Number(req.body.cantidad);
  const capacidad = req.body.capacidad === undefined || req.body.capacidad === '' ? 4 : Number(req.body.capacidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) throw falla(400, 'Escribe cuántas mesas quieres agregar (de 1 a 50).');
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 50) throw falla(400, 'La capacidad de cada mesa no es válida.');
  const { rows } = await pool.query('SELECT nombre FROM mesas WHERE activo = TRUE');
  const numeros = rows.map((x) => /^Mesa (\d+)$/.exec(x.nombre)).filter(Boolean).map((m) => Number(m[1]));
  const inicio = (numeros.length ? Math.max(...numeros) : 0) + 1;
  await insertarVarios(pool, 'mesas', ['nombre', 'capacidad'],
    Array.from({ length: cantidad }, (_, i) => [`Mesa ${inicio + i}`, capacidad]));
  res.status(201).json({ creadas: cantidad, desde: inicio });
}));

export default r;
