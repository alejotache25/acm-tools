import { useState, useEffect } from 'react';
import {
  EnvelopeIcon,
  MapPinIcon,
  ClockIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
      {initials}
    </div>
  );
}

function RolBadge({ rol }: { rol: string }) {
  const styles: Record<string, string> = {
    admin:    'bg-purple-100 text-purple-800 border-purple-200',
    jefe:     'bg-blue-100 text-blue-800 border-blue-200',
    operario: 'bg-green-100 text-green-800 border-green-200',
  };
  const labels: Record<string, string> = {
    admin:    'Administrador',
    jefe:     'Jefe / Supervisor',
    operario: 'Operario',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[rol] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[rol] ?? rol}
    </span>
  );
}

// ─── Change PIN Modal ─────────────────────────────────────────────────────────

function ChangePINModal({
  userId, userRol, jefeId, onClose,
}: { userId: string; userRol: string; jefeId?: string; onClose: () => void }) {
  const needsAuth = userRol === 'operario';
  const [step, setStep] = useState<'auth' | 'newpin'>(needsAuth ? 'auth' : 'newpin');
  const [jefePin, setJefePin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const verifyJefe = async () => {
    if (!jefeId) { setError('No tienes un jefe asignado.'); return; }
    if (jefePin.length !== 4) { setError('El PIN debe tener 4 dígitos.'); return; }
    setSaving(true);
    const hashed = await hashPin(jefePin);
    const { data } = await supabase
      .from('usuarios').select('id').eq('id', jefeId).eq('pin', hashed).maybeSingle();
    setSaving(false);
    if (!data) { setError('PIN del jefe incorrecto.'); return; }
    setError(''); setStep('newpin');
  };

  const savePin = async () => {
    if (newPin.length !== 4) { setError('El PIN debe tener 4 dígitos.'); return; }
    if (newPin !== confirmPin) { setError('Los PINs no coinciden.'); return; }
    setSaving(true);
    const hashed = await hashPin(newPin);
    await supabase.from('usuarios').update({ pin: hashed }).eq('id', userId);
    setSaving(false);
    alert('PIN actualizado correctamente.');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <LockClosedIcon className="h-5 w-5 text-blue-600" />
            {step === 'auth' ? 'Autorización del jefe' : 'Nuevo PIN'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {step === 'auth' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Tu jefe debe introducir su PIN para autorizar el cambio de contraseña.
            </p>
            <input
              type="password" maxLength={4} placeholder="PIN del jefe (4 dígitos)"
              value={jefePin} onChange={e => setJefePin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={verifyJefe} disabled={saving}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Verificando…' : 'Verificar autorización'}
            </button>
          </div>
        )}

        {step === 'newpin' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Introduce tu nuevo PIN de 4 dígitos.</p>
            <input
              type="password" maxLength={4} placeholder="Nuevo PIN"
              value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password" maxLength={4} placeholder="Confirmar PIN"
              value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={savePin} disabled={saving}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : 'Guardar nuevo PIN'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reset PIN Modal (admin only) ────────────────────────────────────────────

function ResetPINModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = async () => {
    const pin = newPin.length === 4 ? newPin : '0000';
    setSaving(true);
    const hashed = await hashPin(pin);
    await supabase.from('usuarios').update({ pin: hashed }).eq('id', userId);
    setSaving(false);
    alert(`PIN de ${userName} restablecido a ${pin}.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-slate-800">Restablecer PIN</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Introduce el nuevo PIN para <strong>{userName}</strong>. Si lo dejas vacío se usará <strong>0000</strong>.
        </p>
        <input
          type="text" maxLength={4} placeholder="Nuevo PIN (opcional)"
          value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <button onClick={reset} disabled={saving}
          className="w-full bg-amber-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {saving ? 'Restableciendo…' : 'Restablecer PIN'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Perfil() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [horario, setHorario] = useState('09:00 - 18:00');
  const [jefeId, setJefeId] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [editHorario, setEditHorario] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [showResetPIN, setShowResetPIN] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = user?.rol !== 'operario';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('usuarios').select('*').eq('id', user.id).single();
      if (data) {
        setEmail((data as any).email ?? user.email ?? '');
        setHorario((data as any).horario ?? '09:00 - 18:00');
        setEditEmail((data as any).email ?? user.email ?? '');
        setEditHorario((data as any).horario ?? '09:00 - 18:00');
      }
      if (user.rol === 'operario') {
        const { data: jo } = await supabase
          .from('jefe_operario').select('jefe_id').eq('operario_nombre', user.nombre).limit(1).maybeSingle();
        if (jo) setJefeId(jo.jefe_id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const saveEdits = async () => {
    if (!user) return;
    await supabase.from('usuarios')
      .update({ email: editEmail, horario: editHorario } as any)
      .eq('id', user.id);
    setEmail(editEmail);
    setHorario(editHorario);
    setEditing(false);
  };

  // Theme-aware classes
  const card = isDark
    ? 'bg-white/10 backdrop-blur border border-white/20'
    : 'bg-white border border-gray-200 shadow-sm';
  const textPrimary   = isDark ? 'text-white'      : 'text-slate-800';
  const textSecondary = isDark ? 'text-slate-300'   : 'text-slate-500';
  const textMuted     = isDark ? 'text-slate-400'   : 'text-slate-400';
  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (loading) {
    return <div className={`text-center py-16 ${textMuted}`}>Cargando perfil…</div>;
  }
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Page title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Mi Perfil</h1>
          <p className={`text-sm ${textMuted}`}>Información personal</p>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <PencilIcon className="h-4 w-4" /> Editar perfil
          </button>
        )}
        {canEdit && editing && (
          <div className="flex gap-2">
            <button onClick={saveEdits}
              className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-green-700 transition-colors">
              <CheckIcon className="h-4 w-4" /> Guardar
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 bg-slate-500 text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-600 transition-colors">
              <XMarkIcon className="h-4 w-4" /> Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Profile card */}
      <div className={`rounded-xl p-6 ${card}`}>
        <div className="flex items-start gap-5">
          <Avatar name={user.nombre} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className={`text-xl font-bold ${textPrimary}`}>{user.nombre}</h2>
              <RolBadge rol={user.rol} />
              <span className="flex items-center gap-1 text-xs text-green-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                Activo
              </span>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2">
              <EnvelopeIcon className={`h-4 w-4 ${textMuted} shrink-0`} />
              {editing ? (
                <input type="email" value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className={inputCls} placeholder="correo@ejemplo.com" />
              ) : (
                <span className={`text-sm ${textSecondary}`}>{email || '—'}</span>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPinIcon className={`h-4 w-4 ${textMuted} shrink-0`} />
              <span className={`text-sm ${textSecondary}`}>España · Europe/Madrid</span>
            </div>
          </div>
        </div>
      </div>

      {/* Horario card */}
      <div className={`rounded-xl p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="h-5 w-5 text-blue-400" />
          <h3 className={`font-semibold ${textPrimary}`}>Horario</h3>
        </div>
        {editing ? (
          <input type="text" value={editHorario}
            onChange={e => setEditHorario(e.target.value)}
            placeholder="Ej: 09:00 - 18:00"
            className={inputCls} />
        ) : (
          <p className={`text-sm ${textSecondary}`}>{horario}</p>
        )}
      </div>

      {/* Security card */}
      <div className={`rounded-xl p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="h-5 w-5 text-amber-400" />
          <h3 className={`font-semibold ${textPrimary}`}>Seguridad</h3>
        </div>

        <div className="space-y-3">
          {/* Change PIN */}
          <div className={`flex items-center justify-between py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <div>
              <p className={`text-sm font-medium ${textPrimary}`}>Cambiar PIN</p>
              {user.rol === 'operario' && (
                <p className={`text-xs ${textMuted}`}>Requiere autorización del jefe</p>
              )}
            </div>
            <button onClick={() => setShowChangePIN(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              <LockClosedIcon className="h-3.5 w-3.5" /> Cambiar
            </button>
          </div>

          {/* Reset PIN (admin only) */}
          {user.rol === 'admin' && (
            <div className="flex items-center justify-between py-3">
              <div>
                <p className={`text-sm font-medium ${textPrimary}`}>Restablecer PIN</p>
                <p className={`text-xs ${textMuted}`}>Restablece tu propio PIN de acceso</p>
              </div>
              <button onClick={() => setShowResetPIN(true)}
                className="flex items-center gap-1.5 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
                <UserCircleIcon className="h-3.5 w-3.5" /> Restablecer
              </button>
            </div>
          )}
        </div>
      </div>

      {showChangePIN && (
        <ChangePINModal userId={user.id} userRol={user.rol} jefeId={jefeId} onClose={() => setShowChangePIN(false)} />
      )}
      {showResetPIN && (
        <ResetPINModal userId={user.id} userName={user.nombre} onClose={() => setShowResetPIN(false)} />
      )}
    </div>
  );
}
