import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendWebhook } from '../lib/webhook';
import type { Incidencia } from '../types';
import SolicitudModal from '../components/SolicitudModal';

const today = () => new Date().toISOString().split('T')[0];
const thisYear = () => new Date().getFullYear();
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const monthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; };

const OPCIONES_INCIDENCIA = [
  'NO SE REALIZA LA LLAMADA DE CONTROL',
  'NO SE FICHA CORRECTAMENTE',
  'DOCUMENTACIÓN Y MATERIAL ENTREGADA FUERA DE PLAZO',
  'OTRO',
];

const initForm = () => ({
  fecha: today(),
  id_incidencia: '',
  ot: '',
  incidencia: OPCIONES_INCIDENCIA[0],
  incidencia_otro: '',
  puntos: 10,
  observaciones: '',
});

export default function Incidencias({ operario, readOnly = false }: { operario: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initForm());
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitudTarget, setSolicitudTarget] = useState<{ id: string; resumen: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('incidencias')
      .select('*')
      .eq('operario', operario)
      .gte('fecha', monthStart())
      .lte('fecha', monthEnd())
      .order('fecha', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    const incidenciaFinal = form.incidencia === 'OTRO' ? form.incidencia_otro : form.incidencia;
    if (!incidenciaFinal.trim()) return alert('Selecciona o escribe una incidencia');

    setSaving(true);
    const payload = {
      operario,
      año: thisYear(),
      fecha: form.fecha,
      id_incidencia: form.id_incidencia ? Number(form.id_incidencia) : null,
      ot: form.ot ? Number(form.ot) : null,
      incidencia: incidenciaFinal,
      puntos: Number(form.puntos),
      observaciones: form.observaciones,
      jefe_id: user.id,
      sync_pending: false,
    };

    const { data: inserted } = await supabase.from('incidencias').insert(payload).select().single();
    if (inserted) {
      const ok = await sendWebhook({ tabla: '01_DB_INCIDENCIAS', accion: 'INSERT', datos: inserted });
      if (!ok) await supabase.from('incidencias').update({ sync_pending: true }).eq('id', inserted.id);
    }
    setForm(initForm());
    load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await supabase.from('incidencias').delete().eq('id', id);
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
      {/* Form */}
      {!readOnly && <div className="bg-white rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-slate-700">Nuevo registro</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ID Incidencia</label>
            <input type="number" value={form.id_incidencia} onChange={e => set('id_incidencia', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">OT</label>
            <input type="number" value={form.ot} onChange={e => set('ot', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" placeholder="Opcional" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Incidencia</label>
            <select value={form.incidencia} onChange={e => set('incidencia', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50">
              {OPCIONES_INCIDENCIA.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Puntos</label>
            <input type="number" value={form.puntos} onChange={e => set('puntos', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          {form.incidencia === 'OTRO' && (
            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción de la incidencia</label>
              <input value={form.incidencia_otro} onChange={e => set('incidencia_otro', e.target.value)}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" placeholder="Describe la incidencia..." />
            </div>
          )}
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60">
          <PlusIcon className="h-4 w-4" /> {saving ? 'Guardando...' : 'Añadir registro'}
        </button>
      </div>}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-3 py-2 text-left">FECHA</th>
              <th className="px-3 py-2 text-left">OT</th>
              <th className="px-3 py-2 text-left">INCIDENCIA</th>
              <th className="px-3 py-2 text-center">PUNTOS</th>
              <th className="px-3 py-2 text-left">OBSERVACIONES</th>
              {!readOnly && <th className="px-3 py-2 text-center">ACCIONES</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {loading ? (
              <tr><td colSpan={readOnly ? 5 : 6} className="px-4 py-6 text-center text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={readOnly ? 5 : 6} className="px-4 py-6 text-center text-slate-400">Sin registros este mes</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">{r.fecha}</td>
                <td className="px-3 py-2 text-slate-600">{r.ot ?? '-'}</td>
                <td className="px-3 py-2 text-slate-800 max-w-xs truncate">{r.incidencia}</td>
                <td className="px-3 py-2 text-center font-semibold text-slate-800">{r.puntos}</td>
                <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{r.observaciones}</td>
                {!readOnly && (
                  <td className="px-3 py-2 text-center">
                    {user?.rol === 'admin' ? (
                      <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                        <TrashIcon className="h-4 w-4 text-red-500" />
                      </button>
                    ) : (
                      <button onClick={() => handleSolicitud(r.id, `${r.fecha} · ${r.incidencia}`)} className="p-1 rounded hover:bg-amber-50" title="Solicitar borrado al admin">
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
          tabla="incidencias"
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
