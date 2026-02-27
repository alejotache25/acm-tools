import { useState, useEffect } from 'react';
import { CheckIcon, XMarkIcon, CalendarDaysIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoAusencia   = 'vacaciones' | 'dia_personal';
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
  operario_email:  string | null;
  created_at:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export default function AutorizacionVacaciones({ operarios }: { operarios: string[] }) {
  const { user } = useAuth();
  const [ausencias, setAusencias]     = useState<Ausencia[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filtro, setFiltro]           = useState<EstadoAusencia | 'todas'>('pendiente');
  const [processing, setProcessing]   = useState<string | null>(null);

  // Modal state
  const [modal, setModal]             = useState<{ id: string; accion: 'aprobada' | 'rechazada'; nombre: string; tipo: TipoAusencia; fecha_inicio: string; fecha_fin: string; dias: number; operario_email: string | null } | null>(null);
  const [comentario, setComentario]   = useState('');

  const load = async () => {
    if (operarios.length === 0) { setAusencias([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('ausencias')
      .select('*')
      .in('operario_nombre', operarios)
      .order('created_at', { ascending: false });
    setAusencias((data || []) as Ausencia[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operarios]);

  const openModal = (a: Ausencia, accion: 'aprobada' | 'rechazada') => {
    setComentario('');
    setModal({ id: a.id, accion, nombre: a.operario_nombre, tipo: a.tipo, fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin, dias: a.dias, operario_email: a.operario_email });
  };

  const resolver = async () => {
    if (!modal) return;
    setProcessing(modal.id);
    try {
      const { error } = await supabase
        .from('ausencias')
        .update({
          estado:          modal.accion,
          comentario_jefe: comentario.trim() || null,
          jefe_nombre:     user?.nombre ?? null,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', modal.id);

      if (error) throw error;
      // Email al operario es enviado automáticamente por el webhook notify-ausencia-resolved

      setAusencias(prev => prev.map(a =>
        a.id === modal.id
          ? { ...a, estado: modal.accion, comentario_jefe: comentario.trim() || null, jefe_nombre: user?.nombre ?? null }
          : a
      ));
      setModal(null);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(null);
    }
  };

  const visible = filtro === 'todas' ? ausencias : ausencias.filter(a => a.estado === filtro);
  const pendientes = ausencias.filter(a => a.estado === 'pendiente').length;

  return (
    <div className="space-y-4 mt-4">

      {/* Header + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
          <h2 className="font-bold text-slate-800 text-base">Autorización de Vacaciones</h2>
          {pendientes > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {pendientes}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <FunnelIcon className="h-4 w-4 text-slate-400" />
          {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors capitalize ${
                filtro === f
                  ? 'bg-slate-700 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pendiente' && pendientes > 0 ? ` (${pendientes})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Cargando solicitudes…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <CalendarDaysIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {filtro === 'todas' ? 'No hay solicitudes de ausencia.' : `No hay solicitudes en estado "${filtro}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(a => (
            <div
              key={a.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                a.estado === 'pendiente' ? 'border-amber-200' :
                a.estado === 'aprobada'  ? 'border-green-200' : 'border-red-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{a.operario_nombre}</span>
                    <span className="text-xs text-slate-500 font-medium">{tipoLabel(a.tipo)}</span>
                    <EstadoBadge estado={a.estado} />
                  </div>
                  <p className="text-xs text-slate-600">
                    {fmtFecha(a.fecha_inicio)} → {fmtFecha(a.fecha_fin)}
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-semibold">{a.dias} día{a.dias !== 1 ? 's' : ''}</span>
                  </p>
                  {a.comentario_jefe && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                      <span className="font-medium">Comentario:</span> {a.comentario_jefe}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Solicitado el {fmtFecha(a.created_at.split('T')[0])}
                    {a.jefe_nombre && ` · Revisado por ${a.jefe_nombre}`}
                  </p>
                </div>

                {/* Actions — only for pending */}
                {a.estado === 'pendiente' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openModal(a, 'aprobada')}
                      disabled={processing === a.id}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => openModal(a, 'rechazada')}
                      disabled={processing === a.id}
                      className="flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-800 text-base mb-1">
              {modal.accion === 'aprobada' ? '✓ Aprobar solicitud' : '✗ Rechazar solicitud'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              <span className="font-medium text-slate-700">{modal.nombre}</span>
              {' · '}{tipoLabel(modal.tipo)}
              {' · '}{fmtFecha(modal.fecha_inicio)} → {fmtFecha(modal.fecha_fin)}
              {' · '}<span className="font-semibold">{modal.dias} día{modal.dias !== 1 ? 's' : ''}</span>
            </p>

            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Comentario {modal.accion === 'rechazada' ? '(recomendado)' : '(opcional)'}
            </label>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={3}
              placeholder="Escribe un comentario para el operario…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={resolver}
                disabled={!!processing}
                className={`flex-1 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 text-sm ${
                  modal.accion === 'aprobada'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600   hover:bg-red-700'
                }`}
              >
                {processing ? 'Procesando…' : modal.accion === 'aprobada' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
