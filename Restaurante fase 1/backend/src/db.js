import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Los NUMERIC y BIGINT llegan como número (por defecto vendrían como texto)
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(20, Number);

const conexion = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'restaurante',
    };

export const pool = new pg.Pool({
  ...conexion,
  max: 10,
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
});

// Crea las tablas si no existen
export async function aplicarEsquema() {
  const sql = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}

// Ejecuta varias consultas como una sola operación: o se guardan todas o ninguna.
export async function conTransaccion(fn) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const salida = await fn(db);
    await db.query('COMMIT');
    return salida;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
}

// INSERT de varias filas a la vez. db puede ser el pool o la conexión de una transacción.
export async function insertarVarios(db, tabla, columnas, filas) {
  if (!filas.length) return;
  const params = [];
  const grupos = filas.map((fila) => `(${fila.map((v) => { params.push(v); return `$${params.length}`; }).join(', ')})`);
  await db.query(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES ${grupos.join(', ')}`, params);
}
