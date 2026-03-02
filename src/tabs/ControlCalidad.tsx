import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendWebhook } from '../lib/webhook';
import { logDelete } from '../lib/audit';
import type { ControlCalidad as CCRow } from '../types';
import SolicitudModal from '../components/SolicitudModal';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; };
const monthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; };

const TARIFA_HORA = 39;

const TIPOS_CQ = [
  'DEFECTO FABRICACION (GARANTIA)',
  'ATENCION COMERCIAL',
  'NO SE RESPETAN LOS PROCESOS DE TRABAJO',
  'FALTA DE COMPETENCIA',
  'RETORNO ATRIBUIBLE',
  'OTRO',
];

const initForm = () => ({
  fecha: today(), ot: '', cliente: '', descripcion: '',
  resolucion: '', marca: '',
  tipo_cq: TIPOS_CQ[0], horas: '', materiales: '',
});

export default function ControlCalidad({ operario, readOnly = false }: { operario: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initForm());
  const [rows, setRows] = useState<CCRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitudTarget, setSolicitudTarget] = useState<{ id: string; resumen: string } | null>(null);

  const horas = parseFloat(form.horas) || 0;
  const materiales = parseFloat(form.materiales) || 0;
  const importe_h = +(horas * TARIFA_HORA).toFixed(2);
  const total_cq  = +(importe_h + materiales).toFixed(2);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('control_calidad').select('*')
      .eq('operario', operario)
      .gte('fecha', monthStart()).lte('fecha', monthEnd())
      .order('fecha', { ascending: false });
    if (error) console.error('[ControlCalidad] load error:', error.message, error.details);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    if (!form.cliente.trim()) return alert('El campo cliente es obligatorio');
    setSaving(true);
    const payload = {
      fecha: form.fecha, ot: form.ot ? Number(form.ot) : null,
      operario, cliente: form.cliente, descripcion: form.descripcion,
      resolucion: form.resolucion || null, marca: form.marca || null,
      tipo_cq: form.tipo_cq, horas, importe_h, materiales, total_cq,
      jefe_id: user.id, sync_pending: false,
    };
    const { data: inserted, error: insertError } = await supabase.from('control_calidad').insert(payload).select().single();
    if (insertError || !inserted) {
      console.error('[ControlCalidad] insert error:', insertError?.message, insertError?.details);
      alert(`Error al guardar: ${insertError?.message ?? 'Sin respuesta del servidor'}`);
      setSaving(false);
      return;
    }
    const ok = await sendWebhook({ tabla: '02_CONTROL_CALIDAD', accion: 'INSERT', datos: inserted });
    if (!ok) await supabase.from('control_calidad').update({ sync_pending: true }).eq('id', inserted.id);
    setForm(initForm());
    load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const row = rows.find(r => r.id === id);
    await supabase.from('control_calidad').delete().eq('id', id);
    if (row) await logDelete(user, 'eliminar_registro', 'control_calidad', row as unknown as Record<string, unknown>);
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">OT</label>
            <input type="number" value={form.ot} onChange={e => set('ot', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Operario</label>
            <input value={operario} disabled
              className="w-full bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
            <input value={form.cliente} onChange={e => set('cliente', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={form.tipo_cq} onChange={e => set('tipo_cq', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50">
              {TIPOS_CQ.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Incidencia *</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none"
              placeholder="Descripción de la incidencia / problema detectado" />
          </div>
          <div className="sm:col-span-2 md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Resolución</label>
            <textarea value={form.resolucion} onChange={e => set('resolucion', e.target.value)} rows={2}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50 resize-none"
              placeholder="Cómo se resolvió la incidencia" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
            <input value={form.marca} onChange={e => set('marca', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50"
              placeholder="Marca del vehículo / equipo" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Horas</label>
            <input type="number" step="0.01" value={form.horas} onChange={e => set('horas', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Importe H. ({TARIFA_HORA}€/h)</label>
            <input value={`${importe_h.toFixed(2)} €`} disabled
              className="w-full bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Materiales €</label>
            <input type="number" step="0.01" value={form.materiales} onChange={e => set('materiales', e.target.value)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Total €</label>
            <input value={`${total_cq.toFixed(2)} €`} disabled
              className="w-full bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 font-semibold cursor-not-allowed" />
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
              <th className="px-3 py-2 text-left">Nº</th>
              <th className="px-3 py-2 text-left">FECHA</th>
              <th className="px-3 py-2 text-left">OT</th>
              <th className="px-3 py-2 text-left">CLIENTE</th>
              <th className="px-3 py-2 text-left">MARCA</th>
              <th className="px-3 py-2 text-left">INCIDENCIA</th>
              <th className="px-3 py-2 text-left">RESOLUCIÓN</th>
              <th className="px-3 py-2 text-left">TIPO</th>
              <th className="px-3 py-2 text-right">HORAS</th>
              <th className="px-3 py-2 text-right">TOTAL</th>
              {!readOnly && <th className="px-3 py-2 text-center">ACCIONES</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {loading ? (
              <tr><td colSpan={readOnly ? 10 : 11} className="px-4 py-6 text-center text-slate-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={readOnly ? 10 : 11} className="px-4 py-6 text-center text-slate-400">Sin registros este mes</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-slate-500">{r.numero}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.fecha}</td>
                <td className="px-3 py-2 text-slate-600">{r.ot ?? '-'}</td>
                <td className="px-3 py-2 text-slate-800 max-w-[110px] truncate">{r.cliente}</td>
                <td className="px-3 py-2 text-slate-600 max-w-[90px] truncate">{r.marca ?? '-'}</td>
                <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate" title={r.descripcion}>{r.descripcion}</td>
                <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate" title={r.resolucion ?? ''}>{r.resolucion ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600 max-w-[130px] truncate">{r.tipo_cq}</td>
                <td className="px-3 py-2 text-right text-slate-700">{r.horas}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{Number(r.total_cq).toFixed(2)} €</td>
                {!readOnly && (
                  <td className="px-3 py-2 text-center">
                    {user?.rol === 'admin' ? (
                      <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                        <TrashIcon className="h-4 w-4 text-red-500" />
                      </button>
                    ) : (
                      <button onClick={() => handleSolicitud(r.id, `${r.fecha} · ${r.cliente} · ${r.tipo_cq}`)} className="p-1 rounded hover:bg-amber-50" title="Solicitar borrado al admin">
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
          tabla="control_calidad"
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
