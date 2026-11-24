import { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, ArrowLeftRight, Lock, LockOpen, Minus, Plus, Receipt, Wallet } from 'lucide-react';
import { api } from '../api';
import ReporteCaja from '../ReporteCaja.jsx';
import { Aviso, Campo, Etiqueta, Modal, btnPrimario, btnSecundario, campo, dinero, fechaHora, hora } from '../ui.jsx';

const pl = (n) => `${n} pedido${n === 1 ? '' : 's'}`;
const r2 = (n) => Math.round(n * 100) / 100;

function Dato({ icono: Icono, titulo, valor, detalle, fuerte }) {
  return (
    <div className={`rounded-2xl border p-4 ${fuerte ? 'bg-cafe text-white border-cafe' : 'bg-white border-borde shadow-suave'}`}>
      <p className={`flex items-center gap-2 text-sm font-bold ${fuerte ? 'text-[#F3E4D0]' : 'text-tenue'}`}><Icono size={18} aria-hidden="true" /> {titulo}</p>
      <p className="text-3xl font-bold mt-1">{valor}</p>
      {detalle && <p className={`text-sm ${fuerte ? 'text-[#F3E4D0]' : 'text-tenue'}`}>{detalle}</p>}
    </div>
  );
}

export default function Caja() {
  const [caja, setCaja] = useState(undefined); // undefined = cargando, null = cerrada
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [inicial, setInicial] = useState('');
  const [modal, setModal] = useState(null); // 'ingreso' | 'egreso' | 'cerrar'
  const [mov, setMov] = useState({ monto: '', concepto: '' });
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  const [reporte, setReporte] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [errModal, setErrModal] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([api('/caja/actual'), api('/caja/historial')]);
      setCaja(a.caja); setHistorial(h); setError('');
    } catch (e) { setError(e.message); setCaja((c) => (c === undefined ? null : c)); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function accion(fn, exito) {
    setOcupado(true); setErrModal('');
    try { const r = await fn(); setModal(null); if (exito) setAviso(exito); await cargar(); return r; }
    catch (e) { setErrModal(e.message); setError(modal ? '' : e.message); }
    finally { setOcupado(false); }
  }

  const abrir = (e) => { e.preventDefault(); accion(() => api('/caja/abrir', { method: 'POST', body: { monto_inicial: inicial } }), 'Caja abierta. ¡Buen turno!').then(() => setInicial('')); };
  const guardarMov = (e) => { e.preventDefault(); accion(() => api('/caja/movimientos', { method: 'POST', body: { tipo: modal, ...mov } }), 'Movimiento registrado.').then(() => setMov({ monto: '', concepto: '' })); };
  const cerrar = async (e) => {
    e.preventDefault();
    const r = await accion(() => api('/caja/cerrar', { method: 'POST', body: { contado, notas } }), 'Caja cerrada.');
    if (r) { setReporte(r); setContado(''); setNotas(''); }
  };
  const verReporte = async (id) => { try { setReporte(await api(`/caja/${id}`)); } catch (e) { setError(e.message); } };

  if (caja === undefined) return error ? <Aviso tipo="error">{error}</Aviso> : <p className="text-tenue">Cargando...</p>;

  const contadoNum = Number(contado);
  const dif = contado !== '' && Number.isFinite(contadoNum) && caja ? r2(contadoNum - caja.esperado) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Caja</h2>
          <p className="text-tenue text-lg">Abre tu turno con la caja chica y ciérrala al terminar el día.</p>
        </div>
        {caja && <Etiqueta tono="verde" icono={LockOpen}>Caja abierta desde las {hora(caja.abierta_en)}</Etiqueta>}
      </div>

      <Aviso>{aviso}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      {!caja ? (
        <form onSubmit={abrir} className="tarjeta p-6 max-w-lg space-y-4">
          <div className="flex items-center gap-3"><Lock size={28} className="text-cafe" aria-hidden="true" />
            <div><h3 className="text-xl font-bold">La caja está cerrada</h3><p className="text-tenue">No se puede cobrar hasta abrirla.</p></div></div>
          <Campo etiqueta="¿Con cuánto dinero empieza la caja chica?" ayuda="Es el efectivo para dar cambio. Si empieza vacía, escribe 0.">
            <input className={`${campo} text-xl`} type="number" inputMode="decimal" min="0" step="any" value={inicial} onChange={(e) => setInicial(e.target.value)} placeholder="0.00" required autoFocus />
          </Campo>
          <button className={`${btnPrimario} w-full h-12 text-lg`} disabled={ocupado}><LockOpen size={20} aria-hidden="true" /> Abrir caja</button>
        </form>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Dato icono={Wallet} titulo="Fondo inicial" valor={dinero(caja.monto_inicial)} />
            <Dato icono={Banknote} titulo="Ventas en efectivo" valor={dinero(caja.ventas.efectivo.total)} detalle={pl(caja.ventas.efectivo.cantidad)} />
            <Dato icono={CreditCard} titulo="Ventas con tarjeta" valor={dinero(caja.ventas.tarjeta.total)} detalle={pl(caja.ventas.tarjeta.cantidad)} />
            <Dato icono={ArrowLeftRight} titulo="Transferencias" valor={dinero(caja.ventas.transferencia.total)} detalle={pl(caja.ventas.transferencia.cantidad)} />
            <Dato icono={Receipt} titulo="Total vendido" valor={dinero(caja.total_ventas)} detalle={`${pl(caja.pedidos_cobrados)} cobrado${caja.pedidos_cobrados === 1 ? '' : 's'}`} />
            <Dato fuerte icono={Banknote} titulo="Efectivo que debe haber" valor={dinero(caja.esperado)} detalle="Fondo + efectivo + ingresos − egresos" />
          </div>

          {caja.pedidos_abiertos > 0 && <Aviso tipo="error">{Number(caja.pedidos_abiertos) === 1 ? 'Hay 1 pedido sin terminar.' : `Hay ${caja.pedidos_abiertos} pedidos sin terminar.`} Revisa que estén cobrados antes de cerrar la caja.</Aviso>}

          <section className="tarjeta p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-bold">Ingresos y egresos de efectivo</h3>
              <div className="flex gap-2">
                <button className={btnSecundario} onClick={() => { setErrModal(''); setModal('ingreso'); }}><Plus size={18} aria-hidden="true" /> Ingreso</button>
                <button className={btnSecundario} onClick={() => { setErrModal(''); setModal('egreso'); }}><Minus size={18} aria-hidden="true" /> Egreso</button>
              </div>
            </div>
            {caja.movimientos.length === 0 ? <p className="text-tenue">Aún no hay movimientos. Úsalo para compras pequeñas, retiros o dinero que agregas a la caja.</p> : (
              <ul className="divide-y divide-borde">
                {caja.movimientos.map((m) => (
                  <li key={m.id} className="py-2 flex items-center gap-3">
                    <span className="flex-1"><span className="font-bold">{m.concepto}</span><span className="block text-sm text-tenue">{hora(m.creado_en)} · {m.usuario}</span></span>
                    <span className={`font-extrabold ${m.tipo === 'egreso' ? 'text-aji' : 'text-hoja-oscuro'}`}>{m.tipo === 'egreso' ? '−' : '+'}{dinero(m.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button className={`${btnPrimario} h-12 text-lg`} onClick={() => { setErrModal(''); setModal('cerrar'); }}><Lock size={20} aria-hidden="true" /> Cerrar caja</button>
        </>
      )}

      <section className="space-y-2">
        <h3 className="text-xl font-bold">Cierres anteriores</h3>
        {historial.length === 0 ? <p className="text-tenue">Todavía no hay cierres de caja.</p> : (
          <div className="tarjeta overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-sm text-tenue"><tr><th className="px-4 py-3">Cierre</th><th className="px-4 py-3">Vendido</th><th className="px-4 py-3">Contado</th><th className="px-4 py-3">Diferencia</th><th className="px-4 py-3"><span className="sr-only">Ver</span></th></tr></thead>
              <tbody className="divide-y divide-borde">
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-3">{fechaHora(h.cerrada_en)}<span className="block text-sm text-tenue">{h.cerrada_por_nombre}</span></td>
                    <td className="px-4 py-3 font-bold">{dinero(h.total_ventas)}</td>
                    <td className="px-4 py-3">{dinero(h.contado)}</td>
                    <td className={`px-4 py-3 font-bold ${Number(h.diferencia) < 0 ? 'text-aji' : Number(h.diferencia) > 0 ? 'text-maiz' : 'text-hoja-oscuro'}`}>
                      {Number(h.diferencia) === 0 ? 'Cuadra' : `${Number(h.diferencia) > 0 ? 'Sobra ' : 'Falta '}${dinero(Math.abs(h.diferencia))}`}</td>
                    <td className="px-4 py-3 text-right"><button className={btnSecundario} onClick={() => verReporte(h.id)}>Ver reporte</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(modal === 'ingreso' || modal === 'egreso') && (
        <Modal titulo={modal === 'ingreso' ? 'Ingreso de efectivo' : 'Egreso de efectivo'} onClose={() => setModal(null)}>
          <form onSubmit={guardarMov} className="space-y-4">
            <Campo etiqueta="Monto"><input className={`${campo} text-xl`} type="number" inputMode="decimal" min="0" step="any" value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} required autoFocus /></Campo>
            <Campo etiqueta={modal === 'ingreso' ? '¿De dónde viene?' : '¿En qué se usó?'}>
              <input className={campo} maxLength={120} value={mov.concepto} onChange={(e) => setMov({ ...mov, concepto: e.target.value })} placeholder={modal === 'ingreso' ? 'Ej: Más billetes para cambio' : 'Ej: Compra de hielo'} required />
            </Campo>
            <Aviso tipo="error">{errModal}</Aviso>
            <div className="flex gap-2 justify-end"><button type="button" className={btnSecundario} onClick={() => setModal(null)}>Cancelar</button><button className={btnPrimario} disabled={ocupado}>Guardar</button></div>
          </form>
        </Modal>
      )}

      {modal === 'cerrar' && caja && (
        <Modal titulo="Cerrar caja" onClose={() => setModal(null)}>
          <form onSubmit={cerrar} className="space-y-4">
            <p className="text-tenue">Cuenta el efectivo que hay en la caja y escríbelo.</p>
            <Campo etiqueta="Efectivo contado"><input className={`${campo} text-xl`} type="number" inputMode="decimal" min="0" step="any" value={contado} onChange={(e) => setContado(e.target.value)} required autoFocus /></Campo>
            <div className="rounded-xl bg-fondo p-4" aria-live="polite">
              <p className="text-sm text-tenue">Debía haber {dinero(caja.esperado)}</p>
              {dif === null ? <p className="text-tenue">Escribe lo que contaste para ver si cuadra.</p>
                : dif === 0 ? <p className="text-xl font-extrabold text-hoja-oscuro">¡Cuadra perfecto!</p>
                : <p className={`text-xl font-extrabold ${dif < 0 ? 'text-aji' : 'text-maiz'}`}>{dif < 0 ? 'Faltan' : 'Sobran'} {dinero(Math.abs(dif))}</p>}
            </div>
            <Campo etiqueta="Nota (opcional)"><input className={campo} maxLength={255} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Se dio un vuelto de más" /></Campo>
            <Aviso tipo="error">{errModal}</Aviso>
            <div className="flex gap-2 justify-end"><button type="button" className={btnSecundario} onClick={() => setModal(null)}>Cancelar</button><button className={btnPrimario} disabled={ocupado}>Cerrar caja</button></div>
          </form>
        </Modal>
      )}

      {reporte && <ReporteCaja caja={reporte} onClose={() => setReporte(null)} />}
    </div>
  );
}
