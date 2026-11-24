import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Search, ShoppingBag, Trash2, Truck, UtensilsCrossed } from 'lucide-react';
import { api } from '../api';
import { Aviso, Campo, ZONAS, btnPrimario, btnSecundario, campo, dinero } from '../ui.jsx';

const TIPOS = [['mesa', 'Mesa', UtensilsCrossed], ['llevar', 'Para llevar', ShoppingBag], ['domicilio', 'A domicilio', Truck]];
const AYUDA_NOMBRE = { mesa: 'Mesa (opcional)', llevar: 'Nombre de quien recoge (opcional)', domicilio: 'Nombre de quien recibe (opcional)' };
const EJEMPLO_NOMBRE = { mesa: 'Ej: 3', llevar: 'Ej: Ana', domicilio: 'Ej: Ana' };

export default function NuevoPedido() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const carritoRef = useRef(null);
  const [platos, setPlatos] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [mesaId, setMesaId] = useState(params.get('mesa') || '');
  const [envio, setEnvio] = useState({});
  const [lineas, setLineas] = useState([]); // { plato_id, cantidad, nota }
  const [tipo, setTipo] = useState('mesa');
  const [referencia, setReferencia] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [zona, setZona] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [p, c, cfg, m] = await Promise.all([api('/platos'), api('/clientes'), api('/pedidos/config'), api('/mesas/estado')]);
      setPlatos(p); setClientes(c); setEnvio(cfg.envio); setMesas(m);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const mapa = useMemo(() => new Map((platos || []).map((p) => [p.id, p])), [platos]);
  const visibles = lineas.filter((l) => mapa.has(l.plato_id));
  const subtotal = visibles.reduce((s, l) => s + mapa.get(l.plato_id).precio * l.cantidad, 0);
  const costoEnvio = tipo === 'domicilio' && zona ? Number(envio[zona]) || 0 : 0;
  const total = subtotal + costoEnvio;
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

  // Al elegir un cliente registrado se completan los datos que ya tenemos de él
  function elegirCliente(id) {
    setClienteId(id);
    const c = clientes.find((x) => String(x.id) === String(id));
    if (!c) return;
    if (!referencia && tipo !== 'mesa') setReferencia(c.nombre);
    if (!telefono && c.telefono) setTelefono(c.telefono);
  }

  async function crear() {
    setError('');
    if (!visibles.length) return setError('Agrega al menos un plato al pedido.');
    if (tipo === 'mesa' && mesas.length > 0 && !mesaId) return setError('Elige la mesa del pedido.');
    if (tipo === 'domicilio' && !zona) return setError('Elige la zona de entrega.');
    if (tipo === 'domicilio' && !direccion.trim()) return setError('Escribe la dirección de entrega.');
    setEnviando(true);
    try {
      const r = await api('/pedidos', {
        method: 'POST',
        body: {
          tipo, referencia, cliente_id: clienteId || null,
          ...(tipo === 'mesa' && mesaId ? { mesa_id: Number(mesaId) } : {}),
          ...(tipo === 'domicilio' ? { zona, direccion, telefono } : {}),
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
        <h2 className="text-3xl font-bold mt-1">Nuevo pedido</h2>
        <p className="text-tenue text-lg">Toca un plato para agregarlo. Los que no se pueden servir aparecen apagados.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_380px]">
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
                            className={`relative text-left rounded-xl border p-3 min-h-[84px] ${p.disponible ? 'bg-white border-borde hover:border-cafe disabled:opacity-60' : 'bg-aji-suave/40 border-aji/30 text-tenue'}`}>
                      {n > 0 && <span className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-cafe text-white font-extrabold grid place-items-center">{n}</span>}
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

          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de pedido">
            {TIPOS.map(([valor, texto, Icono]) => (
              <button key={valor} type="button" role="radio" aria-checked={tipo === valor} onClick={() => setTipo(valor)}
                      className={`min-h-[64px] rounded-lg border text-sm font-bold flex flex-col items-center justify-center gap-1 px-1 ${tipo === valor ? 'border-cafe bg-cafe-suave text-cafe-oscuro' : 'border-borde bg-white hover:bg-fondo'}`}>
                <Icono size={20} aria-hidden="true" /> {texto}
              </button>
            ))}
          </div>

          {tipo === 'mesa' && mesas.length > 0 ? (
            <div>
              <p className="font-bold mb-1">¿Qué mesa es?</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mesa">
                {mesas.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={String(mesaId) === String(m.id)} onClick={() => setMesaId(String(m.id))}
                          className={`min-h-[56px] rounded-xl border px-1 text-sm font-bold ${String(mesaId) === String(m.id) ? 'border-cafe bg-cafe text-white' : m.ocupada ? 'border-maiz/50 bg-maiz-suave text-maiz' : 'border-borde bg-white hover:bg-cafe-suave'}`}>
                    {m.nombre}
                    <span className="block text-xs font-semibold">{m.ocupada ? 'Ocupada' : 'Libre'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Campo etiqueta={AYUDA_NOMBRE[tipo]}>
              <input className={campo} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={EJEMPLO_NOMBRE[tipo]} />
            </Campo>
          )}
          <Campo etiqueta="Cliente registrado (opcional)">
            <select className={campo} value={clienteId} onChange={(e) => elegirCliente(e.target.value)}>
              <option value="">Ninguno</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>

          {tipo === 'domicilio' && (
            <div className="space-y-3 rounded-xl bg-fondo p-3">
              <p className="font-bold">Entrega a domicilio</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Zona de entrega">
                {Object.keys(ZONAS).map((z) => (
                  <button key={z} type="button" role="radio" aria-checked={zona === z} onClick={() => setZona(z)}
                          className={`min-h-[64px] rounded-lg border font-bold px-2 ${zona === z ? 'border-hoja bg-hoja-suave text-hoja-oscuro' : 'border-borde bg-white hover:bg-fondo'}`}>
                    {ZONAS[z]}
                    <span className="block text-sm font-semibold">{envio[z] !== undefined ? `Envío ${dinero(envio[z])}` : ''}</span>
                  </button>
                ))}
              </div>
              <Campo etiqueta="Dirección de entrega">
                <input className={campo} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, aldea, casa, referencia..." maxLength={255} />
              </Campo>
              <Campo etiqueta="Teléfono (opcional)">
                <input className={campo} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="5555-5555" maxLength={30} />
              </Campo>
            </div>
          )}

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

          <div className="border-t border-borde pt-3 space-y-1">
            {tipo === 'domicilio' && (
              <>
                <div className="flex justify-between text-tenue"><span>Platos</span><span>{dinero(subtotal)}</span></div>
                <div className="flex justify-between text-tenue"><span>Envío{zona ? ` (${ZONAS[zona].toLowerCase()})` : ''}</span><span>{zona ? dinero(costoEnvio) : 'Elige la zona'}</span></div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-extrabold">{dinero(total)}</span>
            </div>
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
