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

// Costo de ingredientes de 1 porción: el guardado el día del pedido; para pedidos viejos (de antes de
// tener costos) se usa la receta con los costos de hoy
const COSTO_PORCION = `COALESCE(i.costo, (SELECT SUM(x.cantidad * ins.costo) FROM plato_ingredientes x
  JOIN insumos ins ON ins.id = x.insumo_id WHERE x.plato_id = i.plato_id), 0)`;

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

  const [resumen, cancelados, dias, horas, platos, empleados, metodos, tipos, costos, mermas] = await Promise.all([
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
      `SELECT i.nombre, SUM(i.cantidad) AS cantidad, SUM(i.cantidad * i.precio) AS total,
              SUM(i.cantidad * ${COSTO_PORCION}) AS costo
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
    pool.query(
      `SELECT COALESCE(SUM(i.cantidad * i.precio), 0) AS ventas,
              COALESCE(SUM(i.cantidad * ${COSTO_PORCION}), 0) AS costo,
              COUNT(DISTINCT i.nombre) FILTER (WHERE ${COSTO_PORCION} = 0 OR EXISTS (
                SELECT 1 FROM plato_ingredientes x JOIN insumos ins ON ins.id = x.insumo_id
                WHERE x.plato_id = i.plato_id AND ins.costo = 0)) AS sin_costo
       FROM pedido_items i JOIN pedidos p ON p.id = i.pedido_id WHERE ${VENDIDO}`, params),
    // Pérdidas: lo que se sacó del inventario a mano (se botó, se venció, se dañó), valorado al costo de hoy.
    // Las salidas por pedidos llevan la nota "Pedido #..." y no cuentan aquí.
    pool.query(
      `SELECT ins.nombre, ins.unidad, SUM(m.cantidad) AS cantidad, SUM(m.cantidad * ins.costo) AS costo
       FROM movimientos_inventario m JOIN insumos ins ON ins.id = m.insumo_id
       WHERE m.tipo = 'salida' AND (m.nota IS NULL OR m.nota NOT LIKE 'Pedido #%')
         AND (m.creado_en AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
       GROUP BY ins.id ORDER BY costo DESC, cantidad DESC`, params),
  ]);

  const res0 = resumen.rows[0];
  const pedidos = Number(res0.pedidos);
  const total = r2(res0.total);
  const fila = (x) => ({ ...x, pedidos: Number(x.pedidos), total: r2(x.total) });
  const c = costos.rows[0];
  const ventasPlatos = r2(c.ventas);
  const costo = r2(c.costo);
  const perdidas = r2(mermas.rows.reduce((s, m) => s + Number(m.costo), 0));

  res.json({
    desde: params[1],
    hasta: params[2],
    resumen: {
      total,
      pedidos,
      ticket_promedio: pedidos ? r2(total / pedidos) : 0,
      envios: r2(res0.envios),
      cancelados: Number(cancelados.rows[0].n),
      ventas_platos: ventasPlatos,                 // sin el envío
      costo,                                       // costo de ingredientes de lo vendido
      ganancia: r2(ventasPlatos - costo),          // ganancia sobre ingredientes (no incluye sueldos, luz, alquiler...)
      margen: ventasPlatos > 0 ? Math.round(((ventasPlatos - costo) / ventasPlatos) * 1000) / 10 : null,
      perdidas,
      ganancia_neta: r2(ventasPlatos - costo - perdidas),
      platos_sin_costo: Number(c.sin_costo),
    },
    mermas: mermas.rows.map((m) => ({ nombre: m.nombre, unidad: m.unidad, cantidad: Number(m.cantidad), costo: r2(m.costo) })),
    por_dia: dias.rows.map(fila),
    por_hora: horas.rows.map(fila),
    platos: platos.rows.map((x) => ({
      nombre: x.nombre, cantidad: Number(x.cantidad), total: r2(x.total), costo: r2(x.costo), ganancia: r2(x.total - x.costo),
    })),
    empleados: empleados.rows.map(fila),
    metodos: metodos.rows.map(fila),
    tipos: tipos.rows.map(fila),
  });
}));

export default r;
