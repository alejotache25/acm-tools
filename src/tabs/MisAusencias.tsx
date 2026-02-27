import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { sendSolicitudEmail } from '../lib/email';

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoAusencia = 'vacaciones' | 'dia_personal';
type EstadoAusencia = 'pendiente' | 'aprobada' | 'rechazada';

interface Ausencia {
  id:              string;
  operario_nombre: string;
  tipo:            TipoAusencia;
  fecha_inicio:    string;
  fecha_fin:       string;
  dias:            number;
  estado:          EstadoAusencia;
  comentario_jefe: string | null;
  jefe_nombre:     string | null;
  created_at:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDias(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const d1 = new Date(inicio);
  const d2 = new Date(fin);
  if (d2 < d1) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function fmtFecha(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function tipoLabel(t: TipoAusencia) {
  return t === 'vacaciones' ? 'Vacaciones' : 'Día personal';
}

function EstadoBadge({ estado }: { estado: EstadoAusencia }) {
  const map = {
    pendiente:  'bg-amber-100 text-amber-800 border-amber-200',
    aprobada:   'bg-green-100 text-green-800 border-green-200',
    rechazada:  'bg-red-100   text-red-800   border-red-200',
  };
  const label = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[estado]}`}>
      {label[estado]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MisAusencias({ operario }: { operario: string }) {
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  // Form state
  const [tipo, setTipo]               = useState<TipoAusencia>('vacaciones');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin]       = useState('');
  const dias = calcDias(fechaInicio, fechaFin);

  // Load ausencias
  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ausencias')
      .select('*')
      .eq('operario_nombre', operario)
      .order('created_at', { ascending: false });
    setAusencias((data || []) as Ausencia[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const resetForm = () => {
    setTipo('vacaciones');
    setFechaInicio('');
    setFechaFin('');
    setError('');
    setShowForm(false);
  };

  const submit = async () => {
    setError('');
    if (!fechaInicio || !fechaFin) { setError('Indica fecha inicio y fecha fin.'); return; }
    if (dias <= 0) { setError('La fecha fin debe ser igual o posterior a la fecha inicio.'); return; }

    setSubmitting(true);
    try {
      // Insert request
      const { data: inserted, error: insErr } = await supabase
        .from('ausencias')
        .insert({ operario_nombre: operario, tipo, fecha_inicio: fechaInicio, fecha_fin: fechaFin, dias })
        .select()
        .single();

      if (insErr) throw insErr;

      // Notify jefe by email
      try {
        const { data: jefeRel } = await supabase
          .from('jefe_operario')
          .select('jefe_id')
          .eq('operario_nombre', operario)
          .limit(1)
          .maybeSingle();

        if (jefeRel?.jefe_id) {
          const { data: jefeUser } = await supabase
            .from('usuarios')
            .select('email, nombre')
            .eq('id', jefeRel.jefe_id)
            .maybeSingle();

          if (jefeUser?.email) {
            await sendSolicitudEmail({
              to_email:        jefeUser.email,
              to_name:         jefeUser.nombre,
              operario_nombre: operario,
              tipo:            tipoLabel(tipo),
              fecha_inicio:    fmtFecha(fechaInicio),
              fecha_fin:       fmtFecha(fechaFin),
              dias,
            });
          }
        }
      } catch (_) { /* email errors are non-blocking */ }

      setAusencias(prev => [inserted as Ausencia, ...prev]);
      resetForm();
    } catch (e: unknown) {
      setError('Error al enviar la solicitud. Inténtalo de nuevo.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
          <h2 className="font-bold text-slate-800 text-base">Mis Ausencias</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva solicitud
          </button>
        )}
      </div>

      {/* New request form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Nueva solicitud de ausencia</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Tipo de ausencia
              </label>
              <div className="flex gap-3">
                {(['vacaciones', 'dia_personal'] as TipoAusencia[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      tipo === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {tipoLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha inicio */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Fecha inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                min={today}
                onChange={e => {
                  setFechaInicio(e.target.value);
                  if (fechaFin && e.target.value > fechaFin) setFechaFin(e.target.value);
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Fecha fin */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Fecha fin
              </label>
              <input
                type="date"
                value={fechaFin}
                min={fechaInicio || today}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Días calculados */}
            {fechaInicio && fechaFin && dias > 0 && (
              <div className="sm:col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <CalendarDaysIcon className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-sm text-blue-800">
                    <span className="font-bold text-lg">{dias}</span>
                    {' '}día{dias !== 1 ? 's' : ''} naturales
                    {' '}· del {fmtFecha(fechaInicio)} al {fmtFecha(fechaFin)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={submit}
              disabled={submitting || !fechaInicio || !fechaFin || dias <= 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors text-sm"
            >
              {submitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Requests list */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Cargando solicitudes…</div>
      ) : ausencias.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <CalendarDaysIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No tienes solicitudes de ausencia.</p>
          <p className="text-slate-400 text-xs mt-1">Pulsa «Nueva solicitud» para crear una.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ausencias.map(a => (
            <div
              key={a.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                a.estado === 'pendiente' ? 'border-amber-200' :
                a.estado === 'aprobada'  ? 'border-green-200' : 'border-red-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{tipoLabel(a.tipo)}</span>
                    <EstadoBadge estado={a.estado} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {fmtFecha(a.fecha_inicio)} → {fmtFecha(a.fecha_fin)}
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-medium text-slate-700">{a.dias} día{a.dias !== 1 ? 's' : ''}</span>
                  </p>
                  {a.comentario_jefe && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1 mt-1">
                      <span className="font-medium">Comentario:</span> {a.comentario_jefe}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Solicitado el {fmtFecha(a.created_at.split('T')[0])}
                    {a.jefe_nombre && ` · Revisado por ${a.jefe_nombre}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
