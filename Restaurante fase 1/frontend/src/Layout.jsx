import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, UtensilsCrossed, Package, BookOpen, Truck, Users, ShieldCheck, LogOut, Coffee, Armchair, Wallet, TrendingUp } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { NOMBRE } from './ui.jsx';

const ENLACES = [
  { a: '/', texto: 'Carta', icono: UtensilsCrossed },
  { a: '/mesas', texto: 'Mesas', icono: Armchair },
  { a: '/pedidos', texto: 'Pedidos', icono: ClipboardList },
  { a: '/caja', texto: 'Caja', icono: Wallet, roles: ['admin', 'cajero'] },
  { a: '/reportes', texto: 'Reportes', icono: TrendingUp, roles: ['admin'] },
  { a: '/inventario', texto: 'Inventario', icono: Package },
  { a: '/platos', texto: 'Platos y recetas', corto: 'Platos', icono: BookOpen, roles: ['admin'] },
  { a: '/proveedores', texto: 'Proveedores', icono: Truck },
  { a: '/clientes', texto: 'Clientes', icono: Users },
  { a: '/usuarios', texto: 'Usuarios', icono: ShieldCheck, roles: ['admin'] },
];

const ROL = { admin: 'Administrador', cajero: 'Caja', cocina: 'Cocina' };

export default function Layout() {
  const { usuario, salir } = useAuth();
  const enlaces = ENLACES.filter((e) => !e.roles || e.roles.includes(usuario.rol));

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-cafe-espresso text-[#F3E4D0] p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-3 py-4">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#F3E4D0] text-cafe"><Coffee size={22} aria-hidden="true" /></span>
          <h1 className="text-xl font-bold leading-tight">{NOMBRE}</h1>
        </div>
        <nav className="flex flex-col gap-1 mt-2" aria-label="Secciones">
          {enlaces.map(({ a, texto, icono: Icono }) => (
            <NavLink key={a} to={a} end={a === '/'}
                     className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 h-12 font-bold ${isActive ? 'bg-[#F3E4D0] text-cafe-oscuro' : 'hover:bg-white/10'}`}>
              <Icono size={22} aria-hidden="true" /> {texto}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/15 pt-4 px-3">
          <p className="font-bold">{usuario.nombre}</p>
          <p className="text-sm text-[#D9C3A8] mb-3">{ROL[usuario.rol]}</p>
          <button onClick={salir} className="flex items-center gap-2 font-bold text-[#D9C3A8] hover:text-white">
            <LogOut size={18} aria-hidden="true" /> Salir
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 pb-24 md:pb-0">
        <header className="md:hidden flex items-center justify-between bg-cafe-espresso text-[#F3E4D0] px-4 h-14">
          <h1 className="font-bold flex items-center gap-2"><Coffee size={20} aria-hidden="true" /> {NOMBRE}</h1>
          <button onClick={salir} className="flex items-center gap-1 font-bold text-[#D9C3A8]"><LogOut size={18} aria-hidden="true" /> Salir</button>
        </header>
        <main className="max-w-6xl mx-auto p-4 sm:p-6"><Outlet /></main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-borde flex overflow-x-auto" aria-label="Secciones">
        {enlaces.map(({ a, texto, corto, icono: Icono }) => (
          <NavLink key={a} to={a} end={a === '/'}
                   className={({ isActive }) => `flex-1 min-w-[76px] flex flex-col items-center gap-1 py-2 text-xs font-bold ${isActive ? 'bg-cafe text-white' : 'text-tinta hover:bg-cafe-suave'}`}>
            <Icono size={22} aria-hidden="true" /> {corto || texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
