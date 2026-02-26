import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendWebhook } from '../lib/webhook';
import type { Visita } from '../types';
import SolicitudModal from '../components/SolicitudModal';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const monthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; };

const TIPOS_VISITA = [
  'CONTROL DE CALIDAD INSTALACIONES',
  'CONTROL DE CALIDAD MANTENIMIENTOS',
];

const initForm = () => ({
  fecha: today(), inspeccion: 'X PERICH', ot: '',
  tipo_visita: TIPOS_VISITA[0], ok_visita: 'OK',
  cliente: '', observaciones: '',
});

export default function Visitas({ operario, readOnly = false }: { operario: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initForm());
  const [rows, setRows] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitudTarget, setSolicitudTarget] = useState<{ id: string; resumen: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('visitas').select('*')
      .eq('operario', operario).gte('fecha', monthStart()).lte('fecha', monthEnd())
      .order('fecha', { ascending: false });
    if (error) console.error('[Visitas] load error:', error.message, error.details);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      fecha: form.fecha, operario, inspeccion: form.inspeccion,
      ot: form.ot ? Number(form.ot) : null, tipo_visita: form.tipo_visita,
      ok_visita: form.ok_visita,
      cliente: form.cliente || null, observaciones: form.observaciones || null,
      jefe_id: user.id, sync_pending: false,
    };
    const { data: inserted, error: insertError } = await supabase.from('visitas').insert(payload).select().single();
    if (insertError || !inserted) {
      console.error('[Visitas] insert error:', insertError?.message, insertError?.details);
      alert(`Error al guardar: ${insertError?.message ?? 'Sin respuesta del servidor'}`);
      setSaving(false);
      return;
    }
    const ok = await sendWebhook({ tabla: '03_VISITAS', accion: 'INSERT', datos: inserted });
    if (!ok) await supabase.from('visitas').update({ sync_pending: true }).eq('id', inserted.id);
    setForm(initForm());
    load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await supabase.from('visitas').delete().eq('id', id);
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
        <h3 className="font-semibold text-slate-700">Nueva visita</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Inspección</label>
            <input value={form.inspeccion} onChange={e => set('inspeccion', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">OT</label>
            <input type="number" value={form.ot} onChange={e => set('ot', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" placeholder="Opcional" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de visita</label>
            <select value={form.tipo_visita} onChange={e => set('tipo_visita', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50">
              {TIPOS_VISITA.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Resultado</label>
            <div className="flex gap-3 mt-2">
              {['OK', 'NOK'].map(v => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="ok_visita" value={v} checked={form.ok_visita === v} onChange={() => set('ok_visita', v)} />
                  <span className={`text-sm font-semibold ${v === 'OK' ? 'text-green-600' : 'text-red-600'}`}>{v}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
            <input value={form.cliente} onChange={e => set('cliente', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50"
              placeholder="Nombre del cliente" />
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none"
              placeholder="Observaciones adicionales (opcional)" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60">
          <PlusIcon className="h-4 w-4" /> {saving ? 'Guardando...' : 'Añadir registro'}
        </button>
      </div>}

      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-3 py-2 text-left">FECHA</th>
              <th className="px-3 py-2 text-left">OT</th>
              <th className="px-3 py-2 text-left">INSPECCIÓN</th>
              <th className="px-3 py-2 text-left">TIPO VISITA</th>
              <th className="px-3 py-2 text-center">OK/NOK</th>
              <th className="px-3 py-2 text-left">CLIENTE</th>
              <th className="px-3 py-2 text-left">OBSERVACIONES</th>
              {!readOnly && <th className="px-3 py-2 text-center">ACCIONES</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {loading ? (
              <tr><td colSpan={readOnly ? 7 : 8} className="px-4 py-6 text-center text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={readOnly ? 7 : 8} className="px-4 py-6 text-center text-slate-400">Sin registros este mes</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.fecha}</td>
                <td className="px-3 py-2 text-slate-600">{r.ot ?? '-'}</td>
                <td className="px-3 py-2 text-slate-700">{r.inspeccion}</td>
                <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate">{r.tipo_visita}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.ok_visita === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.ok_visita}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700 max-w-[120px] truncate">{r.cliente ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={r.observaciones ?? ''}>{r.observaciones ?? '-'}</td>
                {!readOnly && (
                  <td className="px-3 py-2 text-center">
                    {user?.rol === 'admin' ? (
                      <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                        <TrashIcon className="h-4 w-4 text-red-500" />
                      </button>
                    ) : (
                      <button onClick={() => handleSolicitud(r.id, `${r.fecha} · ${r.tipo_visita} · ${r.ok_visita}`)} className="p-1 rounded hover:bg-amber-50" title="Solicitar borrado al admin">
                        <ClockIcon className="h-4 w-4 text-amber-500" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {solicitudTarget && user && (
        <SolicitudModal
          tabla="visitas"
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
