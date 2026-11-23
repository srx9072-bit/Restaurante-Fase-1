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

const SoloAdmin = ({ children }) => {
  const { usuario } = useAuth();
  return usuario.rol === 'admin' ? children : <Navigate to="/" replace />;
};

export default function App() {
  const { usuario } = useAuth();
  if (!usuario) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Carta />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="platos" element={<SoloAdmin><Platos /></SoloAdmin>} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
