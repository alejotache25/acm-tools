import { useState, useEffect, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

// ─── Types (mirrored from KPIMensual) ─────────────────────────────────────────

interface MonthData {
  empty?:       boolean;
  prod_pct:     number;
  ctrl_doc_pts: number;
  ctrl_vis_pct: number;
  retorno_pct:  number;
  herr_pct:     number;
  vehic_pct:    number;
  aseo_pct:     number;
  h_obj:        number;
  h_inv:        number;
  objetivo:     number;
  dietas:       number;
  h_ext:        number;
}

type YearData = Record<number, MonthData>;

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PENALTY_RATE = 39;

const DEFAULT_MONTH: MonthData = {
  prod_pct: 100, ctrl_doc_pts: 1, ctrl_vis_pct: 100, retorno_pct: 0,
  herr_pct: 100, vehic_pct: 100, aseo_pct: 100,
  h_obj: 1.5, h_inv: 0, objetivo: 250, dietas: 0, h_ext: 0,
};

// ─── Supabase row → MonthData ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToMonthData(row: any): MonthData {
  return {
    prod_pct:     Number(row.prod_pct),
    ctrl_doc_pts: Number(row.ctrl_doc_pts),
    ctrl_vis_pct: Number(row.ctrl_vis_pct),
    retorno_pct:  Number(row.retorno_pct),
    herr_pct:     Number(row.herr_pct),
    vehic_pct:    Number(row.vehic_pct),
    aseo_pct:     Number(row.aseo_pct),
    h_obj:        Number(row.h_obj),
    h_inv:        Number(row.h_inv),
    objetivo:     Number(row.objetivo),
    dietas:       Number(row.dietas),
    h_ext:        Number(row.h_ext),
    empty:        Boolean(row.is_empty),
  };
}

function getMonthData(data: YearData, mes: number): MonthData {
  return data[mes] ?? { ...DEFAULT_MONTH };
}

// ─── Lookup functions (exact replica of KPIMensual) ───────────────────────────

function lookupProd(pct: number): number {
  if (pct >= 100) return 100;
  if (pct >= 95)  return 75;
  if (pct >= 90)  return 50;
  if (pct >= 80)  return 25;
  return 0;
}
function lookupCtrlDoc(pts: number): number {
  if (pts >= 80) return 0;
  if (pts >= 70) return 25;
  if (pts >= 60) return 50;
  if (pts >= 50) return 75;
  if (pts >= 1)  return 100;
  return -25;
}
function lookupVis(pct: number):   number { return pct >= 100 ? 25 : -25; }
function lookupHerr(pct: number):  number { return pct >= 100 ? 5 : 0; }
function lookupVehic(pct: number): number { return pct >= 100 ? 10 : 0; }
function lookupAseo(pct: number):  number { return pct >= 100 ? 10 : 0; }

// ─── Month calculation ────────────────────────────────────────────────────────

interface MonthResult {
  imp_prod: number; imp_ctrl_doc: number; imp_ctrl_vis: number;
  imp_ret: number;  imp_herr: number;     imp_vehic: number;
  imp_aseo: number; penalizacion: number; total: number;
  h_dif: number;
}

function calcMonth(md: MonthData): MonthResult {
  const imp_prod     = lookupProd(md.prod_pct);
  const imp_ctrl_doc = lookupCtrlDoc(md.ctrl_doc_pts);
  const imp_ctrl_vis = lookupVis(md.ctrl_vis_pct);
  const net_pct      = md.prod_pct - md.retorno_pct;
  const imp_ret      = lookupProd(net_pct);
  const imp_herr     = lookupHerr(md.herr_pct);
  const imp_vehic    = lookupVehic(md.vehic_pct);
  const imp_aseo     = lookupAseo(md.aseo_pct);
  const h_dif        = md.h_inv - md.h_obj;
  const penalizacion = +(Math.max(h_dif, 0) * PENALTY_RATE).toFixed(2);
  const total        = +(imp_ctrl_doc + imp_ctrl_vis + imp_ret + imp_herr + imp_vehic + imp_aseo - penalizacion).toFixed(2);
  return { imp_prod, imp_ctrl_doc, imp_ctrl_vis, imp_ret, imp_herr, imp_vehic, imp_aseo, penalizacion, total, h_dif };
}

// ─── Annual summary for one operario ─────────────────────────────────────────

interface OperarioSummary {
  nombre: string;
  kpiRef: number;
  months: Array<{ mes: number; md: MonthData } & MonthResult>;
  acc_prod: number; acc_ctrl_doc: number; acc_ctrl_vis: number;
  acc_ret: number;  acc_herr: number;     acc_vehic: number;
  acc_aseo: number; acc_total: number;
  total_cobrar: number; total_objetivo: number; pct_objetivo: number | null;
}

export function buildSummary(nombre: string, yearData: YearData, kpiRef: number): OperarioSummary {

  let acc_prod = 0, acc_ctrl_doc = 0, acc_ctrl_vis = 0, acc_ret = 0;
  let acc_herr = 0, acc_vehic = 0,   acc_aseo = 0,      acc_total = 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const md  = getMonthData(yearData, mes);
    const r   = calcMonth(md);
    acc_prod     += r.imp_prod;
    acc_ctrl_doc += r.imp_ctrl_doc;
    acc_ctrl_vis += r.imp_ctrl_vis;
    acc_ret      += r.imp_ret;
    acc_herr     += r.imp_herr;
    acc_vehic    += r.imp_vehic;
    acc_aseo     += r.imp_aseo;
    acc_total    += r.total;
    return { mes, md, ...r };
  });

  let total_cobrar = 0, total_objetivo = 0, totalp_obj = 0;
  for (const m of months) {
    const cobrar = Math.max(m.total - kpiRef, 0);
    total_cobrar   += cobrar;
    total_objetivo += m.md.objetivo;
    if (m.total > 0) totalp_obj += m.md.objetivo;
  }

  const pct_objetivo = totalp_obj > 0 ? (total_cobrar / totalp_obj) * 100 : null;

  return {
    nombre, kpiRef, months,
    acc_prod, acc_ctrl_doc, acc_ctrl_vis, acc_ret,
    acc_herr, acc_vehic, acc_aseo, acc_total,
    total_cobrar, total_objetivo, pct_objetivo,
  };
}

// ─── Named exports for reuse ──────────────────────────────────────────────────
export { calcMonth, MESES, MESES_FULL, PENALTY_RATE, DEFAULT_MONTH };
export type { MonthData, YearData, MonthResult, OperarioSummary };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euro(n: number) {
  const abs = Math.abs(n);
  const fmt = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2);
  return `${n < 0 ? '−' : ''}${fmt} €`;
}

function clr(n: number) {
  if (n > 0) return 'text-green-700 font-semibold';
  if (n < 0) return 'text-red-600 font-semibold';
  return 'text-slate-400';
}

function pctColor(pct: number | null) {
  if (pct === null) return 'text-slate-400';
  if (pct >= 100) return 'text-green-700 font-bold';
  if (pct >= 80)  return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KPIDashboard({ operariosFilter }: { operariosFilter?: string[] } = {}) {
  const now = new Date();
  const [año, setAño] = useState(now.getFullYear());
  const [mode, setMode] = useState<'anual' | 'mensual'>('anual');
  const [mes, setMes]   = useState(now.getMonth() + 1);
  const [operarios, setOperarios] = useState<string[]>([]);
  const [loadingOp, setLoadingOp] = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  // KPI data from Supabase
  const [yearDataMap, setYearDataMap] = useState<Record<string, YearData>>({});
  const [kpiRefsMap, setKpiRefsMap]   = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (operariosFilter) {
      setOperarios(operariosFilter);
      setLoadingOp(false);
    } else {
      supabase.from('operarios').select('nombre').eq('activo', true).order('nombre').then(({ data }) => {
        setOperarios((data || []).map(r => r.nombre));
        setLoadingOp(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(operariosFilter)]);

  // Load KPI data from Supabase when operarios or año changes
  useEffect(() => {
    if (operarios.length === 0) { setYearDataMap({}); setKpiRefsMap({}); return; }
    setLoadingData(true);
    Promise.all([
      supabase.from('kpi_mensual').select('*').eq('año', año).in('operario', operarios),
      supabase.from('kpi_ref').select('operario, valor').eq('año', año).in('operario', operarios),
    ]).then(([{ data: rows }, { data: refs }]) => {
      const newMap: Record<string, YearData> = {};
      for (const row of rows || []) {
        if (!newMap[row.operario]) newMap[row.operario] = {};
        newMap[row.operario][row.mes] = rowToMonthData(row);
      }
      setYearDataMap(newMap);
      const newRefs: Record<string, number> = {};
      for (const r of refs || []) newRefs[r.operario] = Number(r.valor);
      setKpiRefsMap(newRefs);
      setLoadingData(false);
    });
  }, [operarios, año]);

  // Build all summaries from Supabase data
  const summaries = useMemo(
    () => operarios.map(n => buildSummary(n, yearDataMap[n] || {}, kpiRefsMap[n] || 0)),
    [operarios, yearDataMap, kpiRefsMap],
  );

  // For monthly view: compute each operario's single-month result
  const monthlyRows = useMemo(() => {
    return summaries.map(s => {
      const m = s.months[mes - 1];
      return { nombre: s.nombre, kpiRef: s.kpiRef, ...m };
    });
  }, [summaries, mes]);

  if (loadingOp) {
    return <div className="py-10 text-center text-slate-400 text-sm">Cargando operarios...</div>;
  }

  const thBase = 'px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap border border-slate-500';
  const td     = 'px-2 py-1.5 text-center text-xs whitespace-nowrap border border-slate-200';

  return (
    <div className="space-y-4">

      {/* ── Header + Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Year */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm text-sm">
          <button onClick={() => setAño(y => y - 1)}>
            <ChevronLeftIcon className="h-4 w-4 text-slate-400 hover:text-blue-600" />
          </button>
          <span className="font-bold text-slate-800 w-12 text-center">{año}</span>
          <button onClick={() => setAño(y => y + 1)}>
            <ChevronRightIcon className="h-4 w-4 text-slate-400 hover:text-blue-600" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-200 shadow-sm text-sm">
          <button
            onClick={() => setMode('anual')}
            className={`px-4 py-1.5 font-medium transition-colors ${mode === 'anual' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Vista anual
          </button>
          <button
            onClick={() => setMode('mensual')}
            className={`px-4 py-1.5 font-medium transition-colors ${mode === 'mensual' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Vista mensual
          </button>
        </div>

        {/* Month selector (only in monthly mode) */}
        {mode === 'mensual' && (
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MESES_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}

        <span className="text-xs text-slate-400 italic ml-auto">
          {operarios.length} operario{operarios.length !== 1 ? 's' : ''}
          {loadingData && ' · cargando...'}
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ANNUAL VIEW
         ══════════════════════════════════════════════════════════ */}
      {mode === 'anual' && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(() => {
              const totalAnual  = summaries.reduce((s, r) => s + r.acc_total, 0);
              const totalCobrar = summaries.reduce((s, r) => s + r.total_cobrar, 0);
              const avgPct      = summaries.filter(r => r.pct_objetivo !== null);
              const avgObj      = avgPct.length > 0 ? avgPct.reduce((s, r) => s + (r.pct_objetivo ?? 0), 0) / avgPct.length : null;
              const topOp       = summaries.slice().sort((a, b) => b.acc_total - a.acc_total)[0];
              return (
                <>
                  <div className="bg-blue-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Total equipo</p>
                    <p className={`text-xl font-bold ${clr(totalAnual)}`}>{euro(totalAnual)}</p>
                    <p className="text-xs text-slate-400 mt-1">suma KPI anual</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">A cobrar equipo</p>
                    <p className="text-xl font-bold text-emerald-700">{totalCobrar > 0 ? euro(totalCobrar) : '—'}</p>
                    <p className="text-xs text-slate-400 mt-1">sobre umbral KPI ref.</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">% Obj. medio</p>
                    <p className={`text-xl font-bold ${pctColor(avgObj)}`}>
                      {avgObj !== null ? `${avgObj.toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">promedio del equipo</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Top operario</p>
                    <p className="text-base font-bold text-purple-700 truncate">{topOp?.nombre ?? '—'}</p>
                    <p className="text-xs text-slate-400 mt-1">{topOp ? euro(topOp.acc_total) : ''}</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Annual comparison table */}
          <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
            <table className="min-w-max border-collapse text-xs">
              <thead className="text-white">
                <tr>
                  <th rowSpan={2} className={`${thBase} bg-slate-700 text-left min-w-[140px] px-3`}>Operario</th>
                  <th colSpan={7} className={`${thBase} bg-blue-800`}>Acumulado anual por categoría</th>
                  <th rowSpan={2} className={`${thBase} bg-slate-600 min-w-[80px]`}>Total anual</th>
                  <th rowSpan={2} className={`${thBase} bg-emerald-700 min-w-[80px]`}>A cobrar</th>
                  <th rowSpan={2} className={`${thBase} bg-emerald-600 min-w-[70px]`}>% Obj.</th>
                </tr>
                <tr>
                  <th className={`${thBase} bg-blue-700 min-w-[68px]`}>Prod.</th>
                  <th className={`${thBase} bg-blue-700 min-w-[68px]`}>Ctrl.Doc</th>
                  <th className={`${thBase} bg-blue-700 min-w-[68px]`}>Visitas</th>
                  <th className={`${thBase} bg-blue-700 min-w-[68px]`}>Retorno</th>
                  <th className={`${thBase} bg-blue-700 min-w-[56px]`}>Herr.</th>
                  <th className={`${thBase} bg-blue-700 min-w-[56px]`}>Vehic.</th>
                  <th className={`${thBase} bg-blue-700 min-w-[56px]`}>Aseo</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(s => {
                  const cobrar = s.total_cobrar;
                  const isExp  = expanded === s.nombre;
                  return (
                    <>
                      <tr
                        key={s.nombre}
                        className="bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpanded(isExp ? null : s.nombre)}
                      >
                        <td className="px-3 py-2 border border-slate-200 font-semibold text-slate-800 text-xs">
                          <span className="flex items-center gap-1">
                            <span className={`text-slate-400 transition-transform text-[10px] ${isExp ? 'rotate-90' : ''}`}>▶</span>
                            {s.nombre}
                          </span>
                        </td>
                        <td className={`${td} ${clr(s.acc_prod)}`}>{euro(s.acc_prod)}</td>
                        <td className={`${td} ${clr(s.acc_ctrl_doc)}`}>{euro(s.acc_ctrl_doc)}</td>
                        <td className={`${td} ${clr(s.acc_ctrl_vis)}`}>{euro(s.acc_ctrl_vis)}</td>
                        <td className={`${td} ${clr(s.acc_ret)}`}>{euro(s.acc_ret)}</td>
                        <td className={`${td} ${clr(s.acc_herr)}`}>{euro(s.acc_herr)}</td>
                        <td className={`${td} ${clr(s.acc_vehic)}`}>{euro(s.acc_vehic)}</td>
                        <td className={`${td} ${clr(s.acc_aseo)}`}>{euro(s.acc_aseo)}</td>
                        <td className={`${td} text-sm font-bold ${clr(s.acc_total)}`}>{euro(s.acc_total)}</td>
                        <td className={`${td} font-semibold ${cobrar > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {cobrar > 0 ? euro(cobrar) : '—'}
                        </td>
                        <td className={`${td} text-sm ${pctColor(s.pct_objetivo)}`}>
                          {s.pct_objetivo !== null ? `${s.pct_objetivo.toFixed(1)}%` : '—'}
                        </td>
                      </tr>

                      {/* Expanded monthly breakdown */}
                      {isExp && (
                        <tr key={`${s.nombre}-exp`}>
                          <td colSpan={11} className="px-0 py-0 border border-slate-200 bg-slate-50">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-200 text-slate-600">
                                  <th className="px-3 py-1.5 text-left font-medium">Mes</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Prod.</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Ctrl.Doc</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Visitas</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Retorno</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Herr.</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Vehic.</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Aseo</th>
                                  <th className="px-2 py-1.5 text-center font-medium">Penaliz.</th>
                                  <th className="px-2 py-1.5 text-center font-semibold text-slate-800">Total</th>
                                  <th className="px-2 py-1.5 text-center font-semibold text-emerald-700">A cobrar</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.months.map((m, i) => {
                                  const cobrarM = Math.max(m.total - s.kpiRef, 0);
                                  const isCurrentMonth = año === now.getFullYear() && m.mes === now.getMonth() + 1;
                                  return (
                                    <tr key={m.mes} className={isCurrentMonth ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                      <td className={`px-3 py-1.5 font-medium ${isCurrentMonth ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                                        {MESES[i]}
                                        {isCurrentMonth && <span className="ml-1 text-blue-400 text-[9px]">◀</span>}
                                      </td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_prod)}`}>{euro(m.imp_prod)}</td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_ctrl_doc)}`}>{euro(m.imp_ctrl_doc)}</td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_ctrl_vis)}`}>{euro(m.imp_ctrl_vis)}</td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_ret)}`}>{euro(m.imp_ret)}</td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_herr)}`}>{euro(m.imp_herr)}</td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_vehic)}`}>{euro(m.imp_vehic)}</td>
                                      <td className={`px-2 py-1.5 text-center ${clr(m.imp_aseo)}`}>{euro(m.imp_aseo)}</td>
                                      <td className={`px-2 py-1.5 text-center ${m.penalizacion > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                                        {m.penalizacion > 0 ? `−${m.penalizacion.toFixed(0)} €` : '—'}
                                      </td>
                                      <td className={`px-2 py-1.5 text-center font-bold ${clr(m.total)}`}>{euro(m.total)}</td>
                                      <td className={`px-2 py-1.5 text-center font-semibold ${cobrarM > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                        {cobrarM > 0 ? euro(cobrarM) : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Totals row */}
                                <tr className="bg-slate-700 text-white font-bold">
                                  <td className="px-3 py-2">TOTAL</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_prod)}</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_ctrl_doc)}</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_ctrl_vis)}</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_ret)}</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_herr)}</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_vehic)}</td>
                                  <td className="px-2 py-2 text-center">{euro(s.acc_aseo)}</td>
                                  <td className="px-2 py-2 text-center" />
                                  <td className={`px-2 py-2 text-center text-sm ${s.acc_total >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(s.acc_total)}</td>
                                  <td className={`px-2 py-2 text-center ${s.total_cobrar > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                                    {s.total_cobrar > 0 ? euro(s.total_cobrar) : '—'}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {/* Team totals row */}
                {summaries.length > 0 && (() => {
                  const T = summaries.reduce((acc, s) => ({
                    acc_prod:     acc.acc_prod     + s.acc_prod,
                    acc_ctrl_doc: acc.acc_ctrl_doc + s.acc_ctrl_doc,
                    acc_ctrl_vis: acc.acc_ctrl_vis + s.acc_ctrl_vis,
                    acc_ret:      acc.acc_ret      + s.acc_ret,
                    acc_herr:     acc.acc_herr     + s.acc_herr,
                    acc_vehic:    acc.acc_vehic    + s.acc_vehic,
                    acc_aseo:     acc.acc_aseo     + s.acc_aseo,
                    acc_total:    acc.acc_total    + s.acc_total,
                    total_cobrar: acc.total_cobrar + s.total_cobrar,
                  }), { acc_prod: 0, acc_ctrl_doc: 0, acc_ctrl_vis: 0, acc_ret: 0, acc_herr: 0, acc_vehic: 0, acc_aseo: 0, acc_total: 0, total_cobrar: 0 });

                  return (
                    <tr className="bg-slate-800 text-white font-bold text-xs">
                      <td className="px-3 py-2 border border-slate-700 text-slate-300 uppercase text-[10px] tracking-wide">Total equipo</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_prod >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_prod)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_ctrl_doc >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_ctrl_doc)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_ctrl_vis >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_ctrl_vis)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_ret >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_ret)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_herr >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_herr)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_vehic >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_vehic)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.acc_aseo >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_aseo)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 text-base ${T.acc_total >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.acc_total)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.total_cobrar > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {T.total_cobrar > 0 ? euro(T.total_cobrar) : '—'}
                      </td>
                      <td className="px-2 py-2 text-center border border-slate-700 text-slate-500">—</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {summaries.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Sin operarios activos</p>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          MONTHLY VIEW
         ══════════════════════════════════════════════════════════ */}
      {mode === 'mensual' && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
            <table className="min-w-max border-collapse text-xs">
              <thead className="text-white">
                <tr>
                  <th className={`${thBase} bg-slate-700 text-left px-3 min-w-[140px]`}>Operario</th>
                  <th className={`${thBase} bg-blue-800 min-w-[68px]`}>%Prod</th>
                  <th className={`${thBase} bg-blue-800 min-w-[56px]`}>Imp.P</th>
                  <th className={`${thBase} bg-emerald-800 min-w-[60px]`}>C.Doc pts</th>
                  <th className={`${thBase} bg-emerald-800 min-w-[56px]`}>Imp.CD</th>
                  <th className={`${thBase} bg-emerald-800 min-w-[62px]`}>Visita</th>
                  <th className={`${thBase} bg-emerald-800 min-w-[56px]`}>Imp.V</th>
                  <th className={`${thBase} bg-emerald-800 min-w-[56px]`}>%Ret</th>
                  <th className={`${thBase} bg-emerald-800 min-w-[56px]`}>Imp.R</th>
                  <th className={`${thBase} bg-amber-800 min-w-[50px]`}>Herr</th>
                  <th className={`${thBase} bg-amber-800 min-w-[50px]`}>Vehic</th>
                  <th className={`${thBase} bg-amber-800 min-w-[50px]`}>Aseo</th>
                  <th className={`${thBase} bg-purple-800 min-w-[56px]`}>H.Obj</th>
                  <th className={`${thBase} bg-purple-800 min-w-[56px]`}>H.Inv</th>
                  <th className={`${thBase} bg-purple-800 min-w-[62px]`}>Penaliz</th>
                  <th className={`${thBase} bg-slate-600 min-w-[80px]`}>Total</th>
                  <th className={`${thBase} bg-emerald-700 min-w-[80px]`}>A cobrar</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r, i) => {
                  const cobrar = Math.max(r.total - r.kpiRef, 0);
                  return (
                    <tr key={r.nombre} className={i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-100/60'}>
                      <td className="px-3 py-2 border border-slate-200 font-semibold text-slate-800 text-xs">{r.nombre}</td>
                      <td className={`${td} text-slate-600`}>{r.md.prod_pct}%</td>
                      <td className={`${td} ${clr(r.imp_prod)}`}>{euro(r.imp_prod)}</td>
                      <td className={`${td} text-slate-600`}>{r.md.ctrl_doc_pts}</td>
                      <td className={`${td} ${clr(r.imp_ctrl_doc)}`}>{euro(r.imp_ctrl_doc)}</td>
                      <td className={`${td}`}>
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${r.md.ctrl_vis_pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {r.md.ctrl_vis_pct >= 100 ? 'OK' : 'KO'}
                        </span>
                      </td>
                      <td className={`${td} ${clr(r.imp_ctrl_vis)}`}>{euro(r.imp_ctrl_vis)}</td>
                      <td className={`${td} text-slate-600`}>{r.md.retorno_pct}%</td>
                      <td className={`${td} ${clr(r.imp_ret)}`}>{euro(r.imp_ret)}</td>
                      <td className={`${td}`}>
                        <span className={`px-1 py-0.5 rounded font-semibold text-[10px] ${r.md.herr_pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.md.herr_pct >= 100 ? 'OK' : 'KO'}
                        </span>
                      </td>
                      <td className={`${td}`}>
                        <span className={`px-1 py-0.5 rounded font-semibold text-[10px] ${r.md.vehic_pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.md.vehic_pct >= 100 ? 'OK' : 'KO'}
                        </span>
                      </td>
                      <td className={`${td}`}>
                        <span className={`px-1 py-0.5 rounded font-semibold text-[10px] ${r.md.aseo_pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.md.aseo_pct >= 100 ? 'OK' : 'KO'}
                        </span>
                      </td>
                      <td className={`${td} text-slate-600`}>{r.md.h_obj}h</td>
                      <td className={`${td} text-slate-600`}>{r.md.h_inv}h</td>
                      <td className={`${td} ${r.penalizacion > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                        {r.penalizacion > 0 ? `−${r.penalizacion.toFixed(0)} €` : '—'}
                      </td>
                      <td className={`${td} font-bold text-sm ${clr(r.total)}`}>{euro(r.total)}</td>
                      <td className={`${td} font-semibold ${cobrar > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {cobrar > 0 ? euro(cobrar) : '—'}
                      </td>
                    </tr>
                  );
                })}

                {/* Monthly team totals */}
                {monthlyRows.length > 0 && (() => {
                  const T = monthlyRows.reduce((acc, r) => ({
                    total:    acc.total    + r.total,
                    cobrar:   acc.cobrar   + Math.max(r.total - r.kpiRef, 0),
                    imp_prod: acc.imp_prod + r.imp_prod,
                  }), { total: 0, cobrar: 0, imp_prod: 0 });
                  return (
                    <tr className="bg-slate-800 text-white font-bold text-xs">
                      <td className="px-3 py-2 border border-slate-700 text-slate-300 uppercase text-[10px] tracking-wide">Total equipo</td>
                      {Array.from({ length: 14 }).map((_, i) => (
                        <td key={i} className="border border-slate-700" />
                      ))}
                      <td className={`px-2 py-2 text-center border border-slate-700 text-sm ${T.total >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(T.total)}</td>
                      <td className={`px-2 py-2 text-center border border-slate-700 ${T.cobrar > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {T.cobrar > 0 ? euro(T.cobrar) : '—'}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {monthlyRows.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Sin operarios activos</p>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-400 italic px-1">
        Los datos de KPI Mensual se guardan en la base de datos y son accesibles desde cualquier dispositivo.
      </p>
    </div>
  );
}
