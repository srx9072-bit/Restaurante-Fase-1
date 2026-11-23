import { createContext, useContext, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  });

  async function entrar(email, password) {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('token', d.token);
    localStorage.setItem('usuario', JSON.stringify(d.usuario));
    setUsuario(d.usuario);
  }

  function salir() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  return <Ctx.Provider value={{ usuario, entrar, salir }}>{children}</Ctx.Provider>;
}
