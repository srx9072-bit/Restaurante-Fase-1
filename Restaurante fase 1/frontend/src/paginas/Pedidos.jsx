import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowLeftRight, Ban, BellRing, Banknote, CheckCheck, ChefHat, Clock, CreditCard,
  Plus, Receipt, RefreshCw, ShoppingBag, Truck, UtensilsCrossed, Wallet,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import Recibo from '../Recibo.jsx';
import { Aviso, Campo, Etiqueta, METODOS_PAGO, Modal, ZONAS, btnPeligro, btnPrimario, btnSecundario, campo, dinero } from '../ui.jsx';

const ESTADOS = {
  pendiente: { texto: 'Pendiente', tono: 'ambar', icono: Clock },
  preparando: { texto: 'Preparando', tono: 'ambar', icono: ChefHat },
  listo: { texto: 'Listo para entregar', tono: 'verde', icono: BellRing },
  entregado: { texto: 'Entregado', tono: 'gris', icono: CheckCheck },
  cancelado: { texto: 'Cancelado', tono: 'rojo', icono: Ban },
};
const ICONO_PAGO = { efectivo: Banknote, tarjeta: CreditCard, transferencia: ArrowLeftRight };
const TIPOS = {
  mesa: ['Mesa', UtensilsCrossed],
  llevar: ['Para llevar', ShoppingBag],
  domicilio: ['A domicilio', Truck],
};
const VISTAS = [['proceso', 'En proceso'], ['finalizados', 'Finalizados hoy'], ['cancelados', 'Cancelados hoy']];
const VACIO = {
  proceso: 'No hay pedidos en proceso.',
  finalizados: 'Todavía no hay pedidos finalizados hoy. Un pedido termina cuando está entregado y pagado.',
  cancelados: 'No hay pedidos cancelados hoy.',
};

const hora = (iso) => new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
const accionDe = (p) => {
  if (p.estado === 'pendiente') return 'Empezar a preparar';
  if (p.estado === 'preparando') return 'Marcar como listo';
  if (p.estado === 'listo') return p.tipo === 'domicilio' ? 'Entregado al cliente' : 'Entregar';
  return null;
};

function Tarjeta({ p, rol, ocupado, onAvanzar, onCobrar, onCancelar, onRecibo }) {
  const e = ESTADOS[p.estado];
  const puedeCaja = ['admin', 'cajero'].includes(rol);
  const abierto = p.estado !== 'cancelado' && !(p.estado === 'entregado' && p.pagado);
  const siguiente = accionDe(p);
  const puedeAvanzar = siguiente && (p.estado !== 'listo' || puedeCaja);
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(p.creado_en).getTime()) / 60000));
  const [textoTipo, Tipo] = TIPOS[p.tipo];
  const IconoPago = ICONO_PAGO[p.metodo_pago] || Banknote;
  const envio = Number(p.costo_envio) || 0;

  return (
    <article className="rounded-xl border border-borde bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold">Pedido #{p.id}</h3>
          <p className="flex items-center gap-1.5 text-tenue font-semibold">
            <Tipo size={16} aria-hidden="true" />
            {textoTipo}{p.referencia ? `: ${p.referencia}` : ''}
          </p>
          {p.cliente && <p className="text-sm text-tenue">Cliente: {p.cliente}</p>}
        </div>
        <span className="text-sm text-tenue text-right">
          {hora(p.creado_en)}
          {abierto && <><br />hace {minutos} min</>}
        </span>
      </div>

      {p.tipo === 'domicilio' && (
        <div className="rounded-lg bg-fondo p-3 text-sm space-y-0.5">
          <p className="font-bold">{ZONAS[p.zona_envio]} · envío {dinero(envio)}</p>
          <p>{p.direccion}</p>
          {p.telefono && <p className="text-tenue">Tel: {p.telefono}</p>}
        </div>
      )}

      <ul className="space-y-1">
        {p.items.map((i) => (
          <li key={i.id}>
            <span className="font-bold">{i.cantidad}×</span> {i.nombre}
            {i.nota && <span className="block text-sm text-tenue italic">{i.nota}</span>}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-borde pt-3">
        <span className="text-xl font-extrabold mr-auto">{dinero(p.total)}</span>
        <Etiqueta tono={e.tono} icono={e.icono}>{e.texto}</Etiqueta>
        {p.pagado
          ? <Etiqueta tono="verde" icono={IconoPago}>Pagado: {METODOS_PAGO[p.metodo_pago]}</Etiqueta>
          : p.estado !== 'cancelado' && <Etiqueta tono="ambar" icono={Wallet}>Sin pagar</Etiqueta>}
      </div>
      {p.pagado && p.metodo_pago === 'efectivo' && p.recibido != null && Number(p.cambio) > 0 && (
        <p className="text-sm text-tenue -mt-1">Recibido {dinero(p.recibido)} · cambio {dinero(p.cambio)}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {abierto && puedeAvanzar && <button className={btnPrimario} disabled={ocupado} onClick={() => onAvanzar(p)}>{siguiente}</button>}
        {abierto && puedeCaja && !p.pagado && (
          <button className={btnSecundario} disabled={ocupado} onClick={() => onCobrar(p)}><Banknote size={18} aria-hidden="true" /> Cobrar</button>
        )}
        {puedeCaja && p.estado !== 'cancelado' && (
          <button className={btnSecundario} onClick={() => onRecibo(p)}><Receipt size={18} aria-hidden="true" /> Recibo</button>
        )}
        {abierto && puedeCaja && !p.pagado && p.estado !== 'entregado' && (
          <button className={btnSecundario} disabled={ocupado} onClick={() => onCancelar(p)}>Cancelar pedido</button>
        )}
      </div>
    </article>
  );
}

// Elegir cómo pagó el cliente. En efectivo se calcula el cambio.
function CobroModal({ pedido, ocupado, onClose, onPagar }) {
  const [efectivo, setEfectivo] = useState(false);
  const [recibido, setRecibido] = useState('');
  const total = Number(pedido.total);
  const dado = Number(recibido);
  const valido = recibido !== '' && Number.isFinite(dado) && dado + 1e-9 >= total;
  const cambio = valido ? Math.round((dado - total) * 100) / 100 : 0;
  const rapidos = [...new Set([total, ...[10, 20, 50, 100, 200, 500].filter((b) => b > total)])].slice(0, 4);
  const metodos = [['efectivo', Banknote], ['tarjeta', CreditCard], ['transferencia', ArrowLeftRight]];

  return (
    <Modal titulo={`Cobrar pedido #${pedido.id}`} onClose={onClose}>
      <p className="text-sm text-tenue">Total a pagar</p>
      <p className="text-4xl font-extrabold">{dinero(total)}</p>
      {Number(pedido.costo_envio) > 0 && <p className="text-sm text-tenue">Incluye envío de {dinero(pedido.costo_envio)}</p>}

      {!efectivo ? (
        <>
          <p className="text-tenue mt-4 mb-3">¿Cómo pagó el cliente?</p>
          <div className="grid gap-2">
            {metodos.map(([valor, Icono]) => (
              <button key={valor} className={`${btnSecundario} justify-start h-14 text-lg`} disabled={ocupado}
                      onClick={() => (valor === 'efectivo' ? setEfectivo(true) : onPagar(valor))}>
                <Icono size={22} aria-hidden="true" /> {METODOS_PAGO[valor]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <Campo etiqueta="¿Con cuánto paga el cliente?">
            <input className={`${campo} text-xl`} type="number" inputMode="decimal" min="0" step="any" autoFocus
                   value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="0.00" />
          </Campo>
          <div className="flex flex-wrap gap-2">
            {rapidos.map((v) => (
              <button key={v} type="button" className={btnSecundario} onClick={() => setRecibido(String(v))}>
                {v === total ? 'Exacto' : dinero(v)}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-fondo p-4" aria-live="polite">
            {valido ? (
              <>
                <p className="text-sm text-tenue">Cambio a entregar</p>
                <p className="text-4xl font-extrabold text-hoja-oscuro">{dinero(cambio)}</p>
              </>
            ) : recibido !== '' ? (
              <p className="text-lg font-bold text-aji">Faltan {dinero(Math.max(0, total - (Number.isFinite(dado) ? dado : 0)))}</p>
            ) : <p className="text-tenue">Escribe cuánto dinero entrega el cliente.</p>}
          </div>
          <div className="flex gap-2 justify-between">
            <button className={btnSecundario} onClick={() => setEfectivo(false)}><ArrowLeft size={18} aria-hidden="true" /> Otro método</button>
            <button className={btnPrimario} disabled={!valido || ocupado} onClick={() => onPagar('efectivo', dado)}>Confirmar cobro</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Pedidos() {
  const { usuario } = useAuth();
  const location = useLocation();
  const puedeCaja = ['admin', 'cajero'].includes(usuario.rol);
  const [vista, setVista] = useState('proceso');
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(location.state?.aviso || '');
  const [cobrando, setCobrando] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setPedidos(await api(`/pedidos?vista=${vista}`)); setError(''); } catch (e) { setError(e.message); }
  }, [vista]);

  useEffect(() => {
    setPedidos(null);
    cargar();
    const t = setInterval(cargar, 15000); // se actualiza sola cada 15 segundos
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function hacer(fn) {
    setOcupado(true);
    try { await fn(); setError(''); } catch (e) { setError(e.message); }
    setOcupado(false);
    cargar();
  }

  const avanzar = (p) => hacer(() => api(`/pedidos/${p.id}/avanzar`, { method: 'POST' }));

  const pagar = async (metodo, recibido) => {
    const p = cobrando;
    setCobrando(null);
    await hacer(async () => {
      const r = await api(`/pedidos/${p.id}/pago`, { method: 'POST', body: { metodo, recibido } });
      setAviso(`Pedido #${p.id} cobrado.`);
      setRecibo(r.pedido); // ofrece imprimir el recibo enseguida
    });
  };

  const cancelar = async () => {
    const p = cancelando;
    setCancelando(null);
    await hacer(async () => {
      const r = await api(`/pedidos/${p.id}/cancelar`, { method: 'POST' });
      setAviso(r.stockDevuelto ? `Pedido #${p.id} cancelado. Los ingredientes volvieron al inventario.` : `Pedido #${p.id} cancelado.`);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-extrabold">Pedidos</h2>
          <p className="text-tenue text-lg">Lo que se está preparando y lo que ya se cobró.</p>
        </div>
        <div className="flex gap-2">
          <button className={btnSecundario} onClick={cargar}><RefreshCw size={18} aria-hidden="true" /> Actualizar</button>
          {puedeCaja && <Link to="/pedidos/nuevo" className={btnPrimario}><Plus size={20} aria-hidden="true" /> Nuevo pedido</Link>}
        </div>
      </div>

      <Aviso>{aviso}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Ver pedidos">
        {VISTAS.map(([valor, texto]) => (
          <button key={valor} onClick={() => setVista(valor)} aria-pressed={vista === valor}
                  className={`h-11 rounded-full px-5 font-bold border ${vista === valor ? 'bg-tinta text-white border-tinta' : 'bg-white border-borde hover:bg-fondo'}`}>
            {texto}
          </button>
        ))}
      </div>

      {!pedidos ? <p className="text-tenue">Cargando...</p> : pedidos.length === 0 ? (
        <div className="bg-white border border-borde rounded-xl p-8 text-center text-tenue">{VACIO[vista]}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pedidos.map((p) => (
            <Tarjeta key={p.id} p={p} rol={usuario.rol} ocupado={ocupado}
                     onAvanzar={avanzar} onCobrar={setCobrando} onCancelar={setCancelando} onRecibo={setRecibo} />
          ))}
        </div>
      )}

      {cobrando && <CobroModal pedido={cobrando} ocupado={ocupado} onClose={() => setCobrando(null)} onPagar={pagar} />}
      {recibo && <Recibo pedido={recibo} onClose={() => setRecibo(null)} />}

      {cancelando && (
        <Modal titulo={`¿Cancelar el pedido #${cancelando.id}?`} onClose={() => setCancelando(null)}>
          <p className="text-tenue mb-5">
            {cancelando.estado === 'pendiente'
              ? 'Todavía no se empezó a preparar, así que los ingredientes vuelven al inventario.'
              : 'Ya se empezó a preparar, así que los ingredientes NO vuelven al inventario.'}
          </p>
          <div className="flex gap-2 justify-end">
            <button className={btnSecundario} onClick={() => setCancelando(null)}>No, volver</button>
            <button className={btnPeligro} onClick={cancelar}>Sí, cancelar pedido</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
