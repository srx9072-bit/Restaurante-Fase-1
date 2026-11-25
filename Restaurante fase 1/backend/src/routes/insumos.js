import { conTransaccion } from '../db.js';
import { asyncH, roles, falla } from '../middleware/auth.js';
import { crudRouter } from './crud.js';

const r = crudRouter({
  tabla: 'insumos',
  campos: ['nombre', 'unidad', 'stock', 'stock_minimo', 'costo', 'proveedor_id'],
  camposEditar: ['nombre', 'unidad', 'stock_minimo', 'costo', 'proveedor_id'], // el stock solo cambia con movimientos
  requeridos: { nombre: 'el nombre del insumo', unidad: 'la unidad de medida' },
  numericos: ['stock', 'stock_minimo', 'costo'],
  escribir: ['admin'],
  listarSql: `SELECT i.*, p.nombre AS proveedor FROM insumos i
              LEFT JOIN proveedores p ON p.id = i.proveedor_id
              WHERE i.activo = TRUE ORDER BY i.nombre`,
});

// Entradas, salidas y conteos de stock (quedan registrados con el usuario que los hizo)
r.post('/:id/movimiento', roles('admin', 'cocina'), asyncH(async (req, res) => {
  const { tipo, nota } = req.body;
  const cantidad = Number(req.body.cantidad);
  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) throw falla(400, 'Elige qué pasó con el stock.');
  if (!Number.isFinite(cantidad) || cantidad < 0 || (tipo !== 'ajuste' && cantidad === 0)) {
    throw falla(400, 'Escribe una cantidad válida.');
  }
  const nuevo = await conTransaccion(async (db) => {
    const { rows } = await db.query('SELECT stock FROM insumos WHERE id = $1 AND activo = TRUE FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw falla(404, 'No se encontró el insumo.');
    const actual = Number(rows[0].stock);
    const calculado = tipo === 'entrada' ? actual + cantidad : tipo === 'salida' ? actual - cantidad : cantidad;
    if (calculado < 0) throw falla(400, `Solo quedan ${actual}. No puede salir más de lo que hay.`);
    const resultado = Math.round(calculado * 100) / 100;
    await db.query('UPDATE insumos SET stock = $1 WHERE id = $2', [resultado, req.params.id]);
    await db.query(
      `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, stock_resultante, nota, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, tipo, cantidad, resultado, String(nota || '').trim() || null, req.usuario.id]);
    return resultado;
  });
  res.json({ stock: nuevo });
}));

// Conteo rápido: deja varios ingredientes con la cantidad real de una sola vez.
// filas: [{ insumo_id, stock }] para los que ya existen, o [{ nombre, unidad, stock }] para crear uno nuevo.
r.post('/conteo', roles('admin', 'cocina'), asyncH(async (req, res) => {
  const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
  if (filas.length === 0) throw falla(400, 'No hay nada que guardar.');
  if (filas.length > 500) throw falla(400, 'Son demasiadas líneas. Guárdalas en partes.');
  const nota = String(req.body.nota || '').trim().slice(0, 255) || 'Conteo rápido';
  const vistos = new Set();
  for (const f of filas) {
    const stock = Number(f.stock);
    if (!Number.isFinite(stock) || stock < 0) throw falla(400, `Revisa la cantidad de "${f.nombre || 'una línea'}".`);
    if (f.insumo_id) {
      if (vistos.has(Number(f.insumo_id))) throw falla(400, 'Hay dos líneas para el mismo ingrediente. Júntalas en una.');
      vistos.add(Number(f.insumo_id));
    } else {
      if (req.usuario.rol !== 'admin') throw falla(403, 'Solo el administrador puede crear ingredientes nuevos.');
      if (!String(f.nombre || '').trim()) throw falla(400, 'A un ingrediente nuevo le falta el nombre.');
      if (!String(f.unidad || '').trim()) throw falla(400, `Elige cómo se mide "${f.nombre}".`);
    }
  }

  const resultado = await conTransaccion(async (db) => {
    let actualizados = 0, creados = 0;
    for (const f of filas) {
      const stock = Math.round(Number(f.stock) * 100) / 100;
      let id = Number(f.insumo_id) || null;
      if (id) {
        const { rowCount } = await db.query('UPDATE insumos SET stock = $1 WHERE id = $2 AND activo = TRUE', [stock, id]);
        if (!rowCount) throw falla(404, 'Uno de los ingredientes ya no existe. Recarga la página.');
        actualizados++;
      } else {
        const { rows: [n] } = await db.query(
          'INSERT INTO insumos (nombre, unidad, stock) VALUES ($1, $2, $3) RETURNING id',
          [String(f.nombre).trim().slice(0, 120), String(f.unidad).trim().slice(0, 20), stock]);
        id = n.id; creados++;
      }
      await db.query(
        `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, stock_resultante, nota, usuario_id)
         VALUES ($1, 'ajuste', $2, $2, $3, $4)`, [id, stock, nota, req.usuario.id]);
    }
    return { actualizados, creados };
  });
  res.json(resultado);
}));

export default r;
