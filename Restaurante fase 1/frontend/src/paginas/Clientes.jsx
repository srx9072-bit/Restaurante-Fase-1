import CrudPage from '../CrudPage.jsx';
import { useAuth } from '../auth.jsx';

export default function Clientes() {
  const { usuario } = useAuth();
  return (
    <CrudPage
      titulo="Clientes" singular="cliente" endpoint="/clientes"
      intro="Tus clientes frecuentes y lo que les gusta."
      puedeEscribir={['admin', 'cajero'].includes(usuario.rol)}
      vacio="Aún no hay clientes registrados."
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'telefono', label: 'Teléfono', type: 'tel' },
        { name: 'email', label: 'Correo', type: 'email' },
        { name: 'notas', label: 'Notas', type: 'textarea', ayuda: 'Por ejemplo: alergias o mesa preferida.' },
      ]}
      columnas={[
        { key: 'nombre', label: 'Cliente', render: (f) => <span className="font-bold">{f.nombre}</span> },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Correo' },
        { key: 'notas', label: 'Notas' },
      ]}
    />
  );
}
