import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Armchair, CheckCircle2, Clock, Plus, RefreshCw, Settings, Users } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { Aviso, Etiqueta, btnPrimario, btnSecundario, dinero, hora } from '../ui.jsx';

const minutosDesde = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const duracion = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

function MesaCard({ m, puedeCaja }) {
  const nombres = [...new Set(m.pedidos.map((p) => p.atendio).filter(Boolean))];
  return (
    <article className={`rounded-2xl border-2 p-4 flex flex-col gap-3 shadow-suave ${m.ocupada ? 'border-maiz/50 bg-maiz-suave/60' : 'border-hoja/30 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold font-titulo">{m.nombre}</h3>
          <p className="flex items-center gap-1.5 text-sm text-tenue whitespace-nowrap"><Users size={16} aria-hidden="true" /> {m.capacidad} personas</p>
        </div>
        {m.ocupada
          ? <Etiqueta tono="ambar" icono={Clock}>Ocupada</Etiqueta>
          : <Etiqueta tono="verde" icono={CheckCircle2}>Libre</Etiqueta>}
      </div>

      {m.ocupada ? (
        <div className="text-sm space-y-0.5">
          <p className="font-bold">Desde las {hora(m.desde)} · {duracion(minutosDesde(m.desde))}</p>
          <p>{m.pedidos.length} {m.pedidos.length === 1 ? 'pedido' : 'pedidos'}{m.por_cobrar > 0 ? ` · por cobrar ${dinero(m.por_cobrar)}` : ' · todo cobrado'}</p>
          {nombres.length > 0 && <p className="text-tenue">Atiende: {nombres.join(', ')}</p>}
        </div>
      ) : <p className="text-sm text-tenue">Lista para recibir clientes.</p>}

      <div className="mt-auto flex flex-wrap gap-2">
        {puedeCaja && (
          <Link to={`/pedidos/nuevo?mesa=${m.id}`} className={m.ocupada ? btnSecundario : btnPrimario}>
            <Plus size={18} aria-hidden="true" /> {m.ocupada ? 'Agregar pedido' : 'Tomar pedido'}
          </Link>
        )}
        {m.ocupada && <Link to="/pedidos" className={btnSecundario}>Ver pedidos</Link>}
      </div>
    </article>
  );
}

export default function Mesas() {
  const { usuario } = useAuth();
  const puedeCaja = ['admin', 'cajero'].includes(usuario.rol);
  const [mesas, setMesas] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try { setMesas(await api('/mesas/estado')); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  const ocupadas = (mesas || []).filter((m) => m.ocupada).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Mesas</h2>
          <p className="text-tenue text-lg">Mira de un vistazo qué mesas están ocupadas y cuáles libres.</p>
        </div>
        <div className="flex gap-2">
          <button className={btnSecundario} onClick={cargar}><RefreshCw size={18} aria-hidden="true" /> Actualizar</button>
          {usuario.rol === 'admin' && <Link to="/mesas/configurar" className={btnSecundario}><Settings size={18} aria-hidden="true" /> Configurar mesas</Link>}
        </div>
      </div>

      <Aviso tipo="error">{error}</Aviso>

      {!mesas ? <p className="text-tenue">Cargando...</p> : mesas.length === 0 ? (
        <div className="tarjeta p-8 text-center text-tenue">
          <Armchair className="mx-auto mb-2" size={32} aria-hidden="true" />
          Todavía no hay mesas registradas.
          {usuario.rol === 'admin' && <> <Link to="/mesas/configurar" className="font-bold underline text-cafe">Agrégalas aquí</Link>.</>}
        </div>
      ) : (
        <>
          <p className="flex flex-wrap gap-2" aria-live="polite">
            <Etiqueta tono="verde" icono={CheckCircle2}>{mesas.length - ocupadas} libres</Etiqueta>
            <Etiqueta tono="ambar" icono={Clock}>{ocupadas} ocupadas</Etiqueta>
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mesas.map((m) => <MesaCard key={m.id} m={m} puedeCaja={puedeCaja} />)}
          </div>
        </>
      )}
    </div>
  );
}
