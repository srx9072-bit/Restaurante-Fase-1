import { Router } from 'express';
import { pool } from '../db.js';
import { asyncH, auth, roles, falla } from '../middleware/auth.js';

const r = Router();
r.use(auth, roles('admin'));

const ZONA = process.env.ZONA_HORARIA || 'America/Guatemala';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;
const r2 = (n) => Math.round(Number(n) * 100) / 100;

// Una venta es un pedido cobrado y no cancelado. Se ubica en el día en que se cobró.
const VENDIDO = `p.pagado AND p.estado <> 'cancelado'
  AND (p.pagado_en AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`;

function rango(q) {
  const { desde, hasta } = q;
  if (!FECHA.test(desde || '') || !FECHA.test(hasta || '')) throw falla(400, 'Elige las fechas del reporte.');
  const d = Date.parse(`${desde}T00:00:00Z`);
  const h = Date.parse(`${hasta}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(h)) throw falla(400, 'Alguna de las fechas no es válida.');
  if (d > h) throw falla(400, 'La fecha inicial no puede ser después de la final.');
  if ((h - d) / 864e5 + 1 > MAX_DIAS) throw falla(400, 'El reporte puede abarcar como máximo un año.');
  return [ZONA, desde, hasta];
}

r.get('/', asyncH(async (req, res) => {
  const params = rango(req.query);

  const [resumen, cancelados, dias, horas, platos, empleados, metodos, tipos] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS pedidos, COALESCE(SUM(p.total), 0) AS total, COALESCE(SUM(p.costo_envio), 0) AS envios
       FROM pedidos p WHERE ${VENDIDO}`, params),
    pool.query(
      `SELECT COUNT(*) AS n FROM pedidos p
       WHERE p.estado = 'cancelado' AND (p.creado_en AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`, params),
    // Todos los días del rango, también los que no tuvieron ventas
    pool.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS dia, COALESCE(v.total, 0) AS total, COALESCE(v.pedidos, 0) AS pedidos
       FROM generate_series($2::date, $3::date, interval '1 day') d
       LEFT JOIN (
         SELECT (p.pagado_en AT TIME ZONE $1)::date AS dia, SUM(p.total) AS total, COUNT(*) AS pedidos
         FROM pedidos p WHERE ${VENDIDO} GROUP BY 1
       ) v ON v.dia = d::date
       ORDER BY d`, params),
    // Hora en que se tomó el pedido: sirve para saber cuándo se necesita más personal
    pool.query(
      `SELECT EXTRACT(HOUR FROM p.creado_en AT TIME ZONE $1)::int AS hora, COUNT(*) AS pedidos, SUM(p.total) AS total
       FROM pedidos p WHERE ${VENDIDO} GROUP BY 1 ORDER BY 1`, params),
    pool.query(
      `SELECT i.nombre, SUM(i.cantidad) AS cantidad, SUM(i.cantidad * i.precio) AS total
       FROM pedido_items i JOIN pedidos p ON p.id = i.pedido_id
       WHERE ${VENDIDO} GROUP BY i.nombre ORDER BY cantidad DESC, total DESC LIMIT 10`, params),
    pool.query(
      `SELECT COALESCE(u.nombre, 'Usuario eliminado') AS nombre, COUNT(*) AS pedidos, SUM(p.total) AS total
       FROM pedidos p LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE ${VENDIDO} GROUP BY 1 ORDER BY total DESC`, params),
    pool.query(
      `SELECT p.metodo_pago AS metodo, COUNT(*) AS pedidos, SUM(p.total) AS total
       FROM pedidos p WHERE ${VENDIDO} GROUP BY 1 ORDER BY total DESC`, params),
    pool.query(
      `SELECT p.tipo, COUNT(*) AS pedidos, SUM(p.total) AS total
       FROM pedidos p WHERE ${VENDIDO} GROUP BY 1 ORDER BY total DESC`, params),
  ]);

  const res0 = resumen.rows[0];
  const pedidos = Number(res0.pedidos);
  const total = r2(res0.total);
  const fila = (x) => ({ ...x, pedidos: Number(x.pedidos), total: r2(x.total) });

  res.json({
    desde: params[1],
    hasta: params[2],
    resumen: {
      total,
      pedidos,
      ticket_promedio: pedidos ? r2(total / pedidos) : 0,
      envios: r2(res0.envios),
      cancelados: Number(cancelados.rows[0].n),
    },
    por_dia: dias.rows.map(fila),
    por_hora: horas.rows.map(fila),
    platos: platos.rows.map((x) => ({ nombre: x.nombre, cantidad: Number(x.cantidad), total: r2(x.total) })),
    empleados: empleados.rows.map(fila),
    metodos: metodos.rows.map(fila),
    tipos: tipos.rows.map(fila),
  });
}));

export default r;
