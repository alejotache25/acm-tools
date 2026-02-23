import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function Login() {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || pin.length !== 4) {
      setError('Introduce tu nombre y un PIN de 4 dígitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const hashed = await hashPin(pin);
      const { data, error: dbErr } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .eq('nombre', nombre.trim())
        .eq('pin', hashed)
        .single();

      if (dbErr || !data) {
        setError('Usuario o PIN incorrecto');
        return;
      }
      login({ id: data.id, nombre: data.nombre, rol: data.rol });
      navigate(data.rol === 'admin' ? '/admin' : '/seleccionar-operario');
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-gradient-to-r from-cyan-700 to-blue-700 rounded-t-xl p-8 text-center">
          <h1 className="text-white text-3xl font-bold tracking-wide">ACM Tools</h1>
          <p className="text-blue-200 text-sm mt-2">Gestión de Informes Operarios</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-300 rounded-b-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 outline-none transition-colors text-slate-800"
              placeholder="Tu nombre"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              PIN (4 dígitos)
            </label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 outline-none transition-colors text-slate-800 tracking-widest text-lg"
              placeholder="••••"
              maxLength={4}
              inputMode="numeric"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
