import CrudPage from '../CrudPage.jsx';

const ROLES = [
  { valor: 'admin', texto: 'Administrador (todo)' },
  { valor: 'cajero', texto: 'Caja (clientes y consulta)' },
  { valor: 'cocina', texto: 'Cocina (ajusta el inventario)' },
];

export default function Usuarios() {
  return (
    <CrudPage
      titulo="Usuarios" singular="usuario" endpoint="/usuarios" puedeEscribir
      intro="Quién puede entrar al sistema y qué puede hacer."
      vacio="No hay usuarios."
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'email', label: 'Correo', type: 'email', required: true },
        { name: 'rol', label: 'Rol', type: 'select', required: true, opciones: ROLES },
        { name: 'password', label: 'Contraseña', type: 'password', required: true,
          ayuda: 'Mínimo 6 caracteres.', ayudaEditar: 'Déjala vacía si no quieres cambiarla.' },
      ]}
      columnas={[
        { key: 'nombre', label: 'Nombre', render: (f) => <span className="font-bold">{f.nombre}</span> },
        { key: 'email', label: 'Correo' },
        { key: 'rol', label: 'Rol', render: (f) => ROLES.find((r) => r.valor === f.rol)?.texto },
      ]}
    />
  );
}
