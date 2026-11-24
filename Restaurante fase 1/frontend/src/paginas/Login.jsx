import { useState } from 'react';
import { Coffee, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Aviso, Campo, NOMBRE, btnPrimario, campo } from '../ui.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try { await entrar(email, password); } catch (err) { setError(err.message); } finally { setCargando(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cafe-espresso">
      <form onSubmit={enviar} className="w-full max-w-sm bg-fondo rounded-3xl p-7 space-y-4 shadow-2xl">
        <div className="text-center">
          <span className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-2xl bg-cafe text-white"><Coffee size={28} aria-hidden="true" /></span>
          <h1 className="text-3xl font-bold">{NOMBRE}</h1>
          <p className="text-tenue">Bienvenido, ingresa para empezar el día.</p>
        </div>
        <Campo etiqueta="Correo">
          <input className={campo} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Campo>
        <Campo etiqueta="Contraseña">
          <div className="relative">
            <input className={`${campo} pr-12`} type={ver ? 'text' : 'password'} autoComplete="current-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-tenue hover:text-tinta">
              {ver ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </Campo>
        <Aviso tipo="error">{error}</Aviso>
        <button className={`${btnPrimario} w-full`} disabled={cargando}>
          <LogIn size={20} aria-hidden="true" /> {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
