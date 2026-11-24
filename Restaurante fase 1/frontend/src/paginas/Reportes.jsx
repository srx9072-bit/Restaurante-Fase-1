import { useCallback, useEffect, useState } from 'react';
import { Receipt, ShoppingBag, TrendingUp, XCircle, Wheat, PiggyBank, Trash2, Scale } from 'lucide-react';
import { api } from '../api';
import { Aviso, METODOS_PAGO, campo, dinero, num } from '../ui.jsx';

const ZONA = 'America/Guatemala';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const TIPOS = { mesa: 'En mesa', llevar: 'Para llevar', domicilio: 'A domicilio' };

// Fechas como texto AAAA-MM-DD, siempre con la hora de Guatemala
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
const sumarDias = (f, n) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const diaCorto = (f) => { const d = new Date(`${f}T12:00:00Z`); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`; };
const fechaLarga = (f) => { const d = new Date(`${f}T12:00:00Z`); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const pct = (n) => `${Number(n).toLocaleString('es-GT', { maximumFractionDigits: 1 })}%`;
const horaTexto = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;

const PERIODOS = [
  { id: 'hoy', texto: 'Hoy', rango: () => [hoy(), hoy()] },
  { id: 'ayer', texto: 'Ayer', rango: () => [sumarDias(hoy(), -1), sumarDias(hoy(), -1)] },
  { id: '7', texto: 'Últimos 7 días', rango: () => [sumarDias(hoy(), -6), hoy()] },
  { id: 'mes', texto: 'Este mes', rango: () => [`${hoy().slice(0, 8)}01`, hoy()] },
  { id: '30', texto: 'Últimos 30 días', rango: () => [sumarDias(hoy(), -29), hoy()] },
];

function Dato({ icono: Icono, titulo, valor, detalle, fuerte }) {
  return (
    <div className={`rounded-2xl border p-4 ${fuerte ? 'bg-cafe text-white border-cafe' : 'bg-white border-borde shadow-suave'}`}>
      <p className={`flex items-center gap-2 text-sm font-bold ${fuerte ? 'text-[#F3E4D0]' : 'text-tenue'}`}><Icono size={18} aria-hidden="true" /> {titulo}</p>
      <p className="text-3xl font-bold mt-1">{valor}</p>
      {detalle && <p className={`text-sm ${fuerte ? 'text-[#F3E4D0]' : 'text-tenue'}`}>{detalle}</p>}
    </div>
  );
}

// Barra horizontal: nombre, barra proporcional y valor
function Barras({ filas, valor, texto, etiqueta, vacio }) {
  if (!filas.length) return <p className="text-tenue">{vacio}</p>;
  const max = Math.max(...filas.map(valor), 1);
  return (
    <ul className="space-y-3">
      {filas.map((f, i) => (
        <li key={i}>
          <div className="flex justify-between gap-3 text-sm"><span className="font-bold truncate">{etiqueta(f)}</span><span className="shrink-0 font-bold">{texto(f)}</span></div>
          <div className="mt-1 h-3 rounded-full bg-fondo overflow-hidden">
            <div className="h-full rounded-full bg-cafe" style={{ width: `${(valor(f) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Columnas por día. Con muchos días se muestra solo una parte de las etiquetas.
function VentasPorDia({ dias }) {
  const max = Math.max(...dias.map((d) => d.total), 1);
  const paso = Math.ceil(dias.length / 10);
  return (
    <div>
      <div className="flex items-end gap-1 h-48 border-b border-borde" role="img"
           aria-label={`Ventas por día: ${dias.map((d) => `${diaCorto(d.dia)} ${dinero(d.total)}`).join(', ')}`}>
        {dias.map((d) => (
          <div key={d.dia} className="flex-1 h-full flex items-end group relative" title={`${fechaLarga(d.dia)}: ${dinero(d.total)} (${d.pedidos} pedidos)`}>
            <div className={`w-full rounded-t-md ${d.total ? 'bg-cafe group-hover:bg-cafe-oscuro' : 'bg-borde'}`} style={{ height: d.total ? `${Math.max((d.total / max) * 100, 2)}%` : '2px' }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1 text-xs text-tenue">
        {dias.map((d, i) => <span key={d.dia} className="flex-1 text-center truncate">{i % paso === 0 ? diaCorto(d.dia) : ''}</span>)}
      </div>
    </div>
  );
}

function Tabla({ filas, nombre, vacio }) {
  if (!filas.length) return <p className="text-tenue">{vacio}</p>;
  return (
    <table className="w-full text-left">
      <thead className="text-sm text-tenue"><tr><th className="py-2">{nombre[0]}</th><th className="py-2 text-right">Pedidos</th><th className="py-2 text-right">Total</th></tr></thead>
      <tbody className="divide-y divide-borde">
        {filas.map((f, i) => (
          <tr key={i}><td className="py-2 font-bold">{nombre[1](f)}</td><td className="py-2 text-right">{f.pedidos}</td><td className="py-2 text-right font-bold">{dinero(f.total)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState('hoy');
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (d, h) => {
    setCargando(true);
    try { setDatos(await api(`/reportes?desde=${d}&hasta=${h}`)); setError(''); }
    catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(desde, hasta); }, [cargar, desde, hasta]);

  const elegir = (p) => { const [d, h] = p.rango(); setPeriodo(p.id); setDesde(d); setHasta(h); };
  const cambiarFecha = (cual, valor) => { if (!valor) return; setPeriodo('otro'); (cual === 'desde' ? setDesde : setHasta)(valor); };

  const r = datos?.resumen;
  const unDia = desde === hasta;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Reportes</h2>
        <p className="text-tenue text-lg">Cuánto se vendió, qué se vende más y quién atendió.</p>
      </div>

      <section className="tarjeta p-4 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.id} onClick={() => elegir(p)} aria-pressed={periodo === p.id}
                    className={`rounded-full px-4 h-10 font-bold border ${periodo === p.id ? 'bg-cafe text-white border-cafe' : 'bg-white border-borde hover:bg-cafe-suave'}`}>
              {p.texto}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="block text-sm font-bold mb-1">Desde</span>
            <input type="date" className={`${campo} w-44`} value={desde} max={hasta} onChange={(e) => cambiarFecha('desde', e.target.value)} /></label>
          <label className="block"><span className="block text-sm font-bold mb-1">Hasta</span>
            <input type="date" className={`${campo} w-44`} value={hasta} min={desde} max={hoy()} onChange={(e) => cambiarFecha('hasta', e.target.value)} /></label>
          {cargando && <span className="text-tenue pb-3">Cargando...</span>}
        </div>
      </section>

      <Aviso tipo="error">{error}</Aviso>

      {datos && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato fuerte icono={TrendingUp} titulo="Total vendido" valor={dinero(r.total)} detalle={unDia ? fechaLarga(datos.desde) : `${fechaLarga(datos.desde)} al ${fechaLarga(datos.hasta)}`} />
            <Dato icono={ShoppingBag} titulo="Pedidos cobrados" valor={num(r.pedidos)} />
            <Dato icono={Receipt} titulo="Ticket promedio" valor={dinero(r.ticket_promedio)} detalle="Por pedido" />
            <Dato icono={XCircle} titulo="Pedidos cancelados" valor={num(r.cancelados)} detalle={r.envios ? `Envíos cobrados: ${dinero(r.envios)}` : undefined} />
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-xl font-bold">Ganancias y pérdidas</h3>
              <p className="text-sm text-tenue">Sobre el costo de los ingredientes. No incluye sueldos, alquiler, luz ni gas.</p>
            </div>
            {r.platos_sin_costo > 0 && (
              <Aviso tipo="error">{r.platos_sin_costo === 1 ? '1 plato vendido tiene' : `${r.platos_sin_costo} platos vendidos tienen`} ingredientes sin costo. Agrega el costo de cada ingrediente en Inventario para que la ganancia sea real.</Aviso>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Dato icono={Receipt} titulo="Venta de platos" valor={dinero(r.ventas_platos)} detalle={r.envios ? 'Sin contar los envíos' : undefined} />
              <Dato icono={Wheat} titulo="Costo de ingredientes" valor={dinero(r.costo)} detalle={r.ventas_platos ? `${pct((r.costo / r.ventas_platos) * 100)} de lo vendido` : undefined} />
              <Dato icono={Trash2} titulo="Pérdidas por mermas" valor={dinero(r.perdidas)} detalle="Insumos botados, vencidos o dañados" />
              <Dato fuerte icono={PiggyBank} titulo="Ganancia" valor={dinero(r.ganancia_neta)} detalle={r.margen !== null ? `Venta − costo − pérdidas · ${pct((r.ganancia_neta / r.ventas_platos) * 100)}` : 'Venta − costo − pérdidas'} />
            </div>
          </section>

          {!unDia && (
            <section className="tarjeta p-4 space-y-3">
              <h3 className="text-xl font-bold">Ventas por día</h3>
              <VentasPorDia dias={datos.por_dia} />
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="tarjeta p-4 space-y-3">
              <h3 className="text-xl font-bold">Platos más vendidos</h3>
              <p className="text-sm text-tenue">Cantidad vendida · venta · ganancia sobre ingredientes.</p>
              <Barras filas={datos.platos} valor={(f) => f.cantidad} etiqueta={(f) => f.nombre}
                      texto={(f) => `${num(f.cantidad)} · ${dinero(f.total)} · gana ${dinero(f.ganancia)}`} vacio="No hay ventas en este período." />
            </section>
            <section className="tarjeta p-4 space-y-3">
              <h3 className="text-xl font-bold">Pedidos por hora</h3>
              <p className="text-sm text-tenue">Hora en que se tomó el pedido. Sirve para saber cuándo hace falta más personal.</p>
              <Barras filas={datos.por_hora} valor={(f) => f.pedidos} etiqueta={(f) => horaTexto(f.hora)}
                      texto={(f) => `${f.pedidos} · ${dinero(f.total)}`} vacio="No hay ventas en este período." />
            </section>
          </div>

          <section className="tarjeta p-4 space-y-2">
            <h3 className="text-xl font-bold flex items-center gap-2"><Scale size={20} aria-hidden="true" /> Mermas del período</h3>
            <p className="text-sm text-tenue">Lo que se sacó del inventario con "Salió o se botó", valorado al costo actual de cada ingrediente.</p>
            {datos.mermas.length === 0 ? <p className="text-tenue">No hubo mermas registradas.</p> : (
              <table className="w-full text-left">
                <thead className="text-sm text-tenue"><tr><th className="py-2">Ingrediente</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Pérdida</th></tr></thead>
                <tbody className="divide-y divide-borde">
                  {datos.mermas.map((m) => (
                    <tr key={m.nombre}><td className="py-2 font-bold">{m.nombre}</td><td className="py-2 text-right whitespace-nowrap">{num(m.cantidad)} {m.unidad}</td>
                      <td className="py-2 text-right font-bold text-aji">{m.costo > 0 ? dinero(m.costo) : 'Sin costo'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="tarjeta p-4 space-y-2">
              <h3 className="text-xl font-bold">Por empleado</h3>
              <Tabla filas={datos.empleados} nombre={['Atendió', (f) => f.nombre]} vacio="Sin ventas." />
            </section>
            <section className="tarjeta p-4 space-y-2">
              <h3 className="text-xl font-bold">Por forma de pago</h3>
              <Tabla filas={datos.metodos} nombre={['Pago', (f) => METODOS_PAGO[f.metodo] || f.metodo]} vacio="Sin ventas." />
            </section>
            <section className="tarjeta p-4 space-y-2">
              <h3 className="text-xl font-bold">Por tipo de pedido</h3>
              <Tabla filas={datos.tipos} nombre={['Tipo', (f) => TIPOS[f.tipo] || f.tipo]} vacio="Sin ventas." />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
