import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import { Aviso, Etiqueta, btnSecundario, dinero } from '../ui.jsx';

const FILTROS = [['todos', 'Todos'], ['disponibles', 'Disponibles'], ['agotados', 'No disponibles']];

function Plato({ p }) {
  const agotado = !p.disponible;
  const pocas = !agotado && p.porciones !== null && p.porciones <= 5;
  return (
    <article className={`rounded-xl border p-4 flex flex-col gap-2 ${agotado ? 'bg-aji-suave/40 border-aji/30' : 'bg-white border-borde'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className={`text-lg font-extrabold ${agotado ? 'text-tenue' : ''}`}>{p.nombre}</h3>
        <span className="font-extrabold whitespace-nowrap">{dinero(p.precio)}</span>
      </div>
      {p.descripcion && <p className="text-tenue text-sm">{p.descripcion}</p>}
      <div className="mt-auto pt-2">
        {agotado ? (
          <>
            <Etiqueta tono="rojo">No disponible</Etiqueta>
            <p className="text-sm font-semibold text-aji mt-2">Falta: {p.faltantes.map((f) => f.nombre).join(', ')}</p>
          </>
        ) : pocas ? (
          <Etiqueta tono="ambar">Quedan pocas: alcanza para {p.porciones}</Etiqueta>
        ) : (
          <Etiqueta tono="verde">Disponible</Etiqueta>
        )}
      </div>
    </article>
  );
}

export default function Carta() {
  const [platos, setPlatos] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const cargar = useCallback(async () => {
    try { setPlatos(await api('/platos')); setError(''); } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000); // se actualiza sola cada 30 segundos
    return () => clearInterval(t);
  }, [cargar]);

  if (!platos) return <>{error ? <Aviso tipo="error">{error}</Aviso> : <p className="text-tenue">Cargando la carta...</p>}</>;

  const disponibles = platos.filter((p) => p.disponible).length;
  const agotados = platos.length - disponibles;
  const visibles = platos.filter((p) => filtro === 'todos' || (filtro === 'disponibles' ? p.disponible : !p.disponible));
  const categorias = [...new Set(visibles.map((p) => p.categoria))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Carta de hoy</h2>
          <p className="text-tenue text-lg">
            {platos.length === 0 ? 'Todavía no hay platos.'
              : agotados === 0 ? `Los ${platos.length} platos se pueden servir.`
              : `Se pueden servir ${disponibles} de ${platos.length} platos. ${agotados === 1 ? 'Hay 1 plato' : `Hay ${agotados} platos`} sin ingredientes.`}
          </p>
        </div>
        <button className={btnSecundario} onClick={cargar}><RefreshCw size={18} aria-hidden="true" /> Actualizar</button>
      </div>

      <Aviso tipo="error">{error}</Aviso>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar platos">
        {FILTROS.map(([valor, texto]) => (
          <button key={valor} onClick={() => setFiltro(valor)} aria-pressed={filtro === valor}
                  className={`h-11 rounded-full px-5 font-bold border ${filtro === valor ? 'bg-tinta text-white border-tinta' : 'bg-white border-borde hover:bg-fondo'}`}>
            {texto}
          </button>
        ))}
      </div>

      {platos.length === 0 && <p className="text-tenue">Un administrador puede agregar platos en la sección "Platos y recetas".</p>}
      {platos.length > 0 && visibles.length === 0 && <p className="text-tenue">No hay platos en este filtro.</p>}

      {categorias.map((cat) => (
        <section key={cat} className="space-y-3">
          <h3 className="text-xl font-extrabold">{cat}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.filter((p) => p.categoria === cat).map((p) => <Plato key={p.id} p={p} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
