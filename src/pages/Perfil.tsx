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
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  UserGroupIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── PIN Input with eye toggle ────────────────────────────────────────────────
function PinInput({
  value, onChange, placeholder = 'PIN (4 dígitos)',
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        maxLength={4}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
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
  userId, userRol, jefeId, operarioNombre, onClose,
}: { userId: string; userRol: string; jefeId?: string; operarioNombre: string; onClose: () => void }) {
  const isOperario = userRol === 'operario';
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    if (newPin.length !== 4) { setError('El PIN debe tener 4 dígitos.'); return; }
    if (newPin !== confirmPin) { setError('Los PINs no coinciden.'); return; }
    setSaving(true);
    const hashed = await hashPin(newPin);
    if (isOperario) {
      if (!jefeId) { setError('No tienes un jefe asignado.'); setSaving(false); return; }
      await (supabase.from('solicitudes_pin') as any).insert({
        operario_id: userId,
        operario_nombre: operarioNombre,
        jefe_id: jefeId,
        nuevo_pin_hash: hashed,
        estado: 'pendiente',
      });
      setDone(true);
    } else {
      await supabase.from('usuarios').update({ pin: hashed }).eq('id', userId);
      alert('PIN actualizado correctamente.');
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <LockClosedIcon className="h-5 w-5 text-blue-600" />
            Cambiar PIN
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-700 font-medium">Solicitud enviada</p>
              <p className="text-xs text-green-600 mt-1">
                Tu jefe recibirá una notificación para aprobar el cambio de PIN.
              </p>
            </div>
            <button onClick={onClose}
              className="w-full bg-slate-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-700 transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {isOperario && (
              <p className="text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
                Tu solicitud será enviada a tu jefe para su aprobación.
              </p>
            )}
            <PinInput
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Nuevo PIN"
            />
            <PinInput
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirmar PIN"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={save} disabled={saving}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : (isOperario ? 'Enviar solicitud' : 'Guardar nuevo PIN')}
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
        <PinInput
          value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Nuevo PIN (opcional)"
        />
        <button onClick={reset} disabled={saving}
          className="w-full mt-4 bg-amber-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {saving ? 'Restableciendo…' : 'Restablecer PIN'}
        </button>
      </div>
    </div>
  );
}

// ─── Jefe Reset Operario PIN Modal ────────────────────────────────────────────
function JefeResetPINModal({
  operarioId, operarioNombre, onClose,
}: { operarioId: string; operarioNombre: string; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = async () => {
    const p = pin.length === 4 ? pin : '0000';
    setSaving(true);
    const hashed = await hashPin(p);
    await supabase.from('usuarios').update({ pin: hashed }).eq('id', operarioId);
    setSaving(false);
    alert(`PIN de ${operarioNombre} restablecido${pin.length === 4 ? '' : ' a 0000'}.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <KeyIcon className="h-5 w-5 text-amber-500" />
            Restablecer PIN
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Nuevo PIN para <strong>{operarioNombre}</strong>. Si lo dejas vacío se usará <strong>0000</strong>.
        </p>
        <PinInput
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Nuevo PIN (opcional)"
        />
        <button onClick={reset} disabled={saving}
          className="w-full mt-4 bg-amber-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {saving ? 'Restableciendo…' : 'Restablecer PIN'}
        </button>
      </div>
    </div>
  );
}

// ─── Jefe Sections (solicitudes PIN + reset operarios) ────────────────────────
interface SolicitudPin {
  id: string;
  operario_id: string;
  operario_nombre: string;
  jefe_id: string;
  nuevo_pin_hash: string;
  estado: string;
  created_at: string;
}
interface OperarioBasic { id: string; nombre: string }

function JefeSections({
  jefeId, card, textPrimary, textMuted, isDark,
}: {
  jefeId: string; card: string; textPrimary: string; textMuted: string; isDark: boolean;
}) {
  const [solicitudes, setSolicitudes] = useState<SolicitudPin[]>([]);
  const [operarios, setOperarios] = useState<OperarioBasic[]>([]);
  const [resetTarget, setResetTarget] = useState<OperarioBasic | null>(null);

  const load = async () => {
    const [{ data: sols }, { data: jo }] = await Promise.all([
      (supabase.from('solicitudes_pin') as any)
        .select('*')
        .eq('jefe_id', jefeId)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
      supabase.from('jefe_operario').select('operario_nombre').eq('jefe_id', jefeId),
    ]);
    setSolicitudes(sols || []);
    if (jo && (jo as any[]).length > 0) {
      const nombres = (jo as any[]).map(r => r.operario_nombre);
      const { data: us } = await supabase
        .from('usuarios').select('id, nombre').in('nombre', nombres).eq('rol', 'operario');
      setOperarios((us as OperarioBasic[]) || []);
    }
  };

  useEffect(() => { load(); }, [jefeId]);

  const aprobar = async (s: SolicitudPin) => {
    await supabase.from('usuarios').update({ pin: s.nuevo_pin_hash }).eq('id', s.operario_id);
    await (supabase.from('solicitudes_pin') as any).update({ estado: 'aprobado' }).eq('id', s.id);
    load();
  };

  const rechazar = async (s: SolicitudPin) => {
    await (supabase.from('solicitudes_pin') as any).update({ estado: 'rechazado' }).eq('id', s.id);
    load();
  };

  const rowCls = `flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`;

  return (
    <>
      {/* Pending PIN change requests */}
      {solicitudes.length > 0 && (
        <div className={`rounded-xl p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <LockClosedIcon className="h-5 w-5 text-blue-400" />
            <h3 className={`font-semibold ${textPrimary}`}>Solicitudes de cambio de PIN</h3>
            <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
              {solicitudes.length}
            </span>
          </div>
          <div className="space-y-2">
            {solicitudes.map(s => (
              <div key={s.id} className={rowCls}>
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>{s.operario_nombre}</p>
                  <p className={`text-xs ${textMuted}`}>
                    {new Date(s.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => aprobar(s)}
                    className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                    <CheckIcon className="h-3.5 w-3.5" /> Aprobar
                  </button>
                  <button onClick={() => rechazar(s)}
                    className="flex items-center gap-1 bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">
                    <XMarkIcon className="h-3.5 w-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operarios management (reset PIN) */}
      {operarios.length > 0 && (
        <div className={`rounded-xl p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <UserGroupIcon className="h-5 w-5 text-cyan-400" />
            <h3 className={`font-semibold ${textPrimary}`}>Mis Operarios</h3>
          </div>
          <div className="space-y-2">
            {operarios.map(o => (
              <div key={o.id} className={rowCls}>
                <p className={`text-sm font-medium ${textPrimary}`}>{o.nombre}</p>
                <button onClick={() => setResetTarget(o)}
                  className="flex items-center gap-1.5 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
                  <KeyIcon className="h-3.5 w-3.5" /> Restablecer PIN
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {resetTarget && (
        <JefeResetPINModal
          operarioId={resetTarget.id}
          operarioNombre={resetTarget.nombre}
          onClose={() => { setResetTarget(null); load(); }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Perfil() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [horario, setHorario] = useState('09:00 - 18:00');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [estado, setEstado] = useState('activo');
  const [jefeId, setJefeId] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [editHorario, setEditHorario] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editEstado, setEditEstado] = useState('activo');
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [showResetPIN, setShowResetPIN] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = user?.rol !== 'operario';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
      if (data) {
        const d = data as any;
        setEmail(d.email ?? user.email ?? '');
        setHorario(d.horario ?? '09:00 - 18:00');
        setNombre(d.nombre ?? user.nombre ?? '');
        setTelefono(d.telefono ?? '');
        setEstado(d.estado ?? 'activo');
        setEditEmail(d.email ?? user.email ?? '');
        setEditHorario(d.horario ?? '09:00 - 18:00');
        setEditNombre(d.nombre ?? user.nombre ?? '');
        setEditTelefono(d.telefono ?? '');
        setEditEstado(d.estado ?? 'activo');
      }
      if (user.rol === 'operario') {
        const { data: jo } = await supabase
          .from('jefe_operario').select('jefe_id').eq('operario_nombre', user.nombre).limit(1).maybeSingle();
        if (jo) setJefeId((jo as any).jefe_id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const saveEdits = async () => {
    if (!user) return;
    await supabase.from('usuarios')
      .update({ email: editEmail, horario: editHorario, nombre: editNombre, telefono: editTelefono, estado: editEstado } as any)
      .eq('id', user.id);
    setEmail(editEmail);
    setHorario(editHorario);
    setNombre(editNombre);
    setTelefono(editTelefono);
    setEstado(editEstado);
    setEditing(false);
  };

  // Theme-aware classes
  const card          = isDark ? 'bg-white/10 backdrop-blur border border-white/20' : 'bg-white border border-gray-200 shadow-sm';
  const textPrimary   = isDark ? 'text-white'    : 'text-slate-800';
  const textSecondary = isDark ? 'text-slate-300' : 'text-slate-500';
  const textMuted     = isDark ? 'text-slate-400' : 'text-slate-400';
  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (loading) return <div className={`text-center py-16 ${textMuted}`}>Cargando perfil…</div>;
  if (!user) return null;

  const displayName = nombre || user.nombre;

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
          <Avatar name={displayName} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {editing ? (
                <input
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  className={`${inputCls} text-base font-bold`}
                  placeholder="Nombre completo"
                />
              ) : (
                <>
                  <h2 className={`text-xl font-bold ${textPrimary}`}>{displayName}</h2>
                  <RolBadge rol={user.rol} />
                  {estado === 'inactivo' ? (
                    <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      Inactivo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-green-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                      Activo
                    </span>
                  )}
                </>
              )}
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

            {/* Teléfono */}
            <div className="flex items-center gap-2">
              <PhoneIcon className={`h-4 w-4 ${textMuted} shrink-0`} />
              {editing ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className={`text-sm ${textMuted} shrink-0`}>+34</span>
                  <input type="tel" value={editTelefono}
                    onChange={e => setEditTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    inputMode="numeric" placeholder="600000000"
                    className={inputCls} />
                </div>
              ) : (
                <span className={`text-sm ${textSecondary}`}>
                  {telefono ? `+34 ${telefono}` : '—'}
                </span>
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

      {/* Horario + Estado card */}
      <div className={`rounded-xl p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="h-5 w-5 text-blue-400" />
          <h3 className={`font-semibold ${textPrimary}`}>Horario de trabajo</h3>
        </div>
        {editing ? (
          <div className="space-y-3">
            <input type="text" value={editHorario}
              onChange={e => setEditHorario(e.target.value)}
              placeholder="Ej: 09:00 - 18:00"
              className={inputCls} />
            <div>
              <label className={`block text-xs font-medium ${textMuted} mb-1`}>Estado</label>
              <select value={editEstado} onChange={e => setEditEstado(e.target.value)}
                className={inputCls}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className={`text-sm ${textSecondary}`}>{horario}</p>
          </div>
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
                <p className={`text-xs ${textMuted}`}>Tu jefe recibirá una solicitud de autorización</p>
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

      {/* Jefe: solicitudes PIN + mis operarios */}
      {user.rol === 'jefe' && (
        <JefeSections
          jefeId={user.id}
          card={card}
          textPrimary={textPrimary}
          textMuted={textMuted}
          isDark={isDark}
        />
      )}

      {showChangePIN && (
        <ChangePINModal
          userId={user.id}
          userRol={user.rol}
          jefeId={jefeId}
          operarioNombre={user.nombre}
          onClose={() => setShowChangePIN(false)}
        />
      )}
      {showResetPIN && (
        <ResetPINModal userId={user.id} userName={user.nombre} onClose={() => setShowResetPIN(false)} />
      )}
    </div>
  );
}
