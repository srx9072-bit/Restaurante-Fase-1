import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Aviso, Campo, Modal, btnPrimario, btnSecundario, campo, dinero, fechaHora, num } from '../ui.jsx';

const r2 = (n) => Math.round(n * 100) / 100;
const subtotal = (f) => r2((Number(f.cantidad) || 0) * (Number(f.costo_unitario) || 0));

// Pantalla para registrar una compra nueva
function NuevaCompra({ insumos, proveedores, onListo, onVolver }) {
  const [proveedor, setProveedor] = useState('');
  const [busca, setBusca] = useState('');
  const [filas, setFilas] = useState([]); // { insumo_id, nombre, unidad, cantidad, costo_unitario }
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const buscador = useRef(null);

  // Primero los insumos que surte el proveedor elegido, luego el resto
  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    // Orden: nombre exacto, luego los que empiezan con lo escrito, luego los del proveedor elegido
    const puntos = (i) => {
      const n = i.nombre.toLowerCase();
      return (n === t ? 4 : 0) + (n.startsWith(t) ? 2 : 0) + (String(i.proveedor_id) === proveedor ? 1 : 0);
    };
    return insumos
      .filter((i) => i.nombre.toLowerCase().includes(t))
      .sort((a, b) => puntos(b) - puntos(a) || a.nombre.localeCompare(b.nombre))
      .slice(0, 8);
  }, [busca, insumos, proveedor]);
  const delProveedor = insumos.filter((i) => proveedor && String(i.proveedor_id) === proveedor && !filas.some((f) => f.insumo_id === i.id));

  function agregar(i) {
    setError('');
    if (!filas.some((f) => f.insumo_id === i.id)) {
      setFilas([...filas, { insumo_id: i.id, nombre: i.nombre, unidad: i.unidad, stock: Number(i.stock), cantidad: '', costo_unitario: Number(i.costo) > 0 ? String(Number(i.costo)) : '' }]);
    }
    setBusca('');
    buscador.current?.focus();
  }
  const cambiar = (id, cambios) => setFilas(filas.map((f) => (f.insumo_id === id ? { ...f, ...cambios } : f)));
  const total = r2(filas.reduce((s, f) => s + subtotal(f), 0));
  const unidades = filas.reduce((s, f) => s + (Number(f.cantidad) || 0), 0);

  async function confirmar() {
    if (!proveedor) return setError('Elige el proveedor.');
    if (!filas.length) return setError('Agrega al menos un producto.');
    const mala = filas.find((f) => !(Number(f.cantidad) > 0) || f.costo_unitario === '' || Number(f.costo_unitario) < 0);
    if (mala) return setError(`Revisa la cantidad y el costo de ${mala.nombre}.`);
    setGuardando(true); setError('');
    try {
      const r = await api('/compras', { method: 'POST', body: { proveedor_id: proveedor, notas, items: filas } });
      onListo(r);
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  }

  return (
    <div className="space-y-5">
      <div className="tarjeta p-4 flex flex-wrap items-center gap-3">
        <button className="rounded-lg p-2 hover:bg-fondo" onClick={onVolver} aria-label="Volver a compras"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Nueva compra</h2>
          <p className="text-sm text-tenue">{filas.length} producto{filas.length === 1 ? '' : 's'} · {num(unidades)} unidades en total</p>
        </div>
        <div className="text-right"><p className="text-sm text-tenue">Costo total</p><p className="text-2xl font-extrabold text-cafe">{dinero(total)}</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px] items-start">
        <section className="tarjeta p-4 space-y-4 min-w-0">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-tenue" aria-hidden="true" />
            <input ref={buscador} className={`${campo} pl-10`} placeholder="Buscar producto del inventario por nombre..." aria-label="Buscar producto"
                   value={busca} onChange={(e) => setBusca(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); agregar(resultados[0]); } }} autoFocus />
            {resultados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl border border-borde bg-white shadow-suave overflow-hidden">
                {resultados.map((i) => (
                  <li key={i.id}>
                    <button className="w-full text-left px-4 py-2 hover:bg-cafe-suave flex justify-between gap-3" onClick={() => agregar(i)}>
                      <span className="font-bold">{i.nombre}</span>
                      <span className="text-sm text-tenue whitespace-nowrap">hay {num(i.stock)} {i.unidad}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busca.trim() && resultados.length === 0 && <p className="text-sm text-tenue mt-2">No hay productos con ese nombre. Créalo primero en Inventario.</p>}
          </div>

          {delProveedor.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-tenue">Lo que te surte este proveedor:</p>
              <div className="flex flex-wrap gap-2">
                {delProveedor.map((i) => (
                  <button key={i.id} className="rounded-full border border-borde bg-white px-3 h-9 text-sm font-bold hover:bg-cafe-suave flex items-center gap-1" onClick={() => agregar(i)}>
                    <Plus size={14} aria-hidden="true" /> {i.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-tenue">El costo unitario se guarda en el producto al confirmar, y la cantidad se suma a lo que hay en inventario.</p>
          {filas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-borde p-8 text-center text-tenue">Busca los productos que compraste y agrégalos aquí.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-sm text-tenue">
                  <tr><th className="py-2 pr-2">Producto</th><th className="py-2 px-2">Cantidad</th><th className="py-2 px-2">Costo unit. (Q)</th><th className="py-2 px-2 text-right">Subtotal</th><th className="py-2"><span className="sr-only">Quitar</span></th></tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {filas.map((f) => (
                    <tr key={f.insumo_id}>
                      <td className="py-2 pr-2"><span className="font-bold">{f.nombre}</span><span className="block text-sm text-tenue">Hay {num(f.stock)} {f.unidad}{Number(f.cantidad) > 0 && ` → quedarán ${num(f.stock + Number(f.cantidad))}`}</span></td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <input className={`${campo.replace('w-full', '')} w-24`} type="number" inputMode="decimal" min="0" step="any" aria-label={`Cantidad de ${f.nombre}`}
                                 value={f.cantidad} onChange={(e) => cambiar(f.insumo_id, { cantidad: e.target.value })} />
                          <span className="text-sm text-tenue">{f.unidad}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input className={`${campo.replace('w-full', '')} w-28`} type="number" inputMode="decimal" min="0" step="any" aria-label={`Costo por ${f.unidad} de ${f.nombre}`}
                               value={f.costo_unitario} onChange={(e) => cambiar(f.insumo_id, { costo_unitario: e.target.value })} placeholder="0.00" />
                      </td>
                      <td className="py-2 px-2 text-right font-extrabold whitespace-nowrap">{dinero(subtotal(f))}</td>
                      <td className="py-2 text-right">
                        <button className="rounded-lg p-2 text-tenue hover:bg-fondo hover:text-aji" aria-label={`Quitar ${f.nombre}`} onClick={() => setFilas(filas.filter((x) => x.insumo_id !== f.insumo_id))}><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="tarjeta p-4">
            <Campo etiqueta="Proveedor">
              <select className={campo} value={proveedor} onChange={(e) => { setProveedor(e.target.value); setError(''); }}>
                <option value="">Elige el proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
            {proveedores.length === 0 && <p className="text-sm text-aji font-semibold mt-2">Primero agrega tus proveedores.</p>}
          </div>
          <div className="tarjeta p-4">
            <Campo etiqueta="Notas (opcional)">
              <textarea className={`${campo} h-20 py-2`} maxLength={255} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura, referencia..." />
            </Campo>
          </div>
          <div className="tarjeta p-4 space-y-2">
            <h3 className="font-bold">Resumen de la compra</h3>
            <div className="flex justify-between text-tenue"><span>Productos distintos</span><span className="font-bold text-tinta">{filas.length}</span></div>
            <div className="flex justify-between text-tenue"><span>Unidades totales</span><span className="font-bold text-tinta">{num(unidades)}</span></div>
            <div className="flex justify-between text-lg font-extrabold border-t border-borde pt-2"><span>Costo total</span><span>{dinero(total)}</span></div>
            <Aviso tipo="error">{error}</Aviso>
            <button className={`${btnPrimario} w-full h-12 text-lg`} onClick={confirmar} disabled={guardando}>
              <CheckCircle2 size={20} aria-hidden="true" /> {guardando ? 'Guardando...' : 'Confirmar compra'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetalleCompra({ id, onClose }) {
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/compras/${id}`).then(setC).catch((e) => setError(e.message)); }, [id]);
  return (
    <Modal titulo={`Compra #${id}`} onClose={onClose} ancho="max-w-2xl">
      <Aviso tipo="error">{error}</Aviso>
      {!c ? !error && <p className="text-tenue">Cargando...</p> : (
        <div className="space-y-3">
          <p className="text-tenue">{fechaHora(c.creado_en)} · {c.proveedor || 'Proveedor eliminado'} · registró {c.usuario || '-'}</p>
          {c.notas && <p><span className="font-bold">Notas:</span> {c.notas}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-sm text-tenue"><tr><th className="py-2">Producto</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Costo unit.</th><th className="py-2 text-right">Subtotal</th></tr></thead>
              <tbody className="divide-y divide-borde">
                {c.items.map((i) => (
                  <tr key={i.id}><td className="py-2 font-bold">{i.nombre}</td><td className="py-2 text-right whitespace-nowrap">{num(i.cantidad)} {i.unidad}</td>
                    <td className="py-2 text-right">{dinero(i.costo_unitario)}</td><td className="py-2 text-right font-bold">{dinero(i.subtotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between text-xl font-extrabold border-t border-borde pt-3"><span>Total</span><span>{dinero(c.total)}</span></div>
        </div>
      )}
    </Modal>
  );
}

export default function Compras() {
  const [compras, setCompras] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [nueva, setNueva] = useState(false);
  const [viendo, setViendo] = useState(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [c, i, p] = await Promise.all([api('/compras'), api('/insumos'), api('/proveedores')]);
      setCompras(c); setInsumos(i); setProveedores(p); setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (nueva) {
    return <NuevaCompra insumos={insumos} proveedores={proveedores} onVolver={() => setNueva(false)}
                        onListo={(r) => { setNueva(false); setAviso(`Compra #${r.id} registrada por ${dinero(r.total)}. El inventario ya se actualizó.`); cargar(); }} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Compras</h2>
          <p className="text-tenue text-lg">Lo que compras a tus proveedores. Al confirmar, se suma al inventario.</p>
        </div>
        <button className={btnPrimario} onClick={() => { setAviso(''); setNueva(true); }}><ShoppingCart size={20} aria-hidden="true" /> Nueva compra</button>
      </div>
      <Aviso>{aviso}</Aviso>
      <Aviso tipo="error">{error}</Aviso>
      {!compras ? <p className="text-tenue">Cargando...</p> : compras.length === 0 ? (
        <div className="bg-white border border-borde rounded-xl p-8 text-center text-tenue">Aún no hay compras registradas.</div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-fondo text-tenue"><tr><th className="px-4 py-3">Compra</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Productos</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3"><span className="sr-only">Ver</span></th></tr></thead>
            <tbody className="divide-y divide-borde">
              {compras.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3"><span className="font-bold">#{c.id}</span><span className="block text-sm text-tenue">{fechaHora(c.creado_en)} · {c.usuario}</span></td>
                  <td className="px-4 py-3">{c.proveedor || '-'}{c.notas && <span className="block text-sm text-tenue">{c.notas}</span>}</td>
                  <td className="px-4 py-3">{c.productos}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{dinero(c.total)}</td>
                  <td className="px-4 py-3 text-right"><button className={btnSecundario} onClick={() => setViendo(c.id)}><Eye size={18} aria-hidden="true" /> Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viendo && <DetalleCompra id={viendo} onClose={() => setViendo(null)} />}
    </div>
  );
}
