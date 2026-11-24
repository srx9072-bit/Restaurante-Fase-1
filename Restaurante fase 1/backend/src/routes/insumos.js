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

export default r;
