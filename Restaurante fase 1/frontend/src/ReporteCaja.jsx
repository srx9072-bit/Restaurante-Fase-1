import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Modal, NOMBRE, btnPrimario, btnSecundario, dinero, fechaHora } from './ui.jsx';

function Contenido({ c }) {
  const linea = <div className="border-t border-dashed border-black my-2" />;
  const fila = (t, v, fuerte) => <div className={`flex justify-between gap-2 ${fuerte ? 'font-extrabold text-base' : ''}`}><span>{t}</span><span>{v}</span></div>;
  const cerrada = c.estado === 'cerrada';
  const dif = Number(c.diferencia) || 0;
  return (
    <div className="w-full text-sm text-black">
      <div className="text-center"><p className="text-xl font-extrabold">{NOMBRE}</p><p>Cuadre de caja #{c.id}</p><p className="text-xs">{cerrada ? 'Caja cerrada' : 'Caja abierta (parcial)'}</p></div>
      {linea}
      <p>Abierta: {fechaHora(c.abierta_en)}</p>
      <p>Por: {c.abierta_por_nombre || '-'}</p>
      {cerrada && <><p>Cerrada: {fechaHora(c.cerrada_en)}</p><p>Por: {c.cerrada_por_nombre || '-'}</p></>}
      {linea}
      {fila('Fondo inicial (caja chica)', dinero(c.monto_inicial))}
      {fila(`Efectivo (${c.ventas.efectivo.cantidad})`, dinero(c.ventas.efectivo.total))}
      {fila(`Tarjeta (${c.ventas.tarjeta.cantidad})`, dinero(c.ventas.tarjeta.total))}
      {fila(`Transferencia (${c.ventas.transferencia.cantidad})`, dinero(c.ventas.transferencia.total))}
      {fila('TOTAL VENTAS', dinero(c.total_ventas), true)}
      {linea}
      {c.movimientos.length > 0 && <>
        {c.movimientos.map((m) => fila(`${m.tipo === 'ingreso' ? '+' : '-'} ${m.concepto}`, dinero(m.monto)))}
        {linea}
      </>}
      {fila('Ingresos de efectivo', dinero(c.ingresos))}
      {fila('Egresos de efectivo', dinero(c.egresos))}
      {fila('Efectivo esperado', dinero(c.esperado), true)}
      {cerrada && <>
        {fila('Efectivo contado', dinero(c.contado), true)}
        {fila(dif === 0 ? 'Cuadra' : dif > 0 ? 'Sobrante' : 'Faltante', dinero(Math.abs(dif)), true)}
        {c.notas && <p className="mt-1 italic">Nota: {c.notas}</p>}
      </>}
      {linea}
      <p className="text-xs text-center">Pedidos cobrados: {c.pedidos_cobrados} · Cancelados: {c.pedidos_cancelados}</p>
    </div>
  );
}

export default function ReporteCaja({ caja, onClose }) {
  return (
    <>
      <Modal titulo={`Cuadre de caja #${caja.id}`} onClose={onClose} ancho="max-w-sm">
        <div className="rounded-xl border border-borde bg-white p-3 mb-4"><Contenido c={caja} /></div>
        <div className="flex gap-2 justify-end">
          <button className={btnSecundario} onClick={onClose}>Cerrar</button>
          <button className={btnPrimario} onClick={() => window.print()}><Printer size={18} aria-hidden="true" /> Imprimir</button>
        </div>
      </Modal>
      {createPortal(<div className="solo-impresion"><Contenido c={caja} /></div>, document.body)}
    </>
  );
}
