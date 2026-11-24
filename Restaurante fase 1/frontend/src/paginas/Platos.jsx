import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { Aviso, Campo, Etiqueta, Modal, btnPeligro, btnPrimario, btnSecundario, campo, dinero } from '../ui.jsx';

const VACIO = { nombre: '', descripcion: '', categoria: '', precio: '', ingredientes: [] };
const pct = (n) => `${Number(n).toLocaleString('es-GT', { maximumFractionDigits: 1 })}%`;

// Ganancia y margen: en verde si queda ganancia, en rojo si el plato se vende al costo o con pérdida
function Ganancia({ p }) {
  if (!p.ingredientes.length) return <span className="text-tenue">Sin receta</span>;
  const mala = p.ganancia <= 0;
  return (
    <span className="whitespace-nowrap">
      <span className={`font-bold ${mala ? 'text-aji' : 'text-hoja-oscuro'}`}>{dinero(p.ganancia)}</span>
      {p.margen !== null && <span className="block text-sm text-tenue">{pct(p.margen)} del precio</span>}
    </span>
  );
}

export default function Platos() {
  const [platos, setPlatos] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(null); // null cerrado, objeto = formulario
  const [errForm, setErrForm] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [quitando, setQuitando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [p, i] = await Promise.all([api('/platos'), api('/insumos')]);
      setPlatos(p); setInsumos(i); setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const insumo = (id) => insumos.find((i) => String(i.id) === String(id));
  const unidad = (id) => insumo(id)?.unidad || '';
  const costoFila = (ing) => (Number(ing.cantidad) || 0) * (Number(insumo(ing.insumo_id)?.costo) || 0);
  const cambiarIng = (n, cambios) => setEditando({
    ...editando, ingredientes: editando.ingredientes.map((x, i) => (i === n ? { ...x, ...cambios } : x)),
  });

  function abrirEditar(p) {
    setErrForm('');
    setEditando({
      id: p.id, nombre: p.nombre, descripcion: p.descripcion || '', categoria: p.categoria, precio: p.precio,
      ingredientes: p.ingredientes.map((i) => ({ insumo_id: i.insumo_id, cantidad: i.cantidad })),
    });
  }

  async function guardar(e) {
    e.preventDefault();
    if (!editando.nombre.trim()) return setErrForm('Escribe el nombre del plato.');
    if (editando.precio === '') return setErrForm('Escribe el precio.');
    setGuardando(true);
    try {
      const body = { ...editando };
      if (editando.id) await api(`/platos/${editando.id}`, { method: 'PUT', body });
      else await api('/platos', { method: 'POST', body });
      setEditando(null); setAviso('Plato guardado.'); cargar();
    } catch (err) { setErrForm(err.message); } finally { setGuardando(false); }
  }

  async function quitar() {
    try {
      await api(`/platos/${quitando.id}`, { method: 'DELETE' });
      setAviso(`Se quitó ${quitando.nombre} de la carta.`); setQuitando(null); cargar();
    } catch (err) { setError(err.message); setQuitando(null); }
  }

  const categorias = [...new Set((platos || []).map((p) => p.categoria))];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Platos y recetas</h2>
          <p className="text-tenue text-lg">Lo que vendes y qué ingredientes lleva cada porción.</p>
        </div>
        <button className={btnPrimario} onClick={() => { setErrForm(''); setEditando(VACIO); }}>
          <Plus size={20} aria-hidden="true" /> Nuevo plato
        </button>
      </div>

      <Aviso>{aviso}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      {!platos ? <p className="text-tenue">Cargando...</p> : platos.length === 0 ? (
        <div className="bg-white border border-borde rounded-xl p-8 text-center text-tenue">
          Aún no hay platos. Crea el primero y agrégale su receta para que la carta sepa cuándo está disponible.
        </div>
      ) : (
        <div className="bg-white border border-borde rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-fondo text-tenue">
              <tr>
                <th className="px-4 py-3 font-bold">Plato</th><th className="px-4 py-3 font-bold">Categoría</th>
                <th className="px-4 py-3 font-bold">Precio</th><th className="px-4 py-3 font-bold">Costo</th>
                <th className="px-4 py-3 font-bold">Ganancia</th><th className="px-4 py-3 font-bold">Receta</th>
                <th className="px-4 py-3 font-bold">Estado</th><th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {platos.map((p) => (
                <tr key={p.id} className="border-t border-borde">
                  <td className="px-4 py-3 font-bold">{p.nombre}</td>
                  <td className="px-4 py-3">{p.categoria}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{dinero(p.precio)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.ingredientes.length ? dinero(p.costo) : '-'}
                    {p.sin_costo?.length > 0 && <span className="block text-sm text-aji font-semibold">{p.sin_costo.length === 1 ? '1 ingrediente' : `${p.sin_costo.length} ingredientes`} sin costo</span>}
                  </td>
                  <td className="px-4 py-3"><Ganancia p={p} /></td>
                  <td className="px-4 py-3">{p.ingredientes.length ? `${p.ingredientes.length} ingredientes` : 'Sin receta'}</td>
                  <td className="px-4 py-3">{p.disponible ? <Etiqueta tono="verde">Disponible</Etiqueta> : <Etiqueta tono="rojo">No disponible</Etiqueta>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button className={btnSecundario} onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`}><Pencil size={18} aria-hidden="true" /> Editar</button>
                      <button className={btnSecundario} onClick={() => setQuitando(p)} aria-label={`Quitar ${p.nombre}`}><Trash2 size={18} aria-hidden="true" /> Quitar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <Modal titulo={editando.id ? 'Editar plato' : 'Nuevo plato'} onClose={() => setEditando(null)} ancho="max-w-2xl">
          <form onSubmit={guardar} className="space-y-4">
            <Campo etiqueta="Nombre del plato">
              <input className={campo} value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} autoFocus />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Categoría (opcional)" ayuda="Ej: Platos fuertes, Bebidas, Postres.">
                <input className={campo} list="categorias" value={editando.categoria} onChange={(e) => setEditando({ ...editando, categoria: e.target.value })} />
                <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              </Campo>
              <Campo etiqueta="Precio (Q)">
                <input className={campo} type="number" step="any" min="0" value={editando.precio} onChange={(e) => setEditando({ ...editando, precio: e.target.value })} />
              </Campo>
            </div>
            <Campo etiqueta="Descripción (opcional)">
              <input className={campo} value={editando.descripcion} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} />
            </Campo>

            <fieldset className="rounded-xl border border-borde p-4 space-y-3">
              <legend className="px-2 font-extrabold">Receta: qué lleva una porción</legend>
              <p className="text-sm text-tenue">El plato se marca como no disponible cuando falta alguno de estos ingredientes.</p>
              {editando.ingredientes.map((ing, n) => (
                <div key={n} className="flex gap-2 items-center">
                  <select className={`${campo} flex-1 min-w-0`} aria-label="Ingrediente" value={ing.insumo_id} onChange={(e) => cambiarIng(n, { insumo_id: e.target.value })}>
                    <option value="">Elige un ingrediente</option>
                    {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                  </select>
                  <input className={`${campo.replace('w-full', '')} w-24 shrink-0`} type="number" step="any" min="0" aria-label="Cantidad" placeholder="0" value={ing.cantidad}
                         onChange={(e) => cambiarIng(n, { cantidad: e.target.value })} />
                  <span className="w-12 shrink-0 text-sm text-tenue">{unidad(ing.insumo_id)}</span>
                  <span className="w-16 shrink-0 text-right text-sm font-bold whitespace-nowrap" title="Costo de esta cantidad">{ing.insumo_id ? dinero(costoFila(ing)) : ''}</span>
                  <button type="button" className="rounded-lg p-2 hover:bg-fondo" aria-label="Quitar ingrediente"
                          onClick={() => setEditando({ ...editando, ingredientes: editando.ingredientes.filter((_, i) => i !== n) })}>
                    <X size={20} />
                  </button>
                </div>
              ))}
              {insumos.length === 0 && <p className="text-sm text-aji font-semibold">Primero agrega ingredientes en Inventario.</p>}
              {editando.ingredientes.length > 0 && (() => {
                const costo = editando.ingredientes.reduce((t, ing) => t + costoFila(ing), 0);
                const precio = Number(editando.precio) || 0;
                const ganancia = precio - costo;
                const sinCosto = editando.ingredientes.filter((ing) => ing.insumo_id && !(Number(insumo(ing.insumo_id)?.costo) > 0)).length;
                return (
                  <div className="rounded-xl bg-fondo p-4 grid gap-2 sm:grid-cols-3" aria-live="polite">
                    <div><p className="text-sm text-tenue">Te cuesta hacerlo</p><p className="text-xl font-extrabold">{dinero(costo)}</p></div>
                    <div><p className="text-sm text-tenue">Lo vendes a</p><p className="text-xl font-extrabold">{dinero(precio)}</p></div>
                    <div><p className="text-sm text-tenue">Ganas por porción</p>
                      <p className={`text-xl font-extrabold ${ganancia > 0 ? 'text-hoja-oscuro' : 'text-aji'}`}>{dinero(ganancia)}{precio > 0 && <span className="text-sm font-bold"> ({pct((ganancia / precio) * 100)})</span>}</p></div>
                    {sinCosto > 0 && <p className="sm:col-span-3 text-sm text-aji font-semibold">{sinCosto === 1 ? '1 ingrediente no tiene' : `${sinCosto} ingredientes no tienen`} costo. Agrégalo en Inventario para que el cálculo sea real.</p>}
                  </div>
                );
              })()}
              <button type="button" className={btnSecundario} disabled={insumos.length === 0}
                      onClick={() => setEditando({ ...editando, ingredientes: [...editando.ingredientes, { insumo_id: '', cantidad: '' }] })}>
                <Plus size={18} aria-hidden="true" /> Agregar ingrediente
              </button>
            </fieldset>

            <Aviso tipo="error">{errForm}</Aviso>
            <div className="flex gap-2 justify-end">
              <button type="button" className={btnSecundario} onClick={() => setEditando(null)}>Cancelar</button>
              <button className={btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {quitando && (
        <Modal titulo={`¿Quitar ${quitando.nombre}?`} onClose={() => setQuitando(null)}>
          <p className="text-tenue mb-5">Dejará de aparecer en la carta.</p>
          <div className="flex gap-2 justify-end">
            <button className={btnSecundario} onClick={() => setQuitando(null)}>Cancelar</button>
            <button className={btnPeligro} onClick={quitar}>Sí, quitar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
