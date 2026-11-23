import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-2xl border border-borde p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">{NOMBRE}</h1>
          <p className="text-tenue">Ingresa para ver tu restaurante.</p>
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
