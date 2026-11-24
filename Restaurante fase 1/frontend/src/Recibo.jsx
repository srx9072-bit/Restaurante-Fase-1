import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { METODOS_PAGO, Modal, NOMBRE, ZONAS, btnPrimario, btnSecundario, dinero, fechaHora, imprimirTicket } from './ui.jsx';

function Contenido({ p }) {
  const envio = Number(p.costo_envio) || 0;
  const subtotal = Number(p.total) - envio;
  const lugar = p.tipo === 'domicilio' ? 'A domicilio' : p.tipo === 'llevar' ? 'Para llevar' : (p.mesa || 'Mesa');
  const linea = <div className="border-t border-dashed border-black my-2" />;
  const fila = (texto, valor, fuerte) => (
    <div className={`flex justify-between gap-2 ${fuerte ? 'text-base font-extrabold' : ''}`}><span>{texto}</span><span className="shrink-0">{valor}</span></div>
  );

  return (
    <div className="w-full text-sm text-black">
      <div className="text-center">
        <p className="text-xl font-extrabold">{NOMBRE}</p>
        <p>Comprobante de consumo</p>
        <p className="text-xs">(no es factura)</p>
      </div>
      {linea}
      <p className="font-bold">Pedido #{p.id}</p>
      <p>{fechaHora(p.creado_en)}</p>
      <p>{lugar}{p.referencia ? `: ${p.referencia}` : ''}</p>
      {p.cliente && <p>Cliente: {p.cliente}</p>}
      {p.tipo === 'domicilio' && (
        <>
          <p>{ZONAS[p.zona_envio]}</p>
          <p>Dirección: {p.direccion}</p>
          {p.telefono && <p>Teléfono: {p.telefono}</p>}
        </>
      )}
      {p.atendio && <p>Atendió: {p.atendio}</p>}
      {linea}
      <div className="space-y-1">
        {p.items.map((i) => (
          <div key={i.id}>
            {fila(`${i.cantidad} × ${i.nombre}`, dinero(Number(i.precio) * i.cantidad))}
            {i.nota && <p className="text-xs italic pl-3">{i.nota}</p>}
          </div>
        ))}
      </div>
      {linea}
      {envio > 0 && <>{fila('Subtotal', dinero(subtotal))}{fila(`Envío (${ZONAS[p.zona_envio]?.toLowerCase()})`, dinero(envio))}</>}
      {fila('TOTAL', dinero(p.total), true)}
      {linea}
      {p.pagado ? (
        <>
          {fila('Pagado con', METODOS_PAGO[p.metodo_pago])}
          {p.metodo_pago === 'efectivo' && p.recibido != null && <>{fila('Recibido', dinero(p.recibido))}{fila('Cambio', dinero(p.cambio))}</>}
        </>
      ) : <p className="text-center font-bold">PENDIENTE DE PAGO</p>}
      {linea}
      <p className="text-center">¡Gracias por su visita!</p>
    </div>
  );
}

// Vista previa en pantalla + una copia oculta que es la que se imprime
export default function Recibo({ pedido, onClose }) {
  return (
    <>
      <Modal titulo={`Recibo del pedido #${pedido.id}`} onClose={onClose} ancho="max-w-sm">
        <div className="rounded-lg border border-borde bg-white p-3 mb-4"><Contenido p={pedido} /></div>
        <div className="flex gap-2 justify-end">
          <button className={btnSecundario} onClick={onClose}>Cerrar</button>
          <button className={btnPrimario} onClick={imprimirTicket}><Printer size={18} aria-hidden="true" /> Imprimir</button>
        </div>
        <p className="text-sm text-tenue mt-3">Para guardarlo como PDF, elige "Guardar como PDF" en la ventana de impresión.</p>
      </Modal>
      {createPortal(<div className="solo-impresion"><Contenido p={pedido} /></div>, document.body)}
    </>
  );
}
