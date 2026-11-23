import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import { api } from '../api';
import { Aviso, Campo, btnPrimario, btnSecundario, campo, dinero } from '../ui.jsx';

export default function NuevoPedido() {
  const navigate = useNavigate();
  const carritoRef = useRef(null);
  const [platos, setPlatos] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [lineas, setLineas] = useState([]); // { plato_id, cantidad, nota }
  const [tipo, setTipo] = useState('mesa');
  const [referencia, setReferencia] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api('/platos'), api('/clientes')]);
      setPlatos(p); setClientes(c);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const mapa = useMemo(() => new Map((platos || []).map((p) => [p.id, p])), [platos]);
  const visibles = lineas.filter((l) => mapa.has(l.plato_id));
  const total = visibles.reduce((s, l) => s + mapa.get(l.plato_id).precio * l.cantidad, 0);
  const unidades = visibles.reduce((s, l) => s + l.cantidad, 0);
  const enPedido = (id) => lineas.find((l) => l.plato_id === id)?.cantidad || 0;

  const agregar = (p) => setLineas((ls) => {
    const i = ls.findIndex((l) => l.plato_id === p.id);
    if (i === -1) return [...ls, { plato_id: p.id, cantidad: 1, nota: '' }];
    return ls.map((l, n) => (n === i && (p.porciones === null || l.cantidad < p.porciones) ? { ...l, cantidad: l.cantidad + 1 } : l));
  });
  const restar = (id) => setLineas((ls) => ls.flatMap((l) => (l.plato_id !== id ? [l] : l.cantidad > 1 ? [{ ...l, cantidad: l.cantidad - 1 }] : [])));
  const quitar = (id) => setLineas((ls) => ls.filter((l) => l.plato_id !== id));
  const cambiarNota = (id, nota) => setLineas((ls) => ls.map((l) => (l.plato_id === id ? { ...l, nota } : l)));

  async function crear() {
    setError('');
    if (!visibles.length) return setError('Agrega al menos un plato al pedido.');
    setEnviando(true);
    try {
      const r = await api('/pedidos', {
        method: 'POST',
        body: {
          tipo, referencia, cliente_id: clienteId || null,
          items: visibles.map((l) => ({ plato_id: l.plato_id, cantidad: l.cantidad, nota: l.nota })),
        },
      });
      navigate('/pedidos', { state: { aviso: `Pedido #${r.id} creado por ${dinero(r.total)}.` } });
    } catch (e) {
      setError(e.message);
      cargar(); // la disponibilidad pudo cambiar
    } finally { setEnviando(false); }
  }

  if (!platos) return error ? <Aviso tipo="error">{error}</Aviso> : <p className="text-tenue">Cargando la carta...</p>;

  const filtrados = platos.filter((p) => p.nombre.toLowerCase().includes(busca.toLowerCase()));
  const categorias = [...new Set(filtrados.map((p) => p.categoria))];

  return (
    <div className="space-y-5">
      <div>
        <Link to="/pedidos" className="inline-flex items-center gap-1 font-bold text-tenue hover:text-tinta"><ArrowLeft size={18} aria-hidden="true" /> Volver a pedidos</Link>
        <h2 className="text-3xl font-extrabold mt-1">Nuevo pedido</h2>
        <p className="text-tenue text-lg">Toca un plato para agregarlo. Los que no se pueden servir aparecen apagados.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <section className="space-y-5 min-w-0">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-tenue" aria-hidden="true" />
            <input className={`${campo} pl-10`} placeholder="Buscar plato" aria-label="Buscar plato" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {categorias.map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-xl font-extrabold">{cat}</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filtrados.filter((p) => p.categoria === cat).map((p) => {
                  const n = enPedido(p.id);
                  const sinMas = p.porciones !== null && n >= p.porciones;
                  return (
                    <button key={p.id} type="button" disabled={!p.disponible || sinMas} onClick={() => agregar(p)}
                            className={`relative text-left rounded-xl border p-3 min-h-[84px] ${p.disponible ? 'bg-white border-borde hover:border-hoja disabled:opacity-60' : 'bg-aji-suave/40 border-aji/30 text-tenue'}`}>
                      {n > 0 && <span className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-hoja text-white font-extrabold grid place-items-center">{n}</span>}
                      <span className="flex justify-between gap-2"><span className="font-extrabold">{p.nombre}</span><span className="font-extrabold whitespace-nowrap">{dinero(p.precio)}</span></span>
                      {!p.disponible
                        ? <span className="block text-sm font-semibold text-aji mt-1">No disponible: falta {p.faltantes.map((f) => f.nombre).join(', ')}</span>
                        : sinMas ? <span className="block text-sm font-semibold text-maiz mt-1">Ya agregaste todo lo que alcanza</span>
                        : p.porciones !== null && p.porciones <= 5 && <span className="block text-sm font-semibold text-maiz mt-1">Quedan pocas: {p.porciones}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <p className="text-tenue">No encontramos platos con ese nombre.</p>}
        </section>

        <aside ref={carritoRef} className="md:sticky md:top-4 md:self-start bg-white border border-borde rounded-xl p-4 space-y-4">
          <h3 className="text-xl font-extrabold">Pedido</h3>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de pedido">
            {[['mesa', 'Mesa', UtensilsCrossed], ['llevar', 'Para llevar', ShoppingBag]].map(([valor, texto, Icono]) => (
              <button key={valor} type="button" role="radio" aria-checked={tipo === valor} onClick={() => setTipo(valor)}
                      className={`h-12 rounded-lg border font-bold inline-flex items-center justify-center gap-2 ${tipo === valor ? 'border-hoja bg-hoja-suave text-hoja-oscuro' : 'border-borde bg-white hover:bg-fondo'}`}>
                <Icono size={18} aria-hidden="true" /> {texto}
              </button>
            ))}
          </div>
          <Campo etiqueta={tipo === 'mesa' ? 'Mesa (opcional)' : 'Nombre de quien recoge (opcional)'}>
            <input className={campo} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={tipo === 'mesa' ? 'Ej: 3' : 'Ej: Ana'} />
          </Campo>
          <Campo etiqueta="Cliente registrado (opcional)">
            <select className={campo} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Ninguno</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>

          <div className="space-y-3 border-t border-borde pt-3">
            {visibles.length === 0 && <p className="text-tenue">Todavía no hay platos en el pedido.</p>}
            {visibles.map((l) => {
              const p = mapa.get(l.plato_id);
              const sinMas = p.porciones !== null && l.cantidad >= p.porciones;
              return (
                <div key={l.plato_id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-bold leading-tight">{p.nombre}</span>
                    <span className="font-bold whitespace-nowrap">{dinero(p.precio * l.cantidad)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className={`${btnSecundario} !px-3`} onClick={() => restar(l.plato_id)} aria-label={`Quitar una unidad de ${p.nombre}`}><Minus size={18} /></button>
                    <span className="w-8 text-center text-lg font-extrabold">{l.cantidad}</span>
                    <button type="button" className={`${btnSecundario} !px-3`} disabled={sinMas} onClick={() => agregar(p)} aria-label={`Agregar una unidad de ${p.nombre}`}><Plus size={18} /></button>
                    <input className={`${campo} !h-11 flex-1 min-w-0`} value={l.nota} maxLength={255} onChange={(e) => cambiarNota(l.plato_id, e.target.value)}
                           placeholder="Nota (sin cebolla, base Nutella...)" aria-label={`Nota para ${p.nombre}`} />
                    <button type="button" className="rounded-lg p-2 hover:bg-fondo" onClick={() => quitar(l.plato_id)} aria-label={`Quitar ${p.nombre} del pedido`}><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-borde pt-3">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-extrabold">{dinero(total)}</span>
          </div>
          <Aviso tipo="error">{error}</Aviso>
          <button className={`${btnPrimario} w-full h-12 text-lg`} disabled={enviando || visibles.length === 0} onClick={crear}>
            {enviando ? 'Creando...' : 'Crear pedido'}
          </button>
        </aside>
      </div>

      {unidades > 0 && (
        <button type="button" onClick={() => carritoRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className={`${btnPrimario} md:hidden fixed bottom-20 inset-x-4 z-30 h-12 shadow-lg justify-between`}>
          <span>Ver pedido ({unidades})</span><span>{dinero(total)}</span>
        </button>
      )}
    </div>
  );
}
