import { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';

export const NOMBRE = import.meta.env.VITE_NOMBRE_RESTAURANTE || 'Mi restaurante';

const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 h-11 font-bold transition-colors disabled:opacity-50';
export const btnPrimario = `${base} bg-hoja text-white hover:bg-hoja-oscuro`;
export const btnSecundario = `${base} bg-white text-tinta border border-borde hover:bg-fondo`;
export const btnPeligro = `${base} bg-aji text-white hover:opacity-90`;
export const campo = 'w-full h-12 rounded-lg border border-borde bg-white px-3 text-base text-tinta';

const tonos = {
  verde: ['bg-hoja-suave text-hoja-oscuro', CheckCircle2],
  ambar: ['bg-maiz-suave text-maiz', AlertTriangle],
  rojo: ['bg-aji-suave text-aji', XCircle],
  gris: ['bg-fondo text-tenue border border-borde', Circle],
};

// Etiqueta con icono y texto: el estado nunca depende solo del color
export function Etiqueta({ tono, icono, children }) {
  const [clase, IconoBase] = tonos[tono];
  const Icono = icono || IconoBase;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${clase}`}>
      <Icono size={16} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Aviso({ tipo = 'ok', children }) {
  if (!children) return null;
  const clase = tipo === 'error' ? 'bg-aji-suave text-aji' : 'bg-hoja-suave text-hoja-oscuro';
  return <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 font-semibold ${clase}`}>{children}</div>;
}

export function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-tinta/50 sm:p-4"
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
           className={`w-full ${ancho} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-fondo"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="block">
      <span className="block font-bold mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-sm text-tenue mt-1">{ayuda}</span>}
    </label>
  );
}

export const dinero = (n) => `Q${Number(n).toFixed(2)}`;
export const num = (n) => Number(n).toLocaleString('es-GT', { maximumFractionDigits: 2 });
