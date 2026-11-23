import { Router } from 'express';
import { pool } from '../db.js';
import { asyncH, auth, roles, falla, validarId } from '../middleware/auth.js';

const limpiar = (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v ?? null);

/**
 * Crea las rutas básicas (listar, crear, editar, quitar) de una tabla.
 * "Quitar" no borra: marca activo = FALSE, así nunca se rompen datos relacionados.
 */
export function crudRouter({
  tabla, campos, camposEditar = campos, requeridos = {}, numericos = [],
  orden = 'nombre', escribir = ['admin'], listarSql,
}) {
  const r = Router();
  r.use(auth);
  r.param('id', validarId);

  const preparar = (body, lista, esNuevo) => {
    for (const [campo, etiqueta] of Object.entries(requeridos)) {
      if (!lista.includes(campo)) continue;
      if ((esNuevo || body[campo] !== undefined) && limpiar(body[campo]) === null) {
        throw falla(400, `Escribe ${etiqueta}.`);
      }
    }
    const cols = [], vals = [];
    for (const c of lista) {
      if (body[c] === undefined) continue;
      const v = limpiar(body[c]);
      if (numericos.includes(c)) {
        if (v === null) continue;
        if (!(Number.isFinite(Number(v)) && Number(v) >= 0)) {
          throw falla(400, `El valor de "${c.replace('_', ' ')}" no es válido.`);
        }
      }
      cols.push(c);
      vals.push(v);
    }
    return { cols, vals };
  };

  r.get('/', asyncH(async (req, res) => {
    const { rows } = await pool.query(listarSql || `SELECT * FROM ${tabla} WHERE activo = TRUE ORDER BY ${orden}`);
    res.json(rows);
  }));

  r.post('/', roles(...escribir), asyncH(async (req, res) => {
    const { cols, vals } = preparar(req.body, campos, true);
    const { rows } = await pool.query(
      `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, vals);
    res.status(201).json({ id: rows[0].id });
  }));

  r.put('/:id', roles(...escribir), asyncH(async (req, res) => {
    const { cols, vals } = preparar(req.body, camposEditar, false);
    if (!cols.length) throw falla(400, 'No hay cambios que guardar.');
    const rs = await pool.query(
      `UPDATE ${tabla} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} AND activo = TRUE`,
      [...vals, req.params.id]);
    if (!rs.rowCount) throw falla(404, 'No se encontró el registro.');
    res.json({ ok: true });
  }));

  r.delete('/:id', roles(...escribir), asyncH(async (req, res) => {
    await pool.query(`UPDATE ${tabla} SET activo = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  }));

  return r;
}
