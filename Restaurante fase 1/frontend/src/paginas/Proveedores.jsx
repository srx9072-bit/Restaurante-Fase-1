import CrudPage from '../CrudPage.jsx';
import { useAuth } from '../auth.jsx';

export default function Proveedores() {
  const { usuario } = useAuth();
  return (
    <CrudPage
      titulo="Proveedores" singular="proveedor" endpoint="/proveedores"
      intro="A quién le compras tus ingredientes."
      puedeEscribir={usuario.rol === 'admin'}
      vacio="Aún no hay proveedores. Agrega el primero para saber a quién pedirle cuando algo se acabe."
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'contacto', label: 'Persona de contacto' },
        { name: 'telefono', label: 'Teléfono', type: 'tel' },
        { name: 'email', label: 'Correo', type: 'email' },
        { name: 'direccion', label: 'Dirección' },
      ]}
      columnas={[
        { key: 'nombre', label: 'Proveedor', render: (f) => <span className="font-bold">{f.nombre}</span> },
        { key: 'contacto', label: 'Contacto' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Correo' },
      ]}
    />
  );
}
