import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './Layout.jsx';
import Login from './paginas/Login.jsx';
import Carta from './paginas/Carta.jsx';
import Inventario from './paginas/Inventario.jsx';
import Platos from './paginas/Platos.jsx';
import Proveedores from './paginas/Proveedores.jsx';
import Clientes from './paginas/Clientes.jsx';
import Usuarios from './paginas/Usuarios.jsx';
import Pedidos from './paginas/Pedidos.jsx';
import NuevoPedido from './paginas/NuevoPedido.jsx';

const Solo = ({ roles, children }) => {
  const { usuario } = useAuth();
  return roles.includes(usuario.rol) ? children : <Navigate to="/" replace />;
};

export default function App() {
  const { usuario } = useAuth();
  if (!usuario) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Carta />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="pedidos/nuevo" element={<Solo roles={['admin', 'cajero']}><NuevoPedido /></Solo>} />
        <Route path="platos" element={<Solo roles={['admin']}><Platos /></Solo>} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="usuarios" element={<Solo roles={['admin']}><Usuarios /></Solo>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
