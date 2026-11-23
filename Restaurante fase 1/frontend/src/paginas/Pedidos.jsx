import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeftRight, Ban, BellRing, Banknote, CheckCheck, ChefHat, Clock, CreditCard,
  Plus, RefreshCw, ShoppingBag, UtensilsCrossed, Wallet,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { Aviso, Etiqueta, Modal, btnPeligro, btnPrimario, btnSecundario, dinero } from '../ui.jsx';

const ESTADOS = {
  pendiente: { texto: 'Pendiente', tono: 'ambar', icono: Clock },
  preparando: { texto: 'Preparando', tono: 'ambar', icono: ChefHat },
  listo: { texto: 'Listo para entregar', tono: 'verde', icono: BellRing },
  entregado: { texto: 'Entregado', tono: 'gris', icono: CheckCheck },
  cancelado: { texto: 'Cancelado', tono: 'rojo', icono: Ban },
};
const ACCION = { pendiente: 'Empezar a preparar', preparando: 'Marcar como listo', listo: 'Entregar' };
const METODOS = [['efectivo', 'Efectivo', Banknote], ['tarjeta', 'Tarjeta', CreditCard], ['transferencia', 'Transferencia', ArrowLeftRight]];
const VISTAS = [['proceso', 'En proceso'], ['finalizados', 'Finalizados hoy'], ['cancelados', 'Cancelados hoy']];
const VACIO = {
  proceso: 'No hay pedidos en proceso.',
  finalizados: 'Todavía no hay pedidos finalizados hoy. Un pedido termina cuando está entregado y pagado.',
  cancelados: 'No hay pedidos cancelados hoy.',
};

const hora = (iso) => new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

function Tarjeta({ p, rol, ocupado, onAvanzar, onCobrar, onCancelar }) {
  const e = ESTADOS[p.estado];
  const puedeCaja = ['admin', 'cajero'].includes(rol);
  const abierto = p.estado !== 'cancelado' && !(p.estado === 'entregado' && p.pagado);
  const siguiente = ACCION[p.estado];
  const puedeAvanzar = siguiente && (p.estado !== 'listo' || puedeCaja);
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(p.creado_en).getTime()) / 60000));
  const Tipo = p.tipo === 'llevar' ? ShoppingBag : UtensilsCrossed;
  const metodo = METODOS.find((m) => m[0] === p.metodo_pago)?.[1];

  return (
    <article className="rounded-xl border border-borde bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold">Pedido #{p.id}</h3>
          <p className="flex items-center gap-1.5 text-tenue font-semibold">
            <Tipo size={16} aria-hidden="true" />
            {p.tipo === 'llevar' ? 'Para llevar' : 'Mesa'}{p.referencia ? `: ${p.referencia}` : ''}
          </p>
          {p.cliente && <p className="text-sm text-tenue">Cliente: {p.cliente}</p>}
        </div>
        <span className="text-sm text-tenue text-right">
          {hora(p.creado_en)}
          {abierto && <><br />hace {minutos} min</>}
        </span>
      </div>

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
          ? <Etiqueta tono="verde" icono={Banknote}>Pagado{metodo ? `: ${metodo}` : ''}</Etiqueta>
          : p.estado !== 'cancelado' && <Etiqueta tono="ambar" icono={Wallet}>Sin pagar</Etiqueta>}
      </div>

      {abierto && (
        <div className="flex flex-wrap gap-2">
          {puedeAvanzar && <button className={btnPrimario} disabled={ocupado} onClick={() => onAvanzar(p)}>{siguiente}</button>}
          {puedeCaja && !p.pagado && (
            <button className={btnSecundario} disabled={ocupado} onClick={() => onCobrar(p)}><Banknote size={18} aria-hidden="true" /> Cobrar</button>
          )}
          {puedeCaja && !p.pagado && p.estado !== 'entregado' && (
            <button className={btnSecundario} disabled={ocupado} onClick={() => onCancelar(p)}>Cancelar pedido</button>
          )}
        </div>
      )}
    </article>
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

  async function hacer(fn, mensaje) {
    setOcupado(true);
    try { await fn(); if (mensaje) setAviso(mensaje); setError(''); } catch (e) { setError(e.message); }
    setOcupado(false);
    cargar();
  }

  const avanzar = (p) => hacer(() => api(`/pedidos/${p.id}/avanzar`, { method: 'POST' }));
  const cobrar = async (metodo) => {
    const p = cobrando;
    setCobrando(null);
    await hacer(() => api(`/pedidos/${p.id}/pago`, { method: 'POST', body: { metodo } }), `Pedido #${p.id} cobrado.`);
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
                     onAvanzar={avanzar} onCobrar={setCobrando} onCancelar={setCancelando} />
          ))}
        </div>
      )}

      {cobrando && (
        <Modal titulo={`Cobrar pedido #${cobrando.id}`} onClose={() => setCobrando(null)}>
          <p className="text-3xl font-extrabold mb-4">{dinero(cobrando.total)}</p>
          <p className="text-tenue mb-3">¿Cómo pagó el cliente?</p>
          <div className="grid gap-2">
            {METODOS.map(([valor, texto, Icono]) => (
              <button key={valor} className={`${btnSecundario} justify-start h-14 text-lg`} disabled={ocupado} onClick={() => cobrar(valor)}>
                <Icono size={22} aria-hidden="true" /> {texto}
              </button>
            ))}
          </div>
        </Modal>
      )}

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
