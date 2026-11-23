const salir = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/';
};

export async function api(ruta, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa que esté encendido.');
  }
  let datos = null;
  try { datos = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && ruta !== '/auth/login') {
    salir();
    throw new Error(datos?.error || 'Tu sesión venció.');
  }
  if (!res.ok) throw new Error(datos?.error || 'No se pudo completar la acción.');
  return datos;
}
