import { useState, useEffect } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { KpiResumen, KpiDetalle } from '../types';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const now = new Date();
const initResumen = () => ({
  mes: now.getMonth() + 1, año: now.getFullYear(),
  importe: 0, acumulado: 0, a_cobrar: 0, objetivo: 0, dietas: 0, h_extras: 0,
});

const initDetalle = () => ({
  prod_pct: 0, prod_imp: 0, prod_acum: 0,
  calidad_doc_pct: 0, calidad_doc_imp: 0, calidad_doc_acum: 0,
  visitas_pct: 0, visitas_imp: 0, visitas_acum: 0,
  retorno_pct: 0, retorno_obj: 0, retorno_imp: 0, retorno_acum: 0,
  herramientas_pct: 0, herramientas_imp: 0, herramientas_acum: 0,
  vehiculo_pct: 0, vehiculo_imp: 0, vehiculo_acum: 0,
  aseo_pct: 0, aseo_imp: 0, aseo_acum: 0,
  horas_obj: 0, horas_inv: 0, horas_dif: 0, horas_pct: 0, penalizacion: 0,
  total: 0,
});

type ResumenForm = ReturnType<typeof initResumen>;
type DetalleForm = ReturnType<typeof initDetalle>;

interface NumInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}
function NumInput({ label, value, onChange, suffix = '' }: NumInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center">
        <input type="number" step="0.01" value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
        {suffix && <span className="ml-1 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  );
}

const KPI_GROUPS = [
  { id: 'prod',         label: 'PRODUCTIVIDAD',        fields: ['prod_pct','prod_imp','prod_acum'],                     retorno: false },
  { id: 'calidad_doc',  label: 'CALIDAD DOC',           fields: ['calidad_doc_pct','calidad_doc_imp','calidad_doc_acum'], retorno: false },
  { id: 'visitas',      label: 'CONTROL VISITAS',       fields: ['visitas_pct','visitas_imp','visitas_acum'],             retorno: false },
  { id: 'retorno',      label: 'RETORNO',               fields: ['retorno_pct','retorno_obj','retorno_imp','retorno_acum'], retorno: true },
  { id: 'herramientas', label: 'HERRAMIENTAS',          fields: ['herramientas_pct','herramientas_imp','herramientas_acum'], retorno: false },
  { id: 'vehiculo',     label: 'VEHÍCULO',              fields: ['vehiculo_pct','vehiculo_imp','vehiculo_acum'],          retorno: false },
  { id: 'aseo',         label: 'ASEO',                  fields: ['aseo_pct','aseo_imp','aseo_acum'],                     retorno: false },
] as const;

const fieldLabel: Record<string, string> = {
  prod_pct: '% Obj',         prod_imp: 'Importe',         prod_acum: 'Acumulado',
  calidad_doc_pct: '% Obj',  calidad_doc_imp: 'Importe',  calidad_doc_acum: 'Acumulado',
  visitas_pct: '% Obj',      visitas_imp: 'Importe',      visitas_acum: 'Acumulado',
  retorno_pct: '% Obj',      retorno_obj: '% P-%R',       retorno_imp: 'Importe',      retorno_acum: 'Acumulado',
  herramientas_pct: '% Obj', herramientas_imp: 'Importe', herramientas_acum: 'Acumulado',
  vehiculo_pct: '% Obj',     vehiculo_imp: 'Importe',     vehiculo_acum: 'Acumulado',
  aseo_pct: '% Obj',         aseo_imp: 'Importe',         aseo_acum: 'Acumulado',
};

function calcTotal(d: DetalleForm): number {
  return +(
    d.prod_imp + d.calidad_doc_imp + d.visitas_imp + d.retorno_imp +
    d.herramientas_imp + d.vehiculo_imp + d.aseo_imp - d.penalizacion
  ).toFixed(2);
}

export default function KPIMensual({ operario }: { operario: string }) {
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [existingResumen, setExistingResumen] = useState<KpiResumen | null>(null);
  const [existingDetalle, setExistingDetalle] = useState<KpiDetalle | null>(null);
  const [resumen, setResumen] = useState<ResumenForm>(initResumen());
  const [detalle, setDetalle] = useState<DetalleForm>(initDetalle());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const mes = now.getMonth() + 1;
    const año = now.getFullYear();
    const [{ data: r }, { data: d }] = await Promise.all([
      supabase.from('kpi_resumen').select('*').eq('agente', operario).eq('mes', mes).eq('año', año).single(),
      supabase.from('kpi_detalle').select('*').eq('agente', operario).eq('mes', mes).eq('año', año).single(),
    ]);
    if (r) { setExistingResumen(r); setResumen({ mes: r.mes, año: r.año, importe: r.importe, acumulado: r.acumulado, a_cobrar: r.a_cobrar, objetivo: r.objetivo, dietas: r.dietas, h_extras: r.h_extras }); }
    if (d) { setExistingDetalle(d); setDetalle({ prod_pct: d.prod_pct, prod_imp: d.prod_imp, prod_acum: d.prod_acum, calidad_doc_pct: d.calidad_doc_pct, calidad_doc_imp: d.calidad_doc_imp, calidad_doc_acum: d.calidad_doc_acum, visitas_pct: d.visitas_pct, visitas_imp: d.visitas_imp, visitas_acum: d.visitas_acum, retorno_pct: d.retorno_pct, retorno_obj: d.retorno_obj, retorno_imp: d.retorno_imp, retorno_acum: d.retorno_acum, herramientas_pct: d.herramientas_pct, herramientas_imp: d.herramientas_imp, herramientas_acum: d.herramientas_acum, vehiculo_pct: d.vehiculo_pct, vehiculo_imp: d.vehiculo_imp, vehiculo_acum: d.vehiculo_acum, aseo_pct: d.aseo_pct, aseo_imp: d.aseo_imp, aseo_acum: d.aseo_acum, horas_obj: d.horas_obj, horas_inv: d.horas_inv, horas_dif: d.horas_dif, horas_pct: d.horas_pct, penalizacion: d.penalizacion, total: d.total }); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [operario]);

  const setR = (k: keyof ResumenForm, v: number | string) => setResumen(f => ({ ...f, [k]: v }));
  const setD = (k: keyof DetalleForm, v: number) => setDetalle(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const total = calcTotal(detalle);
    const resumenPayload = { agente: operario, ...resumen, jefe_id: user.id };
    const detallePayload = { agente: operario, mes: resumen.mes, año: resumen.año, ...detalle, total, jefe_id: user.id };

    if (existingResumen) {
      await supabase.from('kpi_resumen').update(resumenPayload).eq('id', existingResumen.id);
      await supabase.from('kpi_detalle').update(detallePayload).eq('id', existingDetalle!.id);
    } else {
      await supabase.from('kpi_resumen').insert(resumenPayload);
      await supabase.from('kpi_detalle').insert(detallePayload);
    }
    setEditMode(false);
    load();
    setSaving(false);
  };

  const isViewMode = !!(existingResumen && !editMode);
  const total = calcTotal(detalle);

  if (loading) return <div className="text-slate-500 text-center py-8">Cargando KPI...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-700">KPI Mensual — {operario}</h3>
          <p className="text-sm text-slate-500">
            {isViewMode ? `Datos de ${MESES[resumen.mes - 1]} ${resumen.año}` : 'Completa el KPI del mes actual'}
          </p>
        </div>
        {isViewMode && (
          <button onClick={() => setEditMode(true)}
            className="flex items-center gap-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm px-3 py-2 rounded-lg hover:opacity-90">
            <PencilIcon className="h-4 w-4" /> Editar
          </button>
        )}
      </div>

      {/* Sección A — Resumen Incentivos */}
      <div className="bg-white rounded-lg p-4">
        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide border-b pb-2">
          Sección A — Resumen Incentivos
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mes</label>
            {isViewMode ? (
              <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700">{MESES[resumen.mes - 1]}</div>
            ) : (
              <select value={resumen.mes} onChange={e => setR('mes', Number(e.target.value))}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
            {isViewMode ? (
              <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700">{resumen.año}</div>
            ) : (
              <input type="number" value={resumen.año} onChange={e => setR('año', Number(e.target.value))}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>
          {(['importe','a_cobrar','objetivo','dietas','h_extras'] as (keyof ResumenForm)[]).map(k => {
            const labels: Record<string, string> = { importe:'Importe €', a_cobrar:'A Cobrar €', objetivo:'Objetivo €', dietas:'Dietas €', h_extras:'H. Extras' };
            return (
              <div key={k}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{labels[k]}</label>
                {isViewMode ? (
                  <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700">{Number(resumen[k]).toFixed(2)}</div>
                ) : (
                  <input type="number" step="0.01" value={Number(resumen[k])} onChange={e => setR(k, parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-blue-50" />
                )}
              </div>
            );
          })}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Acumulado €</label>
            <div className="bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 cursor-not-allowed">{Number(resumen.acumulado).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Sección B — Detalle KPI */}
      <div className="bg-white rounded-lg p-4">
        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide border-b pb-2">
          Sección B — Detalle KPI
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-600 text-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">CONCEPTO</th>
                <th className="px-3 py-2 text-center">% OBJ</th>
                <th className="px-3 py-2 text-right">IMPORTE</th>
                <th className="px-3 py-2 text-right">ACUMULADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {KPI_GROUPS.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{g.label}</td>
                  {g.retorno ? (
                    <>
                      <td className="px-3 py-2 text-center">
                        {isViewMode ? <span>{detalle.retorno_pct}%</span> : (
                          <div className="flex gap-1">
                            <input type="number" step="0.01" value={detalle.retorno_pct} onChange={e => setD('retorno_pct', parseFloat(e.target.value)||0)}
                              className="w-16 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" placeholder="%" />
                            <input type="number" step="0.01" value={detalle.retorno_obj} onChange={e => setD('retorno_obj', parseFloat(e.target.value)||0)}
                              className="w-16 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" placeholder="P-%R" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isViewMode ? <span>{Number(detalle.retorno_imp).toFixed(2)} €</span> : (
                          <input type="number" step="0.01" value={detalle.retorno_imp} onChange={e => setD('retorno_imp', parseFloat(e.target.value)||0)}
                            className="w-24 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isViewMode ? <span>{Number(detalle.retorno_acum).toFixed(2)} €</span> : (
                          <input type="number" step="0.01" value={detalle.retorno_acum} onChange={e => setD('retorno_acum', parseFloat(e.target.value)||0)}
                            className="w-24 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      {([`${g.id}_pct`, `${g.id}_imp`, `${g.id}_acum`] as (keyof DetalleForm)[]).map((fk, idx) => (
                        <td key={fk} className={`px-3 py-2 ${idx === 0 ? 'text-center' : 'text-right'}`}>
                          {isViewMode ? (
                            <span>{Number(detalle[fk]).toFixed(2)}{idx === 0 ? '%' : ' €'}</span>
                          ) : (
                            <input type="number" step="0.01" value={detalle[fk]} onChange={e => setD(fk, parseFloat(e.target.value)||0)}
                              className="w-24 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                          )}
                        </td>
                      ))}
                    </>
                  )}
                </tr>
              ))}

              {/* Horas Improductivas row */}
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-slate-700">HORAS IMPRODUCTIVAS</td>
                <td className="px-3 py-2 text-center" colSpan={2}>
                  {isViewMode ? (
                    <span className="text-xs">Obj: {detalle.horas_obj}h | Inv: {detalle.horas_inv}h | Dif: {detalle.horas_dif}h | {detalle.horas_pct}%</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {(['horas_obj','horas_inv','horas_dif','horas_pct'] as (keyof DetalleForm)[]).map(fk => (
                        <input key={fk} type="number" step="0.01" value={detalle[fk]} onChange={e => setD(fk, parseFloat(e.target.value)||0)}
                          placeholder={fieldLabel[fk] || fk}
                          className="w-16 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isViewMode ? (
                    <span className="text-red-600">-{Number(detalle.penalizacion).toFixed(2)} €</span>
                  ) : (
                    <input type="number" step="0.01" value={detalle.penalizacion} onChange={e => setD('penalizacion', parseFloat(e.target.value)||0)}
                      className="w-24 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                  )}
                </td>
              </tr>

              {/* Total */}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2 text-slate-800">TOTAL</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-blue-700 text-base">{total.toFixed(2)} €</td>
                <td className="px-3 py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button */}
      {!isViewMode && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-medium disabled:opacity-60">
            {saving ? 'Guardando...' : existingResumen ? 'Actualizar KPI' : 'Guardar KPI'}
          </button>
        </div>
      )}
    </div>
  );
}
