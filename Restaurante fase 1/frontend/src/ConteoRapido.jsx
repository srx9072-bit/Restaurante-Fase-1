import { useMemo, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { api } from './api';
import { Aviso, Modal, btnPrimario, btnSecundario, campo, num } from './ui.jsx';

// Conteo rápido: se pega la lista tal como la mandan ("Tocino = 7", "Aceite= 1 galón"...),
// el sistema propone a qué ingrediente va cada línea y se confirma todo de una vez.

const UNIDADES = ['unidad', 'lb', 'kg', 'litro', 'galón'];
const PALABRAS_NUM = { cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const RELLENO = new Set(['hay', 'de', 'del', 'la', 'el', 'los', 'las', 'para', 'en', 'con', 'y', 'bolsa', 'bolsas', 'caja', 'cajas', 'paquete', 'paquetes']);

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const singular = (w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const palabras = (t) => sinAcentos(t).split(/[^a-z0-9ñ]+/).filter((w) => w && !RELLENO.has(w)).map(singular);

// "Aceite= 1 galón" -> { nombre: 'Aceite', cantidad: 1, unidadSugerida: 'galón' }
export function leerLinea(linea) {
  const limpia = linea.replace(/^[\s\-•*·]+/, '').trim();
  if (!limpia) return null;
  let nombre, resto;
  const conSigno = limpia.match(/^(.*?)\s*[=:]\s*(.*)$/);
  if (conSigno) [, nombre, resto] = conSigno;
  else {
    const alFinal = limpia.match(/^(.*?)\s+(\d+(?:[.,]\d+)?\s*\D*)$/);
    if (!alFinal) return { original: linea.trim(), nombre: limpia, cantidad: null };
    [, nombre, resto] = alFinal;
  }
  const r = sinAcentos(resto);
  let cantidad = null;
  const digitos = r.match(/\d+(?:[.,]\d+)?/);
  if (digitos) cantidad = Number(digitos[0].replace(',', '.'));
  else for (const w of r.split(/\s+/)) if (w in PALABRAS_NUM) { cantidad = PALABRAS_NUM[w]; break; }
  const unidadSugerida = /galon/.test(r) ? 'galón' : /\blitro/.test(r) ? 'litro' : /\b(lb|libra)/.test(r) ? 'lb' : /\bkg|kilo/.test(r) ? 'kg' : 'unidad';
  nombre = nombre.replace(/\s+hay$/i, '');
  return { original: linea.trim(), nombre: nombre.trim(), cantidad, unidadSugerida, detalle: resto.trim() };
}

// Ingrediente que se llama igual, o cuyo nombre contiene TODAS las palabras de la línea
// ("Salchicha" -> "Salchichas", "Barbacoa" -> "Salsa barbacoa"). Si hay duda, no sugiere nada.
export function parecido(nombre, insumos) {
  const a = palabras(nombre);
  if (!a.length) return null;
  const igual = (w, x) => x === w || (w.length >= 5 && x.length >= 5 && (x.startsWith(w) || w.startsWith(x)));
  let mejor = null, sobra = Infinity;
  for (const i of insumos) {
    const b = palabras(i.nombre);
    if (!a.every((w) => b.some((x) => igual(w, x)))) continue;
    const extra = b.length - a.length; // menos palabras de más = más parecido
    if (extra < sobra) { sobra = extra; mejor = i; }
  }
  return mejor;
}

export default function ConteoRapido({ insumos, esAdmin, onHecho }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState(null); // null = pegando la lista; [] = revisando
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const porId = useMemo(() => Object.fromEntries(insumos.map((i) => [String(i.id), i])), [insumos]);

  function cerrar() { setAbierto(false); setFilas(null); setTexto(''); setError(''); }

  function revisar() {
    const leidas = texto.split('\n').map(leerLinea).filter(Boolean);
    if (!leidas.length) return setError('Pega la lista primero.');
    setError('');
    setFilas(leidas.map((l, n) => {
      const igual = parecido(l.nombre, insumos);
      return {
        n, ...l,
        destino: igual ? String(igual.id) : esAdmin ? 'nuevo' : 'omitir',
        cantidad: l.cantidad ?? '',
        unidad: l.unidadSugerida,
      };
    }));
  }

  const cambiar = (n, cambios) => setFilas((fs) => fs.map((f) => (f.n === n ? { ...f, ...cambios } : f)));
  const activas = (filas || []).filter((f) => f.destino !== 'omitir');
  // Si dos líneas van al mismo ingrediente (p. ej. "Leche entera" y "Leche para frappé"), se suman
  const sumas = {};
  for (const f of activas) if (f.destino !== 'nuevo') sumas[f.destino] = (sumas[f.destino] || 0) + 1;
  const sinCantidad = activas.filter((f) => f.cantidad === '' || !(Number(f.cantidad) >= 0));

  async function guardar() {
    if (!activas.length) return setError('No hay líneas para guardar.');
    if (sinCantidad.length) return setError(`Falta la cantidad de: ${sinCantidad.map((f) => f.nombre).join(', ')}.`);
    const juntas = {};
    const nuevas = [];
    for (const f of activas) {
      if (f.destino === 'nuevo') nuevas.push({ nombre: f.nombre, unidad: f.unidad, stock: Number(f.cantidad) });
      else juntas[f.destino] = (juntas[f.destino] || 0) + Number(f.cantidad);
    }
    const envio = [...Object.entries(juntas).map(([id, stock]) => ({ insumo_id: Number(id), stock })), ...nuevas];
    setGuardando(true); setError('');
    try {
      const r = await api('/insumos/conteo', { method: 'POST', body: { filas: envio } });
      cerrar();
      onHecho(`Conteo guardado: ${r.actualizados} ingredientes actualizados${r.creados ? ` y ${r.creados} nuevos` : ''}.`);
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  }

  return (
    <>
      <button className={btnSecundario} onClick={() => setAbierto(true)}><ClipboardPaste size={20} aria-hidden="true" /> Conteo rápido</button>
      {abierto && (
        <Modal titulo="Conteo rápido de inventario" onClose={cerrar} ancho="max-w-5xl">
          {!filas ? (
            <div className="space-y-4">
              <p className="text-tenue">Pega la lista como te la mandaron, una cosa por línea. Por ejemplo: <b className="text-tinta">Tocino = 7</b> o <b className="text-tinta">Aceite = 1 galón</b>. En el siguiente paso revisas a qué ingrediente va cada línea antes de guardar.</p>
              <textarea className={`${campo} h-72 py-3 font-mono`} value={texto} onChange={(e) => setTexto(e.target.value)}
                        placeholder={'Tocino = 7\nSalchicha = 7\nAceite = 1 galón'} aria-label="Lista del inventario" autoFocus />
              <Aviso tipo="error">{error}</Aviso>
              <div className="flex justify-end gap-2">
                <button className={btnSecundario} onClick={cerrar}>Cancelar</button>
                <button className={btnPrimario} onClick={revisar}>Revisar lista</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-tenue">La cantidad que pongas queda como lo que <b className="text-tinta">hay ahora</b>, en la unidad que usa el sistema para ese ingrediente. Los ingredientes que no están en la lista no cambian.</p>
              <div className="overflow-x-auto border border-borde rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-fondo text-tenue text-sm">
                    <tr><th className="px-3 py-2">Lo que pegaste</th><th className="px-3 py-2">Va a</th><th className="px-3 py-2">Había</th><th className="px-3 py-2">Hay ahora</th></tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const ins = porId[f.destino];
                      const omitida = f.destino === 'omitir';
                      return (
                        <tr key={f.n} className={`border-t border-borde ${omitida ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 font-bold">{f.original}</td>
                          <td className="px-3 py-2 min-w-[220px]">
                            <select className={`${campo} h-10`} value={f.destino} onChange={(e) => cambiar(f.n, { destino: e.target.value })}
                                    aria-label={`A qué ingrediente va ${f.nombre}`}>
                              {esAdmin && <option value="nuevo">+ Crear nuevo: {f.nombre}</option>}
                              <option value="omitir">No cargar esta línea</option>
                              {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                            </select>
                            {ins && sumas[f.destino] > 1 && <p className="text-xs font-semibold text-maiz mt-1">Se suma con otra línea</p>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-tenue">{ins ? `${num(ins.stock)} ${ins.unidad}` : f.destino === 'nuevo' ? 'Nuevo' : '—'}</td>
                          <td className="px-3 py-2">
                            {!omitida && (
                              <div className="flex items-center gap-2">
                                <input className={`${campo} h-10 w-24`} type="number" step="any" min="0" value={f.cantidad}
                                       onChange={(e) => cambiar(f.n, { cantidad: e.target.value })} aria-label={`Cantidad de ${f.nombre}`} />
                                {ins ? <span className="whitespace-nowrap">{ins.unidad}</span> : (
                                  <select className={`${campo} h-10 w-28`} value={f.unidad} onChange={(e) => cambiar(f.n, { unidad: e.target.value })} aria-label={`Unidad de ${f.nombre}`}>
                                    {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                                  </select>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Aviso tipo="error">{error}</Aviso>
              <div className="flex flex-wrap justify-between gap-2">
                <button className={btnSecundario} onClick={() => setFilas(null)}>Volver a la lista</button>
                <button className={btnPrimario} onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : `Guardar ${activas.length} líneas`}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
