import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, UtensilsCrossed, Package, BookOpen, Truck, Users, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { NOMBRE } from './ui.jsx';

const ENLACES = [
  { a: '/', texto: 'Carta', icono: UtensilsCrossed },
  { a: '/pedidos', texto: 'Pedidos', icono: ClipboardList },
  { a: '/inventario', texto: 'Inventario', icono: Package },
  { a: '/platos', texto: 'Platos y recetas', corto: 'Platos', icono: BookOpen, admin: true },
  { a: '/proveedores', texto: 'Proveedores', corto: 'Proveedores', icono: Truck },
  { a: '/clientes', texto: 'Clientes', icono: Users },
  { a: '/usuarios', texto: 'Usuarios', icono: ShieldCheck, admin: true },
];

const ROL = { admin: 'Administrador', cajero: 'Caja', cocina: 'Cocina' };

export default function Layout() {
  const { usuario, salir } = useAuth();
  const enlaces = ENLACES.filter((e) => !e.admin || usuario.rol === 'admin');
  const clase = ({ isActive }) => isActive ? 'bg-hoja text-white' : 'text-tinta hover:bg-hoja-suave';

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-white border-r border-borde p-4 sticky top-0 h-screen">
        <h1 className="text-xl font-extrabold px-3 py-4">{NOMBRE}</h1>
        <nav className="flex flex-col gap-1" aria-label="Secciones">
          {enlaces.map(({ a, texto, icono: Icono }) => (
            <NavLink key={a} to={a} end={a === '/'} className={(s) => `flex items-center gap-3 rounded-lg px-3 h-12 font-bold ${clase(s)}`}>
              <Icono size={22} aria-hidden="true" /> {texto}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-borde pt-4 px-3">
          <p className="font-bold">{usuario.nombre}</p>
          <p className="text-sm text-tenue mb-3">{ROL[usuario.rol]}</p>
          <button onClick={salir} className="flex items-center gap-2 font-bold text-tenue hover:text-tinta">
            <LogOut size={18} aria-hidden="true" /> Salir
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 pb-24 md:pb-0">
        <header className="md:hidden flex items-center justify-between bg-white border-b border-borde px-4 h-14">
          <h1 className="font-extrabold">{NOMBRE}</h1>
          <button onClick={salir} className="flex items-center gap-1 font-bold text-tenue"><LogOut size={18} aria-hidden="true" /> Salir</button>
        </header>
        <main className="max-w-5xl mx-auto p-4 sm:p-6"><Outlet /></main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-borde flex overflow-x-auto" aria-label="Secciones">
        {enlaces.map(({ a, texto, corto, icono: Icono }) => (
          <NavLink key={a} to={a} end={a === '/'}
                   className={(s) => `flex-1 min-w-[76px] flex flex-col items-center gap-1 py-2 text-xs font-bold ${clase(s)}`}>
            <Icono size={22} aria-hidden="true" /> {corto || texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
