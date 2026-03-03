import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { PlusIcon, Cog6ToothIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES_FULL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const DEFAULT_WIDGETS = [
  { id: 'incidencias', label: 'Incidencias por operario' },
  { id: 'calidad',     label: 'Control de Calidad' },
  { id: 'visitas',     label: 'Visitas' },
  { id: 'horas',       label: 'Horas Improductivas' },
  { id: 'issus',       label: 'ISSUS por tipo' },
  { id: 'limpieza',    label: 'Limpieza' },
];

const TABLAS = [
  { value: 'incidencias',          label: 'Incidencias' },
  { value: 'control_calidad',      label: 'Control Calidad' },
  { value: 'visitas',              label: 'Visitas' },
  { value: 'limpieza',             label: 'Limpieza' },
  { value: 'horas_improductivas',  label: 'Horas Improductivas' },
  { value: 'issus',                label: 'ISSUS' },
];

const CAMPOS_POR_TABLA: Record<string, Array<{ value: string; label: string }>> = {
  incidencias:          [{ value: '*', label: 'Recuento' }, { value: 'puntos', label: 'Suma de puntos' }],
  control_calidad:      [{ value: '*', label: 'Recuento' }, { value: 'total_cq', label: 'Suma importe €' }, { value: 'horas', label: 'Suma horas' }],
  visitas:              [{ value: '*', label: 'Recuento' }],
  limpieza:             [{ value: '*', label: 'Recuento' }],
  horas_improductivas:  [{ value: '*', label: 'Recuento' }, { value: 'consumibles_e', label: 'Suma consumibles €' }],
  issus:                [{ value: '*', label: 'Recuento' }],
};

const PALETTE = [
  { value: 'blue',   bg: 'bg-blue-600',   text: 'text-blue-600',   light: 'bg-blue-50',   bar: 'bg-blue-400'   },
  { value: 'green',  bg: 'bg-green-600',  text: 'text-green-600',  light: 'bg-green-50',  bar: 'bg-green-400'  },
  { value: 'purple', bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50', bar: 'bg-purple-400' },
  { value: 'amber',  bg: 'bg-amber-500',  text: 'text-amber-600',  light: 'bg-amber-50',  bar: 'bg-amber-400'  },
  { value: 'red',    bg: 'bg-red-600',    text: 'text-red-600',    light: 'bg-red-50',    bar: 'bg-red-400'    },
  { value: 'teal',   bg: 'bg-teal-600',   text: 'text-teal-600',   light: 'bg-teal-50',   bar: 'bg-teal-400'   },
];

const ISSUS_COLORS = ['bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-red-500'];

const GROUPBY_POR_TABLA: Record<string, Array<{ value: string; label: string }>> = {
  incidencias:          [{ value: 'operario', label: 'Operario' }],
  control_calidad:      [{ value: 'operario', label: 'Operario' }],
  visitas:              [{ value: 'operario', label: 'Operario' }, { value: 'tipo_visita', label: 'Tipo visita' }, { value: 'ok_visita', label: 'OK/KO' }],
  limpieza:             [{ value: 'operario', label: 'Operario' }],
  horas_improductivas:  [{ value: 'operario', label: 'Operario' }],
  issus:                [{ value: 'tipo', label: 'Tipo' }, { value: 'estado', label: 'Estado' }],
};

const WIDGET_KEY    = 'acm_dashboard_widgets_v1';
const CUSTOM_KPI_KEY = 'acm_dashboard_custom_v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomKpi {
  id: string;
  label: string;
  tabla: string;
  campo: string;
  color: string;
  descripcion?: string;
  vista?: 'tarjeta' | 'widget';
  groupBy?: string;
}

interface Stats {
  incCount: number; incPuntos: number;
  cqCount: number;  cqTotal: number;
  visCount: number; visOk: number;
  issusAb: number;  issusCr: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadJson<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; }
  catch { return fallback; }
}

function saveJson(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateRange(year: number, month: number | null) {
  if (month === null) return { from: `${year}-01-01`, to: `${year}-12-31` };
  const from = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const to   = new Date(year, month, 0).toISOString().split('T')[0];
  return { from, to };
}

function eur(n: number) {
  const abs = Math.abs(n);
  const fmt = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2);
  return `${n < 0 ? '−' : ''}${fmt} €`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const p = PALETTE.find(c => c.value === color) ?? PALETTE[0];
  return (
    <div className={`${p.light} rounded-xl p-4 border border-slate-200 shadow-sm`}>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${p.text}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function WidgetCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-700 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MiniBar({ value, max, color = 'bg-blue-400' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-0.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-400 py-4 text-center">Sin datos en el periodo</p>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPanel({ operariosFilter }: { operariosFilter?: string[] } = {}) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [showManage, setShowManage] = useState(false);

  const [widgetVis, setWidgetVis] = useState<Record<string, boolean>>(() => {
    const stored = loadJson<Record<string, boolean>>(WIDGET_KEY, {});
    const defaults: Record<string, boolean> = {};
    for (const w of DEFAULT_WIDGETS) defaults[w.id] = stored[w.id] ?? true;
    return defaults;
  });

  const [customKpis, setCustomKpis] = useState<CustomKpi[]>(() => loadJson(CUSTOM_KPI_KEY, []));
  const [newKpi, setNewKpi]         = useState<{
    label: string; tabla: string; campo: string; color: string;
    descripcion: string; vista: 'tarjeta' | 'widget'; groupBy: string;
  }>({ label: '', tabla: 'incidencias', campo: '*', color: 'blue', descripcion: '', vista: 'tarjeta', groupBy: 'operario' });

  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState<Stats>({ incCount: 0, incPuntos: 0, cqCount: 0, cqTotal: 0, visCount: 0, visOk: 0, issusAb: 0, issusCr: 0 });

  const [incByOp,   setIncByOp]   = useState<Array<{ operario: string; count: number; puntos: number }>>([]);
  const [cqByOp,    setCqByOp]    = useState<Array<{ operario: string; count: number; total: number }>>([]);
  const [visByOp,   setVisByOp]   = useState<Array<{ operario: string; ok: number; ko: number }>>([]);
  const [horasByOp, setHorasByOp] = useState<Array<{ operario: string; total: number; consumibles: number }>>([]);
  const [issusTipo, setIssusTipo] = useState<Array<{ tipo: string; count: number }>>([]);
  const [limpByOp,  setLimpByOp]  = useState<Array<{ operario: string; count: number }>>([]);
  const [customVals, setCustomVals]         = useState<Record<string, number>>({});
  const [customWidgetData, setCustomWidgetData] = useState<Record<string, Array<{ key: string; value: number }>>>({});

  const { from, to } = dateRange(year, month);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fop = <T,>(q: T): T => (operariosFilter && operariosFilter.length > 0 ? (q as any).in('operario', operariosFilter) : q) as T;
    const [
      { data: inc },
      { data: cq },
      { data: vis },
      { data: hrs },
      { data: iss },
      { data: lim },
    ] = await Promise.all([
      fop(supabase.from('incidencias').select('operario,puntos').gte('fecha', from).lte('fecha', to)),
      fop(supabase.from('control_calidad').select('operario,total_cq').gte('fecha', from).lte('fecha', to)),
      fop(supabase.from('visitas').select('operario,ok_visita').gte('fecha', from).lte('fecha', to)),
      fop(supabase.from('horas_improductivas').select('operario,h_recg_mat,h_reunion,h_mant_furgos,h_mant_instalaciones,h_formacion,consumibles_e').gte('fecha', from).lte('fecha', to)),
      supabase.from('issus').select('tipo,estado').gte('fecha', from).lte('fecha', to),
      fop(supabase.from('limpieza').select('operario').gte('fecha', from).lte('fecha', to)),
    ]);

    const ia = inc || [], ca = cq || [], va = vis || [], ha = hrs || [], isa = iss || [], la = lim || [];

    setStats({
      incCount:  ia.length,
      incPuntos: ia.reduce((s, r) => s + (r.puntos ?? 0), 0),
      cqCount:   ca.length,
      cqTotal:   ca.reduce((s, r) => s + (r.total_cq ?? 0), 0),
      visCount:  va.length,
      visOk:     va.filter(r => r.ok_visita === 'OK').length,
      issusAb:   isa.filter(r => (r.estado ?? 'ABIERTA') === 'ABIERTA').length,
      issusCr:   isa.filter(r => r.estado === 'CERRADA').length,
    });

    // ── Incidencias by op ──
    const iAcc: Record<string, { count: number; puntos: number }> = {};
    for (const r of ia) {
      if (!iAcc[r.operario]) iAcc[r.operario] = { count: 0, puntos: 0 };
      iAcc[r.operario].count++;
      iAcc[r.operario].puntos += r.puntos ?? 0;
    }
    setIncByOp(Object.entries(iAcc).map(([operario, v]) => ({ operario, ...v })).sort((a, b) => b.count - a.count));

    // ── CQ by op ──
    const cAcc: Record<string, { count: number; total: number }> = {};
    for (const r of ca) {
      if (!cAcc[r.operario]) cAcc[r.operario] = { count: 0, total: 0 };
      cAcc[r.operario].count++;
      cAcc[r.operario].total += r.total_cq ?? 0;
    }
    setCqByOp(Object.entries(cAcc).map(([operario, v]) => ({ operario, ...v })).sort((a, b) => b.total - a.total));

    // ── Visitas by op ──
    const vAcc: Record<string, { ok: number; ko: number }> = {};
    for (const r of va) {
      if (!vAcc[r.operario]) vAcc[r.operario] = { ok: 0, ko: 0 };
      if (r.ok_visita === 'OK') vAcc[r.operario].ok++; else vAcc[r.operario].ko++;
    }
    setVisByOp(Object.entries(vAcc).map(([operario, v]) => ({ operario, ...v })));

    // ── Horas by op ──
    const hAcc: Record<string, { total: number; consumibles: number }> = {};
    for (const r of ha) {
      if (!hAcc[r.operario]) hAcc[r.operario] = { total: 0, consumibles: 0 };
      hAcc[r.operario].total      += Number(r.h_recg_mat) + Number(r.h_reunion) + Number(r.h_mant_furgos) + Number(r.h_mant_instalaciones) + Number(r.h_formacion);
      hAcc[r.operario].consumibles += Number(r.consumibles_e ?? 0);
    }
    setHorasByOp(Object.entries(hAcc).map(([operario, v]) => ({ operario, ...v })).sort((a, b) => b.total - a.total));

    // ── ISSUS by tipo ──
    const tiAcc: Record<string, number> = {};
    for (const r of isa) tiAcc[r.tipo] = (tiAcc[r.tipo] || 0) + 1;
    setIssusTipo(Object.entries(tiAcc).map(([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count));

    // ── Limpieza by op ──
    const lAcc: Record<string, number> = {};
    for (const r of la) lAcc[r.operario] = (lAcc[r.operario] || 0) + 1;
    setLimpByOp(Object.entries(lAcc).map(([operario, count]) => ({ operario, count })).sort((a, b) => b.count - a.count));

    // ── Custom KPIs ──
    const cVals: Record<string, number> = {};
    const cWidgets: Record<string, Array<{ key: string; value: number }>> = {};
    for (const kpi of customKpis) {
      if (kpi.vista === 'widget' && kpi.groupBy) {
        // Widget: fetch grouped breakdown
        const selectFields = kpi.campo === '*' ? kpi.groupBy : `${kpi.groupBy},${kpi.campo}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: kd } = await (supabase.from(kpi.tabla) as any)
          .select(selectFields)
          .gte('fecha', from).lte('fecha', to);
        if (!kd) { cWidgets[kpi.id] = []; cVals[kpi.id] = 0; continue; }
        const acc: Record<string, number> = {};
        for (const row of kd as Record<string, unknown>[]) {
          const grpKey = String(row[kpi.groupBy] ?? '—');
          if (!acc[grpKey]) acc[grpKey] = 0;
          if (kpi.campo === '*') { acc[grpKey]++; }
          else { acc[grpKey] += Number(row[kpi.campo]) || 0; }
        }
        cWidgets[kpi.id] = Object.entries(acc).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
        cVals[kpi.id] = (kd as unknown[]).length;
      } else {
        // Stat card: simple count/sum
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: kd } = await (supabase.from(kpi.tabla) as any)
          .select(kpi.campo === '*' ? 'id' : kpi.campo)
          .gte('fecha', from).lte('fecha', to);
        if (!kd) { cVals[kpi.id] = 0; continue; }
        cVals[kpi.id] = kpi.campo === '*'
          ? (kd as unknown[]).length
          : (kd as Record<string, number>[]).reduce((s, r) => s + (Number(r[kpi.campo]) || 0), 0);
      }
    }
    setCustomVals(cVals);
    setCustomWidgetData(cWidgets);

    setLoading(false);
  }, [from, to, customKpis, operariosFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const toggleWidget = (id: string) => {
    setWidgetVis(v => {
      const next = { ...v, [id]: !v[id] };
      saveJson(WIDGET_KEY, next);
      return next;
    });
  };

  const addCustomKpi = () => {
    if (!newKpi.label.trim()) return;
    const kpi: CustomKpi = {
      id: `ckpi_${Date.now()}`,
      label: newKpi.label,
      tabla: newKpi.tabla,
      campo: newKpi.campo,
      color: newKpi.color,
      descripcion: newKpi.descripcion || undefined,
      vista: newKpi.vista,
      groupBy: newKpi.vista === 'widget' ? newKpi.groupBy : undefined,
    };
    const updated = [...customKpis, kpi];
    setCustomKpis(updated);
    saveJson(CUSTOM_KPI_KEY, updated);
    setNewKpi({ label: '', tabla: 'incidencias', campo: '*', color: 'blue', descripcion: '', vista: 'tarjeta', groupBy: 'operario' });
  };

  const deleteCustomKpi = (id: string) => {
    const updated = customKpis.filter(k => k.id !== id);
    setCustomKpis(updated);
    saveJson(CUSTOM_KPI_KEY, updated);
  };

  const maxInc   = Math.max(...incByOp.map(r => r.count), 1);
  const maxCq    = Math.max(...cqByOp.map(r => r.total), 1);
  const maxHoras = Math.max(...horasByOp.map(r => r.total), 1);
  const issusTot = issusTipo.reduce((s, r) => s + r.count, 0);

  const periodLabel = month === null
    ? `Año ${year}`
    : `${MESES_FULL[month - 1]} ${year}`;

  return (
    <div className="space-y-5">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm text-sm">
          <button onClick={() => setYear(y => y - 1)} className="px-1 text-slate-400 hover:text-blue-600 font-bold">‹</button>
          <span className="font-bold text-slate-800 w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-1 text-slate-400 hover:text-blue-600 font-bold">›</button>
        </div>
        <select
          value={month ?? 'all'}
          onChange={e => setMonth(e.target.value === 'all' ? null : Number(e.target.value))}
          className="bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Año completo</option>
          {MESES_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <span className="text-xs text-slate-400 italic">{periodLabel}</span>
        <button
          onClick={() => setShowManage(v => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showManage ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-800'}`}
        >
          <Cog6ToothIcon className="h-4 w-4" />
          Gestionar dashboard
        </button>
      </div>

      {/* ── Manage panel ── */}
      {showManage && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Configuración del dashboard</h3>
            <button onClick={() => setShowManage(false)} className="p-1 rounded hover:bg-slate-100">
              <XMarkIcon className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          {/* Default widget toggles */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Widgets predefinidos</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEFAULT_WIDGETS.map(w => (
                <label key={w.id} className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={widgetVis[w.id] ?? true}
                    onChange={() => toggleWidget(w.id)}
                    className="rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{w.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom KPIs list */}
          {customKpis.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">KPIs personalizados</p>
              <div className="space-y-1.5">
                {customKpis.map(k => {
                  const p = PALETTE.find(c => c.value === k.color) ?? PALETTE[0];
                  return (
                    <div key={k.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${p.bg}`} />
                      <span className="text-sm font-medium text-slate-700 flex-1">{k.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${k.vista === 'widget' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-500'}`}>
                        {k.vista === 'widget' ? 'widget' : 'tarjeta'}
                      </span>
                      <span className="text-xs text-slate-400">{TABLAS.find(t => t.value === k.tabla)?.label}</span>
                      <button onClick={() => deleteCustomKpi(k.id)} className="p-1 rounded hover:bg-red-50 ml-1">
                        <TrashIcon className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New custom KPI form */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Nuevo KPI personalizado</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Nombre */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre *</label>
                <input
                  value={newKpi.label}
                  onChange={e => setNewKpi(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Total incidencias graves"
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Descripción / subtítulo</label>
                <input
                  value={newKpi.descripcion}
                  onChange={e => setNewKpi(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Periodo seleccionado"
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Fuente de datos */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fuente de datos</label>
                <select
                  value={newKpi.tabla}
                  onChange={e => {
                    const t = e.target.value;
                    const firstGb = GROUPBY_POR_TABLA[t]?.[0]?.value ?? 'operario';
                    setNewKpi(f => ({ ...f, tabla: t, campo: '*', groupBy: firstGb }));
                  }}
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TABLAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Métrica */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Métrica</label>
                <select
                  value={newKpi.campo}
                  onChange={e => setNewKpi(f => ({ ...f, campo: e.target.value }))}
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(CAMPOS_POR_TABLA[newKpi.tabla] || []).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de vista */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tipo de vista</label>
                <div className="flex gap-2">
                  {(['tarjeta', 'widget'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewKpi(f => ({ ...f, vista: v }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${newKpi.vista === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                    >
                      {v === 'tarjeta' ? '🎴 Tarjeta' : '📊 Widget'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {newKpi.vista === 'tarjeta' ? 'Muestra un número total en la fila superior' : 'Muestra un bloque con desglose por grupo'}
                </p>
              </div>

              {/* Agrupar por (solo widget) */}
              {newKpi.vista === 'widget' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Agrupar por</label>
                  <select
                    value={newKpi.groupBy}
                    onChange={e => setNewKpi(f => ({ ...f, groupBy: e.target.value }))}
                    className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(GROUPBY_POR_TABLA[newKpi.tabla] || []).map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Color */}
              <div className={newKpi.vista === 'widget' ? '' : 'sm:col-span-1'}>
                <label className="block text-xs text-slate-500 mb-1">Color</label>
                <div className="flex gap-2 mt-2">
                  {PALETTE.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewKpi(f => ({ ...f, color: c.value }))}
                      className={`w-6 h-6 rounded-full ${c.bg} transition-all ring-offset-1 ${newKpi.color === c.value ? 'ring-2 ring-slate-600 scale-110' : 'ring-0'}`}
                    />
                  ))}
                </div>
              </div>

            </div>
            <button
              onClick={addCustomKpi}
              disabled={!newKpi.label.trim()}
              className="mt-3 flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <PlusIcon className="h-4 w-4" /> Añadir KPI
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="py-10 text-center text-slate-400 text-sm">Cargando datos...</div>
      )}

      {/* ── Content ── */}
      {!loading && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Incidencias"
              value={stats.incCount}
              sub={`${stats.incPuntos} puntos acumulados`}
              color="red"
            />
            <StatCard
              label="Registros CQ"
              value={stats.cqCount}
              sub={stats.cqTotal > 0 ? eur(stats.cqTotal) : 'Sin coste registrado'}
              color="amber"
            />
            <StatCard
              label="Visitas OK"
              value={stats.visCount > 0 ? `${Math.round((stats.visOk / stats.visCount) * 100)}%` : '—'}
              sub={`${stats.visOk} OK de ${stats.visCount} totales`}
              color="green"
            />
            <StatCard
              label="ISSUS Abiertas"
              value={stats.issusAb}
              sub={`${stats.issusCr} cerradas`}
              color="purple"
            />
          </div>

          {/* Custom KPI tarjeta cards */}
          {customKpis.some(k => k.vista !== 'widget') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {customKpis.filter(k => k.vista !== 'widget').map(k => {
                const raw = customVals[k.id] ?? 0;
                const display = k.campo === '*' ? raw : (Number.isInteger(raw) ? raw : raw.toFixed(2));
                return (
                  <StatCard
                    key={k.id}
                    label={k.label}
                    value={display}
                    sub={k.descripcion || TABLAS.find(t => t.value === k.tabla)?.label}
                    color={k.color}
                  />
                );
              })}
            </div>
          )}

          {/* Widget grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {widgetVis.incidencias && (
              <WidgetCard title="Incidencias por operario">
                {incByOp.length === 0 ? <Empty /> : (
                  <div className="space-y-2.5">
                    {incByOp.map(r => (
                      <div key={r.operario}>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 truncate max-w-[55%]">{r.operario}</span>
                          <span className="text-slate-500">
                            {r.count} reg · <span className="text-red-600 font-semibold">{r.puntos} pts</span>
                          </span>
                        </div>
                        <MiniBar value={r.count} max={maxInc} color="bg-red-400" />
                      </div>
                    ))}
                  </div>
                )}
              </WidgetCard>
            )}

            {widgetVis.calidad && (
              <WidgetCard title="Control de calidad">
                {cqByOp.length === 0 ? <Empty /> : (
                  <div className="space-y-2.5">
                    {cqByOp.map(r => (
                      <div key={r.operario}>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 truncate max-w-[55%]">{r.operario}</span>
                          <span className="text-slate-500">
                            {r.count} reg · <span className="text-amber-700 font-semibold">{eur(r.total)}</span>
                          </span>
                        </div>
                        <MiniBar value={r.total} max={maxCq} color="bg-amber-400" />
                      </div>
                    ))}
                  </div>
                )}
              </WidgetCard>
            )}

            {widgetVis.visitas && (
              <WidgetCard title="Visitas por operario">
                {visByOp.length === 0 ? <Empty /> : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Operario</th>
                        <th className="text-center pb-2 font-medium text-green-600">OK</th>
                        <th className="text-center pb-2 font-medium text-red-500">KO</th>
                        <th className="text-right pb-2 font-medium">% OK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {visByOp.map(r => {
                        const total = r.ok + r.ko;
                        const pct = total > 0 ? Math.round((r.ok / total) * 100) : 0;
                        return (
                          <tr key={r.operario}>
                            <td className="py-1.5 font-medium text-slate-700 truncate max-w-[120px]">{r.operario}</td>
                            <td className="py-1.5 text-center text-green-700 font-semibold">{r.ok}</td>
                            <td className="py-1.5 text-center text-red-500 font-semibold">{r.ko}</td>
                            <td className="py-1.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded-full font-bold ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </WidgetCard>
            )}

            {widgetVis.horas && (
              <WidgetCard title="Horas improductivas">
                {horasByOp.length === 0 ? <Empty /> : (
                  <div className="space-y-2.5">
                    {horasByOp.map(r => (
                      <div key={r.operario}>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 truncate max-w-[55%]">{r.operario}</span>
                          <span className="text-slate-500">
                            {r.total.toFixed(1)} h · <span className="text-slate-700">{eur(r.consumibles)}</span>
                          </span>
                        </div>
                        <MiniBar value={r.total} max={maxHoras} color="bg-purple-400" />
                      </div>
                    ))}
                  </div>
                )}
              </WidgetCard>
            )}

            {widgetVis.issus && (
              <WidgetCard title={`ISSUS · ${stats.issusAb} abiertas · ${stats.issusCr} cerradas`}>
                {issusTipo.length === 0 ? <Empty /> : (
                  <div className="space-y-2">
                    {issusTipo.map((r, i) => (
                      <div key={r.tipo} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ISSUS_COLORS[i % 4]}`} />
                        <span className="text-xs text-slate-700 flex-1 font-medium">{r.tipo}</span>
                        <span className="text-xs font-bold text-slate-700">{r.count}</span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div
                            className={`${ISSUS_COLORS[i % 4]} h-1.5 rounded-full`}
                            style={{ width: `${Math.round((r.count / issusTot) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">
                          {Math.round((r.count / issusTot) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </WidgetCard>
            )}

            {widgetVis.limpieza && (
              <WidgetCard title="Registros de limpieza">
                {limpByOp.length === 0 ? <Empty /> : (
                  <div className="space-y-1.5">
                    {limpByOp.map(r => (
                      <div key={r.operario} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-xs font-medium text-slate-700">{r.operario}</span>
                        <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                          {r.count} reg.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </WidgetCard>
            )}

            {/* Custom widget KPIs */}
            {customKpis.filter(k => k.vista === 'widget').map(k => {
              const rows = customWidgetData[k.id] ?? [];
              const maxVal = Math.max(...rows.map(r => r.value), 1);
              const p = PALETTE.find(c => c.value === k.color) ?? PALETTE[0];
              const campoLabel = CAMPOS_POR_TABLA[k.tabla]?.find(c => c.value === k.campo)?.label ?? 'Recuento';
              const gbLabel = GROUPBY_POR_TABLA[k.tabla]?.find(g => g.value === k.groupBy)?.label ?? k.groupBy;
              const title = `${k.label}${k.descripcion ? ` · ${k.descripcion}` : ''} — por ${gbLabel}`;
              return (
                <WidgetCard key={k.id} title={title}>
                  {rows.length === 0 ? <Empty /> : (
                    <div className="space-y-2.5">
                      {rows.map(r => (
                        <div key={r.key}>
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-700 truncate max-w-[60%]">{r.key}</span>
                            <span className={`font-semibold ${p.text}`}>
                              {Number.isInteger(r.value) ? r.value : r.value.toFixed(2)} {campoLabel !== 'Recuento' ? '' : ''}
                            </span>
                          </div>
                          <MiniBar value={r.value} max={maxVal} color={p.bar} />
                        </div>
                      ))}
                    </div>
                  )}
                </WidgetCard>
              );
            })}

          </div>
        </>
      )}
    </div>
  );
}
