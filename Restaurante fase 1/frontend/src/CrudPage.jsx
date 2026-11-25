import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { api } from './api';
import { Aviso, Campo, Modal, btnPeligro, btnPrimario, btnSecundario, campo } from './ui.jsx';

/**
 * Pantalla genérica para listar, buscar, crear, editar y quitar registros.
 * campos: [{ name, label, type, required, ayuda, ayudaEditar, soloCrear, opciones }]
 * columnas: [{ key, label, render? }]
 */
// Para buscar sin importar mayúsculas ni tildes ("tes" encuentra "Tés")
const normal = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function CrudPage({ titulo, intro, singular, endpoint, campos, columnas, puedeEscribir, acciones, vacio, cabecera, buscarEn = ['nombre', 'telefono', 'email', 'contacto'] }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, fila = editar
  const [form, setForm] = useState({});
  const [errForm, setErrForm] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [quitando, setQuitando] = useState(null);

  const cargar = useCallback(async () => {
    try { setFilas(await api(endpoint)); setError(''); } catch (e) { setError(e.message); }
  }, [endpoint]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const esNuevo = editando && !editando.id;
  const visibles = campos.filter((c) => esNuevo || !c.soloCrear);

  function abrirNuevo() {
    setForm(Object.fromEntries(campos.map((c) => [c.name, c.defecto ?? ''])));
    setErrForm(''); setEditando({});
  }
  function abrirEditar(fila) {
    setForm(Object.fromEntries(campos.filter((c) => !c.soloCrear).map((c) => [c.name, c.type === 'password' ? '' : fila[c.name] ?? ''])));
    setErrForm(''); setEditando(fila);
  }

  async function guardar(e) {
    e.preventDefault();
    const falta = visibles.find((c) => c.required && String(form[c.name] ?? '').trim() === '' && !(c.type === 'password' && !esNuevo));
    if (falta) return setErrForm(`Completa: ${falta.label}.`);
    const body = {};
    for (const c of visibles) {
      if (c.type === 'password' && !esNuevo && !form[c.name]) continue;
      body[c.name] = form[c.name];
    }
    setGuardando(true);
    try {
      if (esNuevo) await api(endpoint, { method: 'POST', body });
      else await api(`${endpoint}/${editando.id}`, { method: 'PUT', body });
      setEditando(null);
      setAviso(`${singular[0].toUpperCase()}${singular.slice(1)} guardado.`);
      cargar();
    } catch (err) { setErrForm(err.message); } finally { setGuardando(false); }
  }

  async function quitar() {
    try {
      await api(`${endpoint}/${quitando.id}`, { method: 'DELETE' });
      setAviso(`Se quitó a ${quitando.nombre}.`);
      setQuitando(null);
      cargar();
    } catch (err) { setError(err.message); setQuitando(null); }
  }

  // Busca solo en el nombre (y teléfono/correo/contacto si existen). Primero los que empiezan con lo escrito.
  const q = normal(busca);
  const lista = !q ? (filas || []) : (filas || [])
    .map((f) => {
      const nombre = normal(f.nombre);
      const palabraInicia = nombre.split(/\s+/).some((w) => w.startsWith(q));
      const rango = nombre.startsWith(q) ? 0 : palabraInicia ? 1 : nombre.includes(q) ? 2
        : buscarEn.some((k) => k !== 'nombre' && normal(f[k]).includes(q)) ? 3 : -1;
      return { f, rango };
    })
    .filter((x) => x.rango >= 0)
    .sort((a, b) => a.rango - b.rango)
    .map((x) => x.f);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{titulo}</h2>
          {intro && <p className="text-tenue text-lg">{intro}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {cabecera && filas && cabecera({ filas, recargar: cargar, avisar: setAviso })}
          {puedeEscribir && <button className={btnPrimario} onClick={abrirNuevo}><Plus size={20} aria-hidden="true" /> Nuevo {singular}</button>}
        </div>
      </div>

      <Aviso>{aviso}</Aviso>
      <Aviso tipo="error">{error}</Aviso>

      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-tenue" aria-hidden="true" />
        <input className={`${campo} pl-10 pr-12`} placeholder={`Buscar ${singular} por nombre`} aria-label={`Buscar ${singular}`} value={busca}
               onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setBusca('')} />
        {busca && (
          <button type="button" onClick={() => setBusca('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-tenue hover:bg-fondo"><X size={20} /></button>
        )}
      </div>
      {busca && filas && (
        <p className="text-tenue -mt-2" aria-live="polite">{lista.length === 1 ? '1 resultado' : `${lista.length} resultados`} para "{busca.trim()}"</p>
      )}

      {!filas ? <p className="text-tenue">Cargando...</p> : lista.length === 0 ? (
        <div className="bg-white border border-borde rounded-xl p-8 text-center text-tenue">
          {busca ? 'No encontramos nada con esa búsqueda.' : vacio}
        </div>
      ) : (
        <div className="bg-white border border-borde rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-fondo text-tenue">
              <tr>
                {columnas.map((c) => <th key={c.key} className="px-4 py-3 font-bold">{c.label}</th>)}
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id} className="border-t border-borde">
                  {columnas.map((c) => <td key={c.key} className="px-4 py-3 align-middle">{c.render ? c.render(f) : f[c.key] ?? '-'}</td>)}
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {acciones?.(f, { avisar: setAviso, recargar: cargar })}
                      {puedeEscribir && (
                        <>
                          <button className={btnSecundario} onClick={() => abrirEditar(f)} aria-label={`Editar ${f.nombre}`}><Pencil size={18} aria-hidden="true" /> Editar</button>
                          <button className={btnSecundario} onClick={() => setQuitando(f)} aria-label={`Quitar ${f.nombre}`}><Trash2 size={18} aria-hidden="true" /> Quitar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <Modal titulo={esNuevo ? `Nuevo ${singular}` : `Editar ${singular}`} onClose={() => setEditando(null)}>
          <form onSubmit={guardar} className="space-y-4">
            {visibles.map((c) => (
              <Campo key={c.name} etiqueta={c.label + (c.required && !(c.type === 'password' && !esNuevo) ? '' : ' (opcional)')}
                     ayuda={!esNuevo && c.ayudaEditar ? c.ayudaEditar : c.ayuda}>
                {c.type === 'select' ? (
                  <select className={campo} value={form[c.name]} onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}>
                    {!c.required && <option value="">Ninguno</option>}
                    {c.required && form[c.name] === '' && <option value="">Elige una opción</option>}
                    {c.opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                  </select>
                ) : c.type === 'textarea' ? (
                  <textarea className={`${campo} h-24 py-2`} value={form[c.name]} onChange={(e) => setForm({ ...form, [c.name]: e.target.value })} />
                ) : (
                  <input className={campo} type={c.type || 'text'} step={c.type === 'number' ? 'any' : undefined} min={c.type === 'number' ? 0 : undefined}
                         autoComplete={c.type === 'password' ? 'new-password' : 'off'}
                         inputMode={c.inputMode} maxLength={c.maxLength} pattern={c.pattern} title={c.title}
                         value={form[c.name]} onChange={(e) => setForm({ ...form, [c.name]: e.target.value })} />
                )}
              </Campo>
            ))}
            <Aviso tipo="error">{errForm}</Aviso>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" className={btnSecundario} onClick={() => setEditando(null)}>Cancelar</button>
              <button className={btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {quitando && (
        <Modal titulo={`¿Quitar ${quitando.nombre}?`} onClose={() => setQuitando(null)}>
          <p className="text-tenue mb-5">Ya no aparecerá en las listas. Tus otros datos no se pierden.</p>
          <div className="flex gap-2 justify-end">
            <button className={btnSecundario} onClick={() => setQuitando(null)}>Cancelar</button>
            <button className={btnPeligro} onClick={quitar}>Sí, quitar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
