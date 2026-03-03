import { useState } from 'react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  tabla: string;
  registroId: string;
  registroResumen: string;
  solicitante: string;
  solicitanteRol: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SolicitudModal({
  tabla, registroId, registroResumen,
  solicitante, solicitanteRol,
  onClose, onSuccess,
}: Props) {
  const [motivo,  setMotivo]  = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const submit = async () => {
    if (!motivo.trim()) return;
    setSending(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('solicitudes') as any).insert({
      tipo:              'borrar',
      tabla,
      registro_id:       registroId,
      registro_resumen:  registroResumen,
      motivo:            motivo.trim(),
      solicitante,
      solicitante_rol:   solicitanteRol,
      estado:            'pendiente',
    });
    setSending(false);
    setSent(true);
    setTimeout(() => { onSuccess(); onClose(); }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">Solicitar autorización de borrado</h2>
            <p className="text-xs text-slate-400 mt-0.5">Solo el administrador puede eliminar registros</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Record info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Registro a eliminar</p>
            <p className="text-sm font-medium text-slate-800">{registroResumen}</p>
            <p className="text-xs text-slate-500 mt-0.5">Módulo: {tabla}</p>
          </div>

          {!sent ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo de la solicitud <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={4}
                  placeholder="Explica por qué necesitas eliminar este registro..."
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">El administrador recibirá esta solicitud y decidirá si aprobarla o rechazarla.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={submit}
                  disabled={!motivo.trim() || sending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {sending ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <span className="text-green-500 text-xl">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Solicitud enviada al administrador</p>
                <p className="text-xs text-green-700">Recibirás respuesta cuando sea revisada.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
