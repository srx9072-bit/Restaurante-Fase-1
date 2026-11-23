import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Aviso, Campo, NOMBRE, btnPrimario, campo } from '../ui.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          <input className={campo} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        <Aviso tipo="error">{error}</Aviso>
        <button className={`${btnPrimario} w-full`} disabled={cargando}>
          <LogIn size={20} aria-hidden="true" /> {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
