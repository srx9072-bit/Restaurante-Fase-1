import { useEffect, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { api } from '../api';
import CrudPage from '../CrudPage.jsx';
import ConteoRapido from '../ConteoRapido.jsx';
import { useAuth } from '../auth.jsx';
import { Aviso, Campo, Etiqueta, Modal, btnPrimario, btnSecundario, campo, dinero, num } from '../ui.jsx';

const UNIDADES = ['unidad', 'lb', 'kg', 'litro', 'galón'].map((u) => ({ valor: u, texto: u }));

const CAMBIOS = [
  ['entrada', 'Llegó mercadería', 'Suma a lo que hay'],
  ['salida', 'Salió o se botó', 'Resta de lo que hay'],
  ['ajuste', 'Corregir conteo', 'Dejar la cantidad real'],
];

function Estado({ f }) {
  if (Number(f.stock) <= 0) return <Etiqueta tono="rojo">Agotado</Etiqueta>;
  if (Number(f.stock) <= Number(f.stock_minimo)) return <Etiqueta tono="ambar">Queda poco</Etiqueta>;
  return <Etiqueta tono="verde">Bien</Etiqueta>;
}

function AjusteStock({ insumo, onHecho }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (cantidad === '') return setError('Escribe la cantidad.');
    setGuardando(true);
    try {
      await api(`/insumos/${insumo.id}/movimiento`, { method: 'POST', body: { tipo, cantidad, nota } });
      setAbierto(false); setCantidad(''); setNota(''); setError('');
      onHecho(`Stock de ${insumo.nombre} actualizado.`);
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }

  return (
    <>
      <button className={btnSecundario} onClick={() => setAbierto(true)} aria-label={`Ajustar stock de ${insumo.nombre}`}>
        <PackagePlus size={18} aria-hidden="true" /> Ajustar stock
      </button>
      {abierto && (
        <Modal titulo={`Stock de ${insumo.nombre}`} onClose={() => setAbierto(false)}>
          <form onSubmit={guardar} className="space-y-4">
            <p className="text-tenue">Ahora hay <b className="text-tinta">{num(insumo.stock)} {insumo.unidad}</b>. ¿Qué pasó?</p>
            <div className="grid gap-2" role="radiogroup" aria-label="Qué pasó con el stock">
              {CAMBIOS.map(([valor, texto, ayuda]) => (
                <button type="button" key={valor} role="radio" aria-checked={tipo === valor} onClick={() => setTipo(valor)}
                        className={`text-left rounded-lg border px-4 py-3 ${tipo === valor ? 'border-hoja bg-hoja-suave' : 'border-borde bg-white hover:bg-fondo'}`}>
                  <span className="block font-bold">{texto}</span>
                  <span className="block text-sm text-tenue">{ayuda}</span>
                </button>
              ))}
            </div>
            <Campo etiqueta={tipo === 'ajuste' ? `Cantidad real (${insumo.unidad})` : `Cantidad (${insumo.unidad})`}>
              <input className={campo} type="number" step="any" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
            </Campo>
            <Campo etiqueta="Nota (opcional)">
              <input className={campo} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: pedido del lunes" />
            </Campo>
            <Aviso tipo="error">{error}</Aviso>
            <div className="flex gap-2 justify-end">
              <button type="button" className={btnSecundario} onClick={() => setAbierto(false)}>Cancelar</button>
              <button className={btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Inventario() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === 'admin';
  const [proveedores, setProveedores] = useState(null);
  useEffect(() => { api('/proveedores').then(setProveedores).catch(() => setProveedores([])); }, []);
  if (!proveedores) return <p className="text-tenue">Cargando...</p>;

  return (
    <CrudPage
      titulo="Inventario" singular="insumo" endpoint="/insumos"
      intro="Los ingredientes que tienes. Cuando uno se acaba, los platos que lo usan se marcan como no disponibles."
      puedeEscribir={usuario.rol === 'admin'}
      vacio="Aún no hay insumos. Agrega tus ingredientes y cuánto tienes de cada uno."
      cabecera={({ filas, avisar, recargar }) => ['admin', 'cocina'].includes(usuario.rol) &&
        <ConteoRapido insumos={filas} esAdmin={esAdmin} onHecho={(m) => { avisar(m); recargar(); }} />}
      acciones={(f, { avisar, recargar }) =>
        ['admin', 'cocina'].includes(usuario.rol) && <AjusteStock insumo={f} onHecho={(m) => { avisar(m); recargar(); }} />}
      campos={[
        { name: 'nombre', label: 'Nombre del ingrediente', required: true },
        { name: 'unidad', label: 'Se mide en', type: 'select', required: true, opciones: UNIDADES, defecto: 'unidad' },
        { name: 'stock', label: 'Cantidad que hay ahora', type: 'number', soloCrear: true, defecto: 0,
          ayuda: 'Después la cambias con "Ajustar stock".' },
        { name: 'stock_minimo', label: 'Avisar cuando quede menos de', type: 'number', defecto: 0 },
        { name: 'costo', label: 'Costo por unidad de medida (Q)', type: 'number', defecto: 0,
          ayuda: 'Lo que pagas por 1 unidad, 1 lb, 1 litro... Ej: si la libra de carne cuesta Q32, escribe 32. Sirve para saber cuánto cuesta hacer cada plato.' },
        { name: 'proveedor_id', label: 'Proveedor', type: 'select',
          opciones: proveedores.map((p) => ({ valor: p.id, texto: p.nombre })) },
      ]}
      columnas={[
        { key: 'nombre', label: 'Ingrediente', render: (f) => <span className="font-bold">{f.nombre}</span> },
        { key: 'stock', label: 'Hay', render: (f) => <span className="font-bold whitespace-nowrap">{num(f.stock)} {f.unidad}</span> },
        { key: 'estado', label: 'Estado', render: (f) => <Estado f={f} /> },
        { key: 'stock_minimo', label: 'Mínimo', render: (f) => `${num(f.stock_minimo)} ${f.unidad}` },
        ...(esAdmin ? [{ key: 'costo', label: 'Costo', render: (f) => (Number(f.costo) > 0
          ? <span className="whitespace-nowrap">{dinero(f.costo)} / {f.unidad}</span>
          : <span className="text-aji font-semibold whitespace-nowrap">Sin costo</span>) }] : []),
        { key: 'proveedor', label: 'Proveedor' },
      ]}
    />
  );
}
