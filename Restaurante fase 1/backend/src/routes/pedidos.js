import { Router } from 'express';
import { pool, conTransaccion, insertarVarios } from '../db.js';
import { asyncH, auth, roles, falla, validarId } from '../middleware/auth.js';

const r = Router();
r.use(auth);
r.param('id', validarId);

const ZONA = process.env.ZONA_HORARIA || 'America/Guatemala'; // define qué es "hoy"
const EPS = 1e-9;
const r2 = (n) => Math.round(n * 100) / 100;
const METODOS = ['efectivo', 'tarjeta', 'transferencia'];
// Tarifa de envío a domicilio por zona (se puede cambiar con ENVIO_CENTRICA y ENVIO_RURAL)
const tarifa = (valor, porDefecto) => (Number.isFinite(Number(valor)) && valor !== undefined && valor !== '' ? Number(valor) : porDefecto);
const ENVIO = { centrica: tarifa(process.env.ENVIO_CENTRICA, 5), rural: tarifa(process.env.ENVIO_RURAL, 15) };
const SIGUIENTE = { pendiente: 'preparando', preparando: 'listo', listo: 'entregado' };
const QUIEN = { preparando: ['admin', 'cajero', 'cocina'], listo: ['admin', 'cajero', 'cocina'], entregado: ['admin', 'cajero'] };

// Revisa y actualiza el stock (falla si no alcanza). Se hace ANTES de crear el pedido,
// así un pedido rechazado no gasta un número. Devuelve los cambios para registrarlos después.
// signo -1: descuenta. signo +1: devuelve.
async function ajustarStock(db, necesario, signo) {
  const ids = [...necesario.keys()].sort((a, b) => a - b);
  if (!ids.length) return [];
  const { rows } = await db.query(
    'SELECT id, nombre, stock, activo FROM insumos WHERE id = ANY($1) ORDER BY id FOR UPDATE', [ids]);
  const faltan = [];
  const cambios = [];
  for (const ins of rows) {
    const cant = r2(necesario.get(ins.id));
    if (cant <= 0) continue;
    const actual = Number(ins.stock);
    if (signo < 0 && (!ins.activo || actual + EPS < cant)) {
      faltan.push(`${ins.nombre} (hay ${actual}, se necesita ${cant})`);
      continue;
    }
    cambios.push({ id: ins.id, cant, nuevo: r2(actual + signo * cant) });
  }
  if (faltan.length) throw falla(409, `No alcanza el stock de: ${faltan.join('; ')}.`);
  for (const c of cambios) await db.query('UPDATE insumos SET stock = $1 WHERE id = $2', [c.nuevo, c.id]);
  return cambios;
}

// Deja constancia de cada cambio de stock en el historial de movimientos
async function registrarMovimientos(db, cambios, signo, nota, usuarioId) {
  for (const c of cambios) {
    await db.query(
      `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, stock_resultante, nota, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [c.id, signo < 0 ? 'salida' : 'entrada', c.cant, c.nuevo, nota, usuarioId]);
  }
}

async function cargarPedidos(condicion, params, orden) {
  const { rows: pedidos } = await pool.query(
    `SELECT p.id, p.tipo, p.referencia, p.estado, p.total, p.pagado, p.metodo_pago, p.pagado_en, p.creado_en,
            p.zona_envio, p.costo_envio, p.direccion, p.telefono, p.recibido, p.cambio, p.cliente_id, c.nombre AS cliente, u.nombre AS atendio, p.mesa_id, m.nombre AS mesa
     FROM pedidos p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN mesas m ON m.id = p.mesa_id
     WHERE ${condicion} ORDER BY p.creado_en ${orden}`, params);
  if (!pedidos.length) return [];
  const { rows: items } = await pool.query(
    'SELECT id, pedido_id, plato_id, nombre, precio, cantidad, nota FROM pedido_items WHERE pedido_id = ANY($1) ORDER BY id',
    [pedidos.map((p) => p.id)]);
  return pedidos.map((p) => ({ ...p, items: items.filter((i) => i.pedido_id === p.id) }));
}

// Datos que la interfaz necesita para calcular el envío
r.get('/config', (req, res) => res.json({ envio: ENVIO }));

// vista: proceso (lo que sigue abierto), finalizados (entregados y pagados hoy), cancelados (hoy)
r.get('/', asyncH(async (req, res) => {
  const hoy = '(p.creado_en AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date';
  switch (req.query.vista || 'proceso') {
    case 'finalizados':
      return res.json(await cargarPedidos(`p.estado = 'entregado' AND p.pagado AND ${hoy}`, [ZONA], 'DESC'));
    case 'cancelados':
      return res.json(await cargarPedidos(`p.estado = 'cancelado' AND ${hoy}`, [ZONA], 'DESC'));
    default:
      return res.json(await cargarPedidos(
        "p.estado <> 'cancelado' AND NOT (p.estado = 'entregado' AND p.pagado)", [], 'ASC'));
  }
}));

// Crea el pedido y descuenta del inventario los ingredientes de cada plato (todo o nada)
r.post('/', roles('admin', 'cajero'), asyncH(async (req, res) => {
  const b = req.body;
  const tipo = ['mesa', 'llevar', 'domicilio'].includes(b.tipo) ? b.tipo : 'mesa';
  const referencia = String(b.referencia || '').trim().slice(0, 60) || null;
  const clienteId = b.cliente_id ? Number(b.cliente_id) : null;
  if (clienteId !== null && !Number.isInteger(clienteId)) throw falla(400, 'El cliente no es válido.');
  const lineas = Array.isArray(b.items) ? b.items : [];
  if (!lineas.length) throw falla(400, 'Agrega al menos un plato al pedido.');
  const mesaId = tipo === 'mesa' && b.mesa_id ? Number(b.mesa_id) : null;
  if (mesaId !== null && !Number.isInteger(mesaId)) throw falla(400, 'La mesa no es válida.');
  let zona = null, costoEnvio = 0, direccion = null, telefono = null;
  if (tipo === 'domicilio') {
    if (!Object.hasOwn(ENVIO, b.zona)) throw falla(400, 'Elige la zona de entrega.');
    zona = b.zona;
    costoEnvio = ENVIO[zona];
    direccion = String(b.direccion || '').trim().slice(0, 255);
    if (!direccion) throw falla(400, 'Escribe la dirección de entrega.');
    telefono = String(b.telefono || '').trim().slice(0, 30) || null;
  }
  const vistos = new Set();
  for (const l of lineas) {
    const cant = Number(l.cantidad);
    if (!Number.isInteger(Number(l.plato_id))) throw falla(400, 'Elige platos válidos.');
    if (!Number.isInteger(cant) || cant < 1 || cant > 99) throw falla(400, 'La cantidad de cada plato debe ser un número entre 1 y 99.');
    if (vistos.has(Number(l.plato_id))) throw falla(400, 'Hay un plato repetido en el pedido.');
    vistos.add(Number(l.plato_id));
  }

  const creado = await conTransaccion(async (db) => {
    const ids = [...vistos];
    const { rows: platos } = await db.query('SELECT id, nombre, precio FROM platos WHERE id = ANY($1) AND activo = TRUE', [ids]);
    if (platos.length !== ids.length) throw falla(400, 'Alguno de los platos ya no está en la carta. Actualiza e inténtalo de nuevo.');
    const porId = new Map(platos.map((p) => [p.id, p]));
    const { rows: rec } = await db.query(
      `SELECT x.plato_id, x.insumo_id, x.cantidad, i.costo
       FROM plato_ingredientes x JOIN insumos i ON i.id = x.insumo_id WHERE x.plato_id = ANY($1)`, [ids]);
    // Costo de ingredientes de una porción, con los costos de hoy (así los reportes no cambian si después sube un insumo)
    const costoPorcion = (platoId) => rec.filter((x) => x.plato_id === platoId).reduce((s, x) => s + Number(x.cantidad) * Number(x.costo), 0);

    const necesario = new Map();
    for (const l of lineas) {
      for (const x of rec.filter((x) => x.plato_id === Number(l.plato_id))) {
        necesario.set(x.insumo_id, (necesario.get(x.insumo_id) || 0) + Number(x.cantidad) * Number(l.cantidad));
      }
    }
    const subtotal = lineas.reduce((s, l) => s + Number(porId.get(Number(l.plato_id)).precio) * Number(l.cantidad), 0);
    const total = r2(subtotal + costoEnvio); // el envío ya va incluido en el total

    if (clienteId !== null) {
      const { rowCount } = await db.query('SELECT 1 FROM clientes WHERE id = $1 AND activo = TRUE', [clienteId]);
      if (!rowCount) throw falla(400, 'El cliente elegido ya no existe.');
    }
    if (mesaId !== null) {
      const { rowCount } = await db.query('SELECT 1 FROM mesas WHERE id = $1 AND activo = TRUE', [mesaId]);
      if (!rowCount) throw falla(400, 'La mesa elegida ya no existe.');
    }
    const cambios = await ajustarStock(db, necesario, -1);

    const { rows: [ped] } = await db.query(
      `INSERT INTO pedidos (tipo, referencia, cliente_id, total, usuario_id, zona_envio, costo_envio, direccion, telefono, mesa_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [tipo, referencia, clienteId, total, req.usuario.id, zona, costoEnvio, direccion, telefono, mesaId]);
    await insertarVarios(db, 'pedido_items', ['pedido_id', 'plato_id', 'nombre', 'precio', 'cantidad', 'nota', 'costo'],
      lineas.map((l) => {
        const p = porId.get(Number(l.plato_id));
        return [ped.id, p.id, p.nombre, p.precio, Number(l.cantidad), String(l.nota || '').trim().slice(0, 255) || null, costoPorcion(p.id)];
      }));
    await registrarMovimientos(db, cambios, -1, `Pedido #${ped.id}`, req.usuario.id);
    return { id: ped.id, total };
  });
  res.status(201).json(creado);
}));

// Pasa el pedido al siguiente estado: pendiente > preparando > listo > entregado
r.post('/:id/avanzar', asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT estado FROM pedidos WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw falla(404, 'No se encontró el pedido.');
  const actual = rows[0].estado;
  const nuevo = SIGUIENTE[actual];
  if (!nuevo) throw falla(400, actual === 'cancelado' ? 'El pedido está cancelado.' : 'El pedido ya fue entregado.');
  if (!QUIEN[nuevo].includes(req.usuario.rol)) throw falla(403, 'No tienes permiso para hacer esto.');
  const rs = await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2 AND estado = $3', [nuevo, req.params.id, actual]);
  if (!rs.rowCount) throw falla(409, 'Otra persona ya cambió este pedido. Actualiza la lista.');
  res.json({ estado: nuevo });
}));

// En efectivo se puede indicar con cuánto paga el cliente: se calcula y guarda el cambio.
// Si no se indica, se toma como pago exacto.
r.post('/:id/pago', roles('admin', 'cajero'), asyncH(async (req, res) => {
  const { metodo } = req.body;
  if (!METODOS.includes(metodo)) throw falla(400, 'Elige cómo pagó el cliente.');
  const { rows } = await pool.query('SELECT total FROM pedidos WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw falla(404, 'No se encontró el pedido.');
  const total = Number(rows[0].total);
  const { rows: cajas } = await pool.query("SELECT id FROM cajas WHERE estado = 'abierta'");
  if (!cajas[0]) throw falla(409, 'La caja está cerrada. Ábrela para poder cobrar.');

  let recibido = null, cambio = null;
  if (metodo === 'efectivo') {
    const dado = req.body.recibido;
    recibido = dado === undefined || dado === null || dado === '' ? total : Number(dado);
    if (!Number.isFinite(recibido) || recibido > 1000000) throw falla(400, 'El dinero recibido no es válido.');
    if (recibido + EPS < total) throw falla(400, `El dinero recibido no alcanza: el total es ${r2(total)}.`);
    recibido = r2(recibido);
    cambio = r2(recibido - total);
  }
  const rs = await pool.query(
    `UPDATE pedidos SET pagado = TRUE, metodo_pago = $1, pagado_en = NOW(), recibido = $2, cambio = $3, caja_id = $5
     WHERE id = $4 AND pagado = FALSE AND estado <> 'cancelado'`, [metodo, recibido, cambio, req.params.id, cajas[0].id]);
  if (!rs.rowCount) throw falla(409, 'Este pedido ya está pagado o fue cancelado.');
  const [pedido] = await cargarPedidos('p.id = $1', [req.params.id], 'ASC');
  res.json({ ok: true, pedido });
}));

// Si el pedido sigue pendiente, los ingredientes vuelven al inventario. Si ya se empezó a preparar, no.
r.post('/:id/cancelar', roles('admin', 'cajero'), asyncH(async (req, res) => {
  const stockDevuelto = await conTransaccion(async (db) => {
    const { rows } = await db.query('SELECT estado, pagado FROM pedidos WHERE id = $1 FOR UPDATE', [req.params.id]);
    const p = rows[0];
    if (!p) throw falla(404, 'No se encontró el pedido.');
    if (p.estado === 'cancelado') throw falla(409, 'El pedido ya estaba cancelado.');
    if (p.pagado) throw falla(400, 'Un pedido pagado no se puede cancelar.');
    if (p.estado === 'entregado') throw falla(400, 'Un pedido entregado no se puede cancelar.');
    const devolver = p.estado === 'pendiente';
    if (devolver) {
      const { rows: uso } = await db.query(
        `SELECT x.insumo_id, SUM(x.cantidad * i.cantidad) AS cantidad
         FROM pedido_items i JOIN plato_ingredientes x ON x.plato_id = i.plato_id
         WHERE i.pedido_id = $1 GROUP BY x.insumo_id`, [req.params.id]);
      const cambios = await ajustarStock(db, new Map(uso.map((u) => [u.insumo_id, Number(u.cantidad)])), +1);
      await registrarMovimientos(db, cambios, +1, `Pedido #${req.params.id} cancelado`, req.usuario.id);
    }
    await db.query("UPDATE pedidos SET estado = 'cancelado' WHERE id = $1", [req.params.id]);
    return devolver;
  });
  res.json({ stockDevuelto });
}));

export default r;
