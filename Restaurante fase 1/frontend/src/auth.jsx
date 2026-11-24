import { createContext, useContext, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// "dispositivo" = permiso que deja el administrador al entrar con contraseña en la computadora de caja.
// Con él, cada empleado entra solo con su PIN. Salir del usuario no borra ese permiso.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  });
  const [conPin, setConPin] = useState(() => Boolean(localStorage.getItem('dispositivo')));

  function guardar(d) {
    localStorage.setItem('token', d.token);
    localStorage.setItem('usuario', JSON.stringify(d.usuario));
    if (d.dispositivo) { localStorage.setItem('dispositivo', d.dispositivo); setConPin(true); }
    setUsuario(d.usuario);
  }

  async function entrar(email, password) {
    guardar(await api('/auth/login', { method: 'POST', body: { email, password } }));
  }

  async function entrarConPin(pin) {
    try {
      guardar(await api('/auth/pin', { method: 'POST', body: { pin, dispositivo: localStorage.getItem('dispositivo') } }));
    } catch (e) {
      if (e.datos?.dispositivo_invalido) olvidarEquipo();
      throw e;
    }
  }

  function salir() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  // Quita el permiso de PIN de este navegador (p. ej. si era una computadora prestada)
  function olvidarEquipo() {
    localStorage.removeItem('dispositivo');
    setConPin(false);
  }

  return <Ctx.Provider value={{ usuario, conPin, entrar, entrarConPin, salir, olvidarEquipo }}>{children}</Ctx.Provider>;
}
