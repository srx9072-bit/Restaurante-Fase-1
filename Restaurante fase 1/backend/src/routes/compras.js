import { Router } from 'express';
import { pool, conTransaccion, insertarVarios } from '../db.js';
import { asyncH, auth, roles, falla, validarId } from '../middleware/auth.js';

const r = Router();
r.use(auth, roles('admin'));
r.param('id', validarId);

const MAX = 1000000;
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

// Historial: las últimas 100 compras
r.get('/', asyncH(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.total, c.notas, c.creado_en, pr.nombre AS proveedor, u.nombre AS usuario,
            (SELECT COUNT(*) FROM compra_items WHERE compra_id = c.id) AS productos
     FROM compras c
     LEFT JOIN proveedores pr ON pr.id = c.proveedor_id
     LEFT JOIN usuarios u ON u.id = c.usuario_id
     ORDER BY c.id DESC LIMIT 100`);
  res.json(rows.map((x) => ({ ...x, productos: Number(x.productos) })));
}));

r.get('/:id', asyncH(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, pr.nombre AS proveedor, u.nombre AS usuario
     FROM compras c LEFT JOIN proveedores pr ON pr.id = c.proveedor_id LEFT JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.id = $1`, [req.params.id]);
  if (!rows[0]) throw falla(404, 'No se encontró la compra.');
  const { rows: items } = await pool.query(
    'SELECT id, insumo_id, nombre, unidad, cantidad, costo_unitario, subtotal FROM compra_items WHERE compra_id = $1 ORDER BY id',
    [req.params.id]);
  res.json({ ...rows[0], items });
}));

// Confirmar compra: suma cada cantidad al stock, deja el costo nuevo en el insumo y lo registra en movimientos
r.post('/', asyncH(async (req, res) => {
  const b = req.body;
  const proveedorId = Number(b.proveedor_id);
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) throw falla(400, 'Elige el proveedor.');
  const notas = String(b.notas || '').trim().slice(0, 255) || null;
  const lineas = Array.isArray(b.items) ? b.items : [];
  if (!lineas.length) throw falla(400, 'Agrega al menos un producto a la compra.');
  if (lineas.length > 200) throw falla(400, 'Son demasiados productos para una sola compra.');

  const vistos = new Set();
  const limpias = lineas.map((l) => {
    const id = Number(l.insumo_id);
    const cantidad = Number(l.cantidad);
    const costo = Number(l.costo_unitario);
    if (!Number.isInteger(id) || id <= 0) throw falla(400, 'Hay un producto no válido en la compra.');
    if (vistos.has(id)) throw falla(400, 'Hay un producto repetido. Junta las cantidades en una sola fila.');
    vistos.add(id);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > MAX) throw falla(400, 'Cada producto necesita una cantidad mayor que 0.');
    if (l.costo_unitario === '' || l.costo_unitario == null || !Number.isFinite(costo) || costo < 0 || costo > MAX) {
      throw falla(400, 'Escribe el costo de cada producto (puede ser 0).');
    }
    return { id, cantidad: r2(cantidad), costo: r4(costo) };
  });

  const compra = await conTransaccion(async (db) => {
    const { rowCount } = await db.query('SELECT 1 FROM proveedores WHERE id = $1 AND activo = TRUE', [proveedorId]);
    if (!rowCount) throw falla(400, 'El proveedor elegido ya no existe.');
    const ids = limpias.map((l) => l.id).sort((a, c) => a - c);
    const { rows: insumos } = await db.query(
      'SELECT id, nombre, unidad, stock FROM insumos WHERE id = ANY($1) AND activo = TRUE ORDER BY id FOR UPDATE', [ids]);
    if (insumos.length !== ids.length) throw falla(400, 'Alguno de los productos ya no está en el inventario. Actualiza e inténtalo de nuevo.');
    const porId = new Map(insumos.map((i) => [i.id, i]));

    const filas = limpias.map((l) => ({ ...l, ins: porId.get(l.id), subtotal: r2(l.cantidad * l.costo) }));
    const total = r2(filas.reduce((s, f) => s + f.subtotal, 0));
    const { rows: [c] } = await db.query(
      'INSERT INTO compras (proveedor_id, total, notas, usuario_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [proveedorId, total, notas, req.usuario.id]);
    await insertarVarios(db, 'compra_items', ['compra_id', 'insumo_id', 'nombre', 'unidad', 'cantidad', 'costo_unitario', 'subtotal'],
      filas.map((f) => [c.id, f.id, f.ins.nombre, f.ins.unidad, f.cantidad, f.costo, f.subtotal]));
    for (const f of filas) {
      const nuevo = r2(Number(f.ins.stock) + f.cantidad);
      await db.query('UPDATE insumos SET stock = $1, costo = $2 WHERE id = $3', [nuevo, f.costo, f.id]);
      await db.query(
        `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, stock_resultante, nota, usuario_id)
         VALUES ($1, 'entrada', $2, $3, $4, $5)`,
        [f.id, f.cantidad, nuevo, `Compra #${c.id}`, req.usuario.id]);
    }
    return { id: c.id, total };
  });
  res.status(201).json(compra);
}));

export default r;
