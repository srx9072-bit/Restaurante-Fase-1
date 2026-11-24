import { Router } from 'express';
import { pool } from '../db.js';
import { asyncH, auth, roles, falla, validarId } from '../middleware/auth.js';

const r = Router();
r.use(auth, roles('admin', 'cajero'));
r.param('id', validarId);

const MAX = 1000000;
const r2 = (n) => Math.round(n * 100) / 100;
const monto = (v, mensaje, { permitirCero = false } = {}) => {
  const n = Number(v);
  if (v === '' || v === undefined || v === null || !Number.isFinite(n) || n < 0 || n > MAX || (!permitirCero && n === 0)) throw falla(400, mensaje);
  return r2(n);
};

const SELECT_CAJA = `SELECT c.*, ua.nombre AS abierta_por_nombre, uc.nombre AS cerrada_por_nombre
  FROM cajas c LEFT JOIN usuarios ua ON ua.id = c.abierta_por LEFT JOIN usuarios uc ON uc.id = c.cerrada_por`;

// Arma el reporte de una caja: ventas por método, movimientos y efectivo que debe haber
async function reporte(caja) {
  const { rows: pagos } = await pool.query(
    `SELECT metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
     FROM pedidos WHERE caja_id = $1 AND pagado GROUP BY metodo_pago`, [caja.id]);
  const venta = (m) => {
    const x = pagos.find((p) => p.metodo_pago === m);
    return { cantidad: x ? Number(x.cantidad) : 0, total: x ? Number(x.total) : 0 };
  };
  const ventas = { efectivo: venta('efectivo'), tarjeta: venta('tarjeta'), transferencia: venta('transferencia') };
  const { rows: movimientos } = await pool.query(
    `SELECT m.id, m.tipo, m.monto, m.concepto, m.creado_en, u.nombre AS usuario
     FROM caja_movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id WHERE m.caja_id = $1 ORDER BY m.id`, [caja.id]);
  const suma = (tipo) => r2(movimientos.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.monto), 0));
  const ingresos = suma('ingreso');
  const egresos = suma('egreso');
  const esperadoActual = r2(Number(caja.monto_inicial) + ventas.efectivo.total + ingresos - egresos);

  const { rows: [canc] } = await pool.query(
    `SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'cancelado' AND creado_en >= $1 AND ($2::timestamptz IS NULL OR creado_en <= $2)`,
    [caja.abierta_en, caja.cerrada_en]);
  let pedidosAbiertos = null;
  if (caja.estado === 'abierta') {
    const { rows: [a] } = await pool.query(
      "SELECT COUNT(*) AS n FROM pedidos WHERE estado <> 'cancelado' AND NOT (estado = 'entregado' AND pagado)");
    pedidosAbiertos = a.n;
  }
  const cerrada = caja.estado === 'cerrada';
  return {
    ...caja,
    monto_inicial: Number(caja.monto_inicial),
    ventas,
    total_ventas: r2(ventas.efectivo.total + ventas.tarjeta.total + ventas.transferencia.total),
    pedidos_cobrados: ventas.efectivo.cantidad + ventas.tarjeta.cantidad + ventas.transferencia.cantidad,
    ingresos, egresos, movimientos,
    esperado: cerrada ? Number(caja.esperado) : esperadoActual,
    contado: cerrada ? Number(caja.contado) : null,
    diferencia: cerrada ? Number(caja.diferencia) : null,
    pedidos_cancelados: canc.n,
    pedidos_abiertos: pedidosAbiertos,
  };
}

const cajaAbierta = async () => (await pool.query(`${SELECT_CAJA} WHERE c.estado = 'abierta'`)).rows[0];

r.get('/actual', asyncH(async (req, res) => {
  const caja = await cajaAbierta();
  res.json({ caja: caja ? await reporte(caja) : null });
}));

r.get('/historial', asyncH(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.abierta_en, c.cerrada_en, c.monto_inicial, c.esperado, c.contado, c.diferencia,
            ua.nombre AS abierta_por_nombre, uc.nombre AS cerrada_por_nombre,
            (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE caja_id = c.id AND pagado) AS total_ventas
     FROM cajas c LEFT JOIN usuarios ua ON ua.id = c.abierta_por LEFT JOIN usuarios uc ON uc.id = c.cerrada_por
     WHERE c.estado = 'cerrada' ORDER BY c.id DESC LIMIT 30`);
  res.json(rows);
}));

r.get('/:id', asyncH(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_CAJA} WHERE c.id = $1`, [req.params.id]);
  if (!rows[0]) throw falla(404, 'No se encontró la caja.');
  res.json(await reporte(rows[0]));
}));

// Apertura: el monto inicial es el fondo de caja chica con el que arranca el turno
r.post('/abrir', asyncH(async (req, res) => {
  const inicial = req.body.monto_inicial === undefined || req.body.monto_inicial === ''
    ? 0 : monto(req.body.monto_inicial, 'El monto inicial no es válido.', { permitirCero: true });
  try {
    const { rows } = await pool.query('INSERT INTO cajas (monto_inicial, abierta_por) VALUES ($1, $2) RETURNING id', [inicial, req.usuario.id]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.code === '23505') throw falla(409, 'Ya hay una caja abierta.');
    throw e;
  }
}));

// Ingresos y egresos de efectivo (compras pequeñas, retiros, dinero que se agrega...)
r.post('/movimientos', asyncH(async (req, res) => {
  const { tipo } = req.body;
  if (!['ingreso', 'egreso'].includes(tipo)) throw falla(400, 'Elige si es un ingreso o un egreso.');
  const valor = monto(req.body.monto, 'Escribe un monto válido.');
  const concepto = String(req.body.concepto || '').trim().slice(0, 120);
  if (!concepto) throw falla(400, tipo === 'egreso' ? 'Escribe en qué se usó el dinero.' : 'Escribe de dónde viene el dinero.');
  const caja = await cajaAbierta();
  if (!caja) throw falla(409, 'La caja está cerrada. Ábrela primero.');
  if (tipo === 'egreso') {
    const { esperado } = await reporte(caja);
    if (valor > esperado + 1e-9) throw falla(400, `No hay tanto efectivo en caja. Hay ${esperado.toFixed(2)}.`);
  }
  await pool.query(
    'INSERT INTO caja_movimientos (caja_id, tipo, monto, concepto, usuario_id) VALUES ($1, $2, $3, $4, $5)',
    [caja.id, tipo, valor, concepto, req.usuario.id]);
  res.status(201).json({ ok: true });
}));

// Cierre: se cuenta el efectivo y se compara con lo que debía haber
r.post('/cerrar', asyncH(async (req, res) => {
  const contado = monto(req.body.contado, 'Escribe cuánto efectivo hay en la caja.', { permitirCero: true });
  const notas = String(req.body.notas || '').trim().slice(0, 255) || null;
  const caja = await cajaAbierta();
  if (!caja) throw falla(409, 'No hay una caja abierta.');
  const { esperado } = await reporte(caja);
  const rs = await pool.query(
    `UPDATE cajas SET estado = 'cerrada', cerrada_en = NOW(), cerrada_por = $1, esperado = $2, contado = $3, diferencia = $4, notas = $5
     WHERE id = $6 AND estado = 'abierta'`,
    [req.usuario.id, esperado, contado, r2(contado - esperado), notas, caja.id]);
  if (!rs.rowCount) throw falla(409, 'La caja ya fue cerrada.');
  const { rows } = await pool.query(`${SELECT_CAJA} WHERE c.id = $1`, [caja.id]);
  res.json(await reporte(rows[0]));
}));

export default r;
