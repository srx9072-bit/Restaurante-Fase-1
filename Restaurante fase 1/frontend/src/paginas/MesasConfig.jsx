import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '../api';
import CrudPage from '../CrudPage.jsx';
import { Aviso, Campo, btnPrimario, campo } from '../ui.jsx';

export default function MesasConfig() {
  const [cantidad, setCantidad] = useState('');
  const [capacidad, setCapacidad] = useState('4');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  async function agregar(e) {
    e.preventDefault();
    setError(''); setAviso('');
    try {
      const r = await api('/mesas/lote', { method: 'POST', body: { cantidad, capacidad } });
      setAviso(`Se agregaron ${r.creadas} mesas.`);
      setCantidad('');
      setVersion((v) => v + 1);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-5">
      <Link to="/mesas" className="inline-flex items-center gap-1 font-bold text-tenue hover:text-tinta"><ArrowLeft size={18} aria-hidden="true" /> Volver a mesas</Link>

      <form onSubmit={agregar} className="tarjeta p-4 flex flex-wrap items-end gap-3">
        <div className="w-full"><h3 className="text-lg font-bold">Agregar varias mesas de una vez</h3>
          <p className="text-sm text-tenue">Se numeran solas: Mesa 1, Mesa 2, Mesa 3...</p></div>
        <Campo etiqueta="¿Cuántas mesas?"><input className={`${campo} w-36`} type="number" min="1" max="50" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required /></Campo>
        <Campo etiqueta="Personas por mesa"><input className={`${campo} w-36`} type="number" min="1" max="50" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} /></Campo>
        <button className={btnPrimario}><Plus size={18} aria-hidden="true" /> Agregar mesas</button>
        <div className="w-full space-y-2"><Aviso>{aviso}</Aviso><Aviso tipo="error">{error}</Aviso></div>
      </form>

      <CrudPage
        key={version}
        titulo="Mesas del restaurante" singular="mesa" endpoint="/mesas"
        intro="Cambia el nombre (por ejemplo Terraza) o quita las mesas que ya no uses."
        puedeEscribir
        vacio="Aún no hay mesas."
        campos={[
          { name: 'nombre', label: 'Nombre', required: true },
          { name: 'capacidad', label: 'Personas', type: 'number', required: true },
        ]}
        columnas={[
          { key: 'nombre', label: 'Mesa', render: (f) => <span className="font-bold">{f.nombre}</span> },
          { key: 'capacidad', label: 'Personas' },
        ]}
      />
    </div>
  );
}
