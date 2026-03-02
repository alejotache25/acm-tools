import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendWebhook } from '../lib/webhook';
import { logDelete } from '../lib/audit';
import type { Limpieza as LimpiezaRow } from '../types';
import SolicitudModal from '../components/SolicitudModal';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const monthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; };

const CAMPOS_NOTA = [
  { key: 'vestuario_h',          label: 'Vestuario/H' },
  { key: 'limpieza_vh',          label: 'Limpieza VH' },
  { key: 'limpieza_vh_sorpresa', label: 'Limpieza VH Sorpresa' },
  { key: 'seguridad_t',          label: 'Seguridad T' },
  { key: 'herramientas',         label: 'Herramientas' },
] as const;

type NotaKey = typeof CAMPOS_NOTA[number]['key'];
type NotaForm = Record<NotaKey, number>;

const initForm = (): NotaForm & { fecha: string; observaciones: string } => ({
  fecha: today(), vestuario_h: 0, limpieza_vh: 0,
  limpieza_vh_sorpresa: 0, seguridad_t: 0, herramientas: 0, observaciones: '',
});

function promedio(f: NotaForm) {
  const vals = CAMPOS_NOTA.map(c => f[c.key]);
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

export default function Limpieza({ operario, readOnly = false }: { operario: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initForm());
  const [rows, setRows] = useState<LimpiezaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitudTarget, setSolicitudTarget] = useState<{ id: string; resumen: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('limpieza').select('*')
      .eq('operario', operario).gte('fecha', monthStart()).lte('fecha', monthEnd())
      .order('fecha', { ascending: false });
    if (error) console.error('[Limpieza] load error:', error.message, error.details);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const setField = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      fecha: form.fecha, operario,
      vestuario_h: form.vestuario_h, limpieza_vh: form.limpieza_vh,
      limpieza_vh_sorpresa: form.limpieza_vh_sorpresa, seguridad_t: form.seguridad_t,
      herramientas: form.herramientas, observaciones: form.observaciones,
      jefe_id: user.id, sync_pending: false,
    };
    const { data: inserted, error: insertError } = await supabase.from('limpieza').insert(payload).select().single();
    if (insertError || !inserted) {
      console.error('[Limpieza] insert error:', insertError?.message, insertError?.details);
      alert(`Error al guardar: ${insertError?.message ?? 'Sin respuesta del servidor'}`);
      setSaving(false);
      return;
    }
    const ok = await sendWebhook({ tabla: '04_LIMPIEZA', accion: 'INSERT', datos: inserted });
    if (!ok) await supabase.from('limpieza').update({ sync_pending: true }).eq('id', inserted.id);
    setForm(initForm());
    load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const row = rows.find(r => r.id === id);
    await supabase.from('limpieza').delete().eq('id', id);
    if (row) await logDelete(user, 'eliminar_registro', 'limpieza', row as unknown as Record<string, unknown>);
    load();
  };

  const handleSolicitud = (id: string, resumen: string) => setSolicitudTarget({ id, resumen });

  const avg = promedio(form);

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700 font-medium">
          Vista de solo lectura — modo supervisor
        </div>
      )}
      {!readOnly && <div className="bg-white rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-slate-700">Nuevo registro</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setField('fecha', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          {CAMPOS_NOTA.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label} (0–10)</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={10} step={0.5} value={form[key]}
                  onChange={e => setField(key, parseFloat(e.target.value))}
                  className="flex-1 accent-blue-600" />
                <span className="text-sm font-semibold text-slate-700 w-8 text-right">{form[key]}</span>
              </div>
            </div>
          ))}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setField('observaciones', e.target.value)} rows={2}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-xs text-blue-600 font-medium">Promedio: </span>
            <span className="text-blue-700 font-bold text-lg">{avg}</span>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60">
            <PlusIcon className="h-4 w-4" /> {saving ? 'Guardando...' : 'Añadir registro'}
          </button>
        </div>
      </div>}

      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-3 py-2 text-left">FECHA</th>
              <th className="px-3 py-2 text-center">VESTUARIO</th>
              <th className="px-3 py-2 text-center">LIMP.VH</th>
              <th className="px-3 py-2 text-center">SORPRESA</th>
              <th className="px-3 py-2 text-center">SEGURIDAD</th>
              <th className="px-3 py-2 text-center">HERRAM.</th>
              <th className="px-3 py-2 text-center">PROMEDIO</th>
              {!readOnly && <th className="px-3 py-2 text-center">ACCIONES</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {loading ? (
              <tr><td colSpan={readOnly ? 7 : 8} className="px-4 py-6 text-center text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={readOnly ? 7 : 8} className="px-4 py-6 text-center text-slate-400">Sin registros este mes</td></tr>
            ) : rows.map(r => {
              const rowAvg = ((Number(r.vestuario_h) + Number(r.limpieza_vh) + Number(r.limpieza_vh_sorpresa) + Number(r.seguridad_t) + Number(r.herramientas)) / 5).toFixed(2);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.fecha}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.vestuario_h}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.limpieza_vh}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.limpieza_vh_sorpresa}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.seguridad_t}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.herramientas}</td>
                  <td className="px-3 py-2 text-center font-semibold text-blue-700">{rowAvg}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-center">
                      {user?.rol === 'admin' ? (
                        <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </button>
                      ) : (
                        <button onClick={() => handleSolicitud(r.id, `${r.fecha} · Limpieza`)} className="p-1 rounded hover:bg-amber-50" title="Solicitar borrado al admin">
                          <ClockIcon className="h-4 w-4 text-amber-500" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {solicitudTarget && user && (
        <SolicitudModal
          tabla="limpieza"
          registroId={solicitudTarget.id}
          registroResumen={solicitudTarget.resumen}
          solicitante={user.nombre}
          solicitanteRol={user.rol}
          onClose={() => setSolicitudTarget(null)}
          onSuccess={() => { setSolicitudTarget(null); load(); }}
        />
      )}
    </div>
  );
}
