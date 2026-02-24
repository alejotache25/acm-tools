import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendWebhook } from '../lib/webhook';
import type { Issus as IssusRow } from '../types';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const monthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; };

const TIPOS_ISSUS = ['ACCION MEJORA', 'NO CONFORMIDAD', 'CORRECTIVA', 'INCIDENCIA'];

const initForm = () => ({
  fecha: today(), id_issus: '', tipo: TIPOS_ISSUS[0], descripcion: '', estado: 'ABIERTA',
});

export default function Issus({ operario }: { operario: string }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initForm());
  const [rows, setRows] = useState<IssusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('issus').select('*')
      .eq('operario', operario).gte('fecha', monthStart()).lte('fecha', monthEnd())
      .order('fecha', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    if (!form.descripcion.trim()) return alert('La descripción es obligatoria');
    setSaving(true);
    const payload = {
      fecha: form.fecha, operario,
      id_issus: form.id_issus ? Number(form.id_issus) : null,
      tipo: form.tipo, descripcion: form.descripcion,
      estado: form.estado,
      jefe_id: user.id, sync_pending: false,
    };
    const { data: inserted } = await supabase.from('issus').insert(payload).select().single();
    if (inserted) {
      const ok = await sendWebhook({ tabla: '06_INCIDENCIAS_ISSUS', accion: 'INSERT', datos: inserted });
      if (!ok) await supabase.from('issus').update({ sync_pending: true }).eq('id', inserted.id);
    }
    setForm(initForm());
    load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await supabase.from('issus').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-slate-700">Nuevo registro ISSUS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ID</label>
            <input type="number" value={form.id_issus} onChange={e => set('id_issus', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50">
              {TIPOS_ISSUS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <div className="flex gap-2 mt-1">
              {(['ABIERTA', 'CERRADA'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('estado', v)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    form.estado === v
                      ? v === 'ABIERTA'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60">
          <PlusIcon className="h-4 w-4" /> {saving ? 'Guardando...' : 'Añadir registro'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-3 py-2 text-left">FECHA</th>
              <th className="px-3 py-2 text-center">ID</th>
              <th className="px-3 py-2 text-left">TIPO</th>
              <th className="px-3 py-2 text-left">DESCRIPCIÓN</th>
              <th className="px-3 py-2 text-center">ESTADO</th>
              <th className="px-3 py-2 text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin registros este mes</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.fecha}</td>
                <td className="px-3 py-2 text-center text-slate-600">{r.id_issus ?? '-'}</td>
                <td className="px-3 py-2">
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">{r.tipo}</span>
                </td>
                <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{r.descripcion}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    (r.estado ?? 'ABIERTA') === 'ABIERTA'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {r.estado ?? 'ABIERTA'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50">
                    <TrashIcon className="h-4 w-4 text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
