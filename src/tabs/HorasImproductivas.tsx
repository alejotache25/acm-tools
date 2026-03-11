import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendWebhook } from '../lib/webhook';
import { logDelete } from '../lib/audit';
import type { HorasImproductivas as HIRow } from '../types';
import SolicitudModal from '../components/SolicitudModal';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const monthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; };

const CAMPOS = [
  { key: 'h_recg_mat',           label: 'H. Recogida Material',    objetivo: 'Obj: 1.5h' },
  { key: 'h_reunion',            label: 'H. Reunión',              objetivo: 'Obj: 1h' },
  { key: 'h_mant_furgos',        label: 'H. Mant. Furgonetas',     objetivo: 'Obj: 2h/mes' },
  { key: 'h_mant_instalaciones', label: 'H. Mant. Instalaciones',  objetivo: '' },
  { key: 'h_formacion',          label: 'H. Formación',            objetivo: '' },
  { key: 'consumibles_e',        label: 'Consumibles €',           objetivo: '' },
] as const;

type HKey = typeof CAMPOS[number]['key'];

const initForm = () => ({
  fecha: today(),
  h_recg_mat: '', h_reunion: '', h_mant_furgos: '',
  h_mant_instalaciones: '', h_formacion: '', consumibles_e: '',
  observaciones: '',
});

export default function HorasImproductivas({ operario, readOnly = false }: { operario: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initForm());
  const [rows, setRows] = useState<HIRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitudTarget, setSolicitudTarget] = useState<{ id: string; resumen: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('horas_improductivas').select('*')
      .eq('operario', operario).gte('fecha', monthStart()).lte('fecha', monthEnd())
      .order('fecha', { ascending: false });
    if (error) console.error('[HorasImproductivas] load error:', error.message, error.details);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const totalHoras = (['h_recg_mat', 'h_reunion', 'h_mant_furgos', 'h_mant_instalaciones', 'h_formacion'] as HKey[])
    .reduce((acc, k) => acc + (parseFloat(String(form[k as keyof typeof form])) || 0), 0);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const n = (k: HKey) => parseFloat(String(form[k as keyof typeof form])) || 0;
    const payload = {
      fecha: form.fecha, operario,
      h_recg_mat: n('h_recg_mat'), h_reunion: n('h_reunion'), h_mant_furgos: n('h_mant_furgos'),
      h_mant_instalaciones: n('h_mant_instalaciones'), h_formacion: n('h_formacion'),
      consumibles_e: n('consumibles_e'), observaciones: form.observaciones,
      jefe_id: user.id, sync_pending: false,
    };
    const { data: inserted, error: insertError } = await supabase.from('horas_improductivas').insert(payload).select().single();
    if (insertError || !inserted) {
      console.error('[HorasImproductivas] insert error:', insertError?.message, insertError?.details);
      alert(`Error al guardar: ${insertError?.message ?? 'Sin respuesta del servidor'}`);
      setSaving(false);
      return;
    }
    const ok = await sendWebhook({ tabla: '05_HORAS_IMPROD', accion: 'INSERT', datos: inserted });
    if (!ok) await supabase.from('horas_improductivas').update({ sync_pending: true }).eq('id', inserted.id);
    setForm(initForm());
    load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const row = rows.find(r => r.id === id);
    await supabase.from('horas_improductivas').delete().eq('id', id);
    if (row) await logDelete(user, 'eliminar_registro', 'horas_improductivas', row as unknown as Record<string, unknown>);
    load();
  };

  const handleSolicitud = (id: string, resumen: string) => setSolicitudTarget({ id, resumen });

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
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          {CAMPOS.map(({ key, label, objetivo }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {label} {objetivo && <span className="text-slate-400">({objetivo})</span>}
              </label>
              <input type="number" step="0.01" value={String(form[key as keyof typeof form])}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
            </div>
          ))}
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-xs text-blue-600 font-medium">Total horas: </span>
            <span className="text-blue-700 font-bold text-lg">{totalHoras.toFixed(2)}h</span>
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
              <th className="px-3 py-2 text-center">REC.MAT</th>
              <th className="px-3 py-2 text-center">REUNIÓN</th>
              <th className="px-3 py-2 text-center">FURGOS</th>
              <th className="px-3 py-2 text-center">INST.</th>
              <th className="px-3 py-2 text-center">FORM.</th>
              <th className="px-3 py-2 text-right">CONSUMIBLES</th>
              <th className="px-3 py-2 text-center">TOTAL H.</th>
              {!readOnly && <th className="px-3 py-2 text-center">ACCIONES</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {loading ? (
              <tr><td colSpan={readOnly ? 8 : 9} className="px-4 py-6 text-center text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={readOnly ? 8 : 9} className="px-4 py-6 text-center text-slate-400">Sin registros este mes</td></tr>
            ) : rows.map(r => {
              const total = (Number(r.h_recg_mat) + Number(r.h_reunion) + Number(r.h_mant_furgos) + Number(r.h_mant_instalaciones) + Number(r.h_formacion)).toFixed(2);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.fecha}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.h_recg_mat}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.h_reunion}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.h_mant_furgos}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.h_mant_instalaciones}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{r.h_formacion}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.consumibles_e} €</td>
                  <td className="px-3 py-2 text-center font-semibold text-blue-700">{total}h</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-center">
                      {user?.rol === 'admin' ? (
                        <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </button>
                      ) : (
                        <button onClick={() => handleSolicitud(r.id, `${r.fecha} · Horas improductivas`)} className="p-1 rounded hover:bg-amber-50" title="Solicitar borrado al admin">
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
          tabla="horas_improductivas"
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
