import { useEffect, useState } from 'react';
import { Coffee, Delete, Eye, EyeOff, KeyRound, LogIn } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Aviso, Campo, NOMBRE, btnPrimario, campo } from '../ui.jsx';

// Teclado numérico: cada empleado entra con su PIN de 4 números
function EntrarConPin({ onUsarCorreo }) {
  const { entrarConPin } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (pin.length !== 4) return;
    setCargando(true);
    entrarConPin(pin).catch((e) => { setError(e.message); setPin(''); }).finally(() => setCargando(false));
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const teclear = (d) => { if (cargando) return; setError(''); setPin((p) => (p.length < 4 ? p + d : p)); };
  const borrar = () => setPin((p) => p.slice(0, -1));

  // También funciona con el teclado de la computadora
  useEffect(() => {
    const f = (e) => {
      if (/^\d$/.test(e.key)) teclear(e.key);
      else if (e.key === 'Backspace') borrar();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  const tecla = 'h-16 rounded-2xl bg-white border border-borde text-2xl font-extrabold hover:bg-cafe-suave active:bg-cafe-suave disabled:opacity-50';
  return (
    <div className="space-y-5">
      <p className="text-center text-tenue">Escribe tu PIN para empezar tu turno.</p>
      <div className="flex justify-center gap-4" aria-live="polite" aria-label={`${pin.length} de 4 números escritos`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-5 h-5 rounded-full border-2 border-cafe ${i < pin.length ? 'bg-cafe' : ''}`} />
        ))}
      </div>
      <Aviso tipo="error">{error}</Aviso>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={tecla} onClick={() => teclear(d)} disabled={cargando}>{d}</button>
        ))}
        <span />
        <button type="button" className={tecla} onClick={() => teclear('0')} disabled={cargando}>0</button>
        <button type="button" className={`${tecla} grid place-items-center`} onClick={borrar} aria-label="Borrar" disabled={cargando}><Delete size={26} /></button>
      </div>
      <button type="button" onClick={onUsarCorreo} className="w-full text-center font-bold text-cafe hover:underline">
        Entrar con correo y contraseña
      </button>
    </div>
  );
}

function EntrarConCorreo({ onUsarPin }) {
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
    <form onSubmit={enviar} className="space-y-4">
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
      {onUsarPin && (
        <button type="button" onClick={onUsarPin} className="w-full flex items-center justify-center gap-2 font-bold text-cafe hover:underline">
          <KeyRound size={18} aria-hidden="true" /> Entrar con PIN
        </button>
      )}
    </form>
  );
}

export default function Login() {
  const { conPin } = useAuth();
  const [modo, setModo] = useState(conPin ? 'pin' : 'correo');
  const pin = conPin && modo === 'pin';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cafe-espresso">
      <div className="w-full max-w-sm bg-fondo rounded-3xl p-7 space-y-5 shadow-2xl">
        <div className="text-center">
          <span className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-2xl bg-cafe text-white"><Coffee size={28} aria-hidden="true" /></span>
          <h1 className="text-3xl font-bold">{NOMBRE}</h1>
          {!pin && <p className="text-tenue">Bienvenido, ingresa para empezar el día.</p>}
        </div>
        {pin
          ? <EntrarConPin onUsarCorreo={() => setModo('correo')} />
          : <EntrarConCorreo onUsarPin={conPin ? () => setModo('pin') : null} />}
      </div>
    </div>
  );
}
