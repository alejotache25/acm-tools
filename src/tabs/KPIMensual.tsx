import { useState, useMemo, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthData {
  empty?:        boolean; // when true, month contributes 0 to all KPIs
  prod_pct:      number;  // B: 0|80|90|95|100|105|110|120
  ctrl_doc_pts:  number;  // E: -80|10|20|30|40|50|60|70|80
  ctrl_vis_pct:  number;  // H: 100=OK | -100=KO | 0=—
  retorno_pct:   number;  // K: any %
  herr_pct:      number;  // O: 100=OK | -100=KO | 0=—
  vehic_pct:     number;  // R: 100=OK | -100=KO | 0=—
  aseo_pct:      number;  // U: 100=OK | -100=KO | 0=—
  h_obj:         number;  // X: objetivo horas improductivas
  h_inv:         number;  // Y: horas invertidas
  // RESUMEN INCENTIVOS fields (col E, F, G)
  objetivo:      number;  // E: objetivo mensual a cobrar (default 250)
  dietas:        number;  // F: dietas del mes (manual)
  h_ext:         number;  // G: horas extra del mes (manual)
}

type YearData = Record<number, MonthData>;  // key: 1–12

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const PROD_OPTIONS     = [0, 80, 90, 95, 100, 105, 110, 120];
const CTRL_DOC_OPTIONS = [-80, 10, 20, 30, 40, 50, 60, 70, 80];
const PENALTY_RATE     = 39;   // €/hora (W3 en la hoja)

const DEFAULT_MONTH: MonthData = {
  prod_pct:     100,
  ctrl_doc_pts: 10,
  ctrl_vis_pct: 100,
  retorno_pct:  0,
  herr_pct:     100,
  vehic_pct:    100,
  aseo_pct:     100,
  h_obj:        1.5,
  h_inv:        0,
  objetivo:     250,
  dietas:       0,
  h_ext:        0,
};

// ─── Storage ──────────────────────────────────────────────────────────────────

function storageKey(operario: string, año: number) {
  return `kpi_mensual:${operario}:${año}`;
}

function loadYear(operario: string, año: number): YearData {
  try {
    const raw = localStorage.getItem(storageKey(operario, año));
    return raw ? (JSON.parse(raw) as YearData) : {};
  } catch { return {}; }
}

function saveYear(operario: string, año: number, data: YearData) {
  localStorage.setItem(storageKey(operario, año), JSON.stringify(data));
}

function kpiRefKey(operario: string, año: number) {
  return `kpi_ref:${operario}:${año}`;
}

function loadKpiRef(operario: string, año: number): number {
  try {
    const raw = localStorage.getItem(kpiRefKey(operario, año));
    return raw !== null ? parseFloat(raw) : 0;
  } catch { return 0; }
}

function saveKpiRef(operario: string, año: number, val: number) {
  localStorage.setItem(kpiRefKey(operario, año), String(val));
}

function getMonthData(data: YearData, mes: number): MonthData {
  return data[mes] ?? { ...DEFAULT_MONTH };
}

// ─── Lookup Functions ─────────────────────────────────────────────────────────
// Exact VLOOKUP approximate-match replication from the spreadsheet

// Productividad (A4:C10) and RETORNO (AS4:AU44) share the same thresholds
function lookupProd(pct: number): number {
  if (pct >= 80)  return pct >= 100 ? 100 : pct >= 95 ? 75 : pct >= 90 ? 50 : 25;
  return 0;
}

// Control Documental (I4:K13)
function lookupCtrlDoc(pts: number): number {
  if (pts >= 80)  return 0;
  if (pts >= 70)  return 25;
  if (pts >= 60)  return 50;
  if (pts >= 50)  return 75;
  if (pts >= 1)   return 100;
  return -25;   // pts < 1 → matches -80 threshold
}

// Control Visitas (A15:C16) — 0 = neutral (not applicable)
function lookupVis(pct: number): number {
  if (pct === 0) return 0;
  return pct >= 100 ? 25 : -25;
}

// Herramientas (O4:Q5)
function lookupHerr(pct: number): number {
  return pct >= 100 ? 5 : 0;
}

// Vehículo (O5:Q6)
function lookupVehic(pct: number): number {
  return pct >= 100 ? 10 : 0;
}

// Aseo personal (O8:Q9)
function lookupAseo(pct: number): number {
  return pct >= 100 ? 10 : 0;
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

function euro(n: number): string {
  if (n === 0) return '0 €';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2)} €`;
}

function clrEuro(n: number): string {
  if (n > 0) return 'text-green-700 font-semibold';
  if (n < 0) return 'text-red-600 font-semibold';
  return 'text-slate-400';
}

// ─── Input Cell Styles ────────────────────────────────────────────────────────

const selectCls = 'bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer';
const numCls    = 'bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 text-center w-14';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KPIMensual({ operario }: { operario: string }) {
  const { user } = useAuth();
  const isOperario = user?.rol === 'operario';
  const now = new Date();
  const [año, setAño]     = useState(now.getFullYear());
  const [data, setData]   = useState<YearData>(() => loadYear(operario, año));
  const [kpiRef, setKpiRef] = useState(() => loadKpiRef(operario, now.getFullYear()));

  useEffect(() => {
    setData(loadYear(operario, año));
    setKpiRef(loadKpiRef(operario, año));
  }, [operario, año]);

  const updateKpiRef = (val: number) => {
    setKpiRef(val);
    saveKpiRef(operario, año, val);
  };

  const updateField = (mes: number, field: keyof MonthData, value: number) => {
    setData(prev => {
      const updated: YearData = {
        ...prev,
        [mes]: { ...getMonthData(prev, mes), [field]: value },
      };
      saveYear(operario, año, updated);
      return updated;
    });
  };

  const clearMonth = (mes: number) => {
    setData(prev => {
      const updated: YearData = {
        ...prev,
        [mes]: { ...getMonthData(prev, mes), empty: true },
      };
      saveYear(operario, año, updated);
      return updated;
    });
  };

  const restoreMonth = (mes: number) => {
    setData(prev => {
      const updated: YearData = {
        ...prev,
        [mes]: { ...getMonthData(prev, mes), empty: false },
      };
      saveYear(operario, año, updated);
      return updated;
    });
  };

  // Compute all 12 months with running accumulators (mirrors spreadsheet formulas)
  const rows = useMemo(() => {
    let acc_prod = 0, acc_ctrl_doc = 0, acc_ctrl_vis = 0, acc_ret = 0;
    let acc_herr = 0, acc_vehic = 0, acc_aseo = 0, acc_total = 0;

    return Array.from({ length: 12 }, (_, i) => {
      const mes     = i + 1;
      const md      = getMonthData(data, mes);
      const isEmpty = !!md.empty;

      // Column C: Importe Productividad = BUSCARV(B, A4:C10, 2)
      const imp_prod     = isEmpty ? 0 : lookupProd(md.prod_pct);
      // Column F: Importe Control Documental = BUSCARV(E, I4:K13, 2)
      const imp_ctrl_doc = isEmpty ? 0 : lookupCtrlDoc(md.ctrl_doc_pts);
      // Column I: Importe Control Visitas = BUSCARV(H, A15:C16, 2)
      const imp_ctrl_vis = isEmpty ? 0 : lookupVis(md.ctrl_vis_pct);
      // Column L: %P − %R
      const net_pct      = isEmpty ? 0 : md.prod_pct - md.retorno_pct;
      // Column M: Importe Retorno = BUSCARV(L, AS4:AU44, 2) — same thresholds as productividad
      const imp_ret      = isEmpty ? 0 : lookupProd(net_pct);
      // Column P: Importe Herramientas
      const imp_herr     = isEmpty ? 0 : lookupHerr(md.herr_pct);
      // Column S: Importe Vehículo
      const imp_vehic    = isEmpty ? 0 : lookupVehic(md.vehic_pct);
      // Column V: Importe Aseo personal
      const imp_aseo     = isEmpty ? 0 : lookupAseo(md.aseo_pct);
      // Column Z: Dif = Y − X
      const h_dif        = isEmpty ? 0 : md.h_inv - md.h_obj;
      // Column AA: % = Z / X
      const h_pct        = (!isEmpty && md.h_obj > 0) ? (h_dif / md.h_obj) * 100 : 0;
      // Column AB: Penalización = MAX(Z,0) × W3
      const penalizacion = isEmpty ? 0 : +(Math.max(h_dif, 0) * PENALTY_RATE).toFixed(2);
      // Column AC: TOTAL = F + I + M + P + S + V − AB  (C/productividad NOT in total)
      const total        = +(imp_ctrl_doc + imp_ctrl_vis + imp_ret + imp_herr + imp_vehic + imp_aseo - penalizacion).toFixed(2);

      // Running accumulators (columns D, G, J, N, Q, T, W)
      acc_prod     += imp_prod;
      acc_ctrl_doc += imp_ctrl_doc;
      acc_ctrl_vis += imp_ctrl_vis;
      acc_ret      += imp_ret;
      acc_herr     += imp_herr;
      acc_vehic    += imp_vehic;
      acc_aseo     += imp_aseo;
      acc_total    += total;

      return {
        mes, md, isEmpty,
        imp_prod,     acc_prod:     acc_prod,
        imp_ctrl_doc, acc_ctrl_doc: acc_ctrl_doc,
        imp_ctrl_vis, acc_ctrl_vis: acc_ctrl_vis,
        net_pct, imp_ret, acc_ret: acc_ret,
        imp_herr, acc_herr: acc_herr,
        imp_vehic,    acc_vehic:    acc_vehic,
        imp_aseo,     acc_aseo:     acc_aseo,
        h_dif, h_pct, penalizacion,
        total, acc_total: acc_total,
      };
    });
  }, [data]);

  // Last row has the annual running totals
  const ann = rows[11];
  const curMes = año === now.getFullYear() ? now.getMonth() + 1 : -1;

  // RESUMEN INCENTIVOS summary values
  const resumen = useMemo(() => {
    let total_importe = 0, total_cobrar = 0, total_objetivo = 0, total_dietas = 0, total_hext = 0;
    let totalp_importe = 0, totalp_cobrar = 0, totalp_objetivo = 0;

    for (const r of rows) {
      const cobrar = Math.max(r.total - kpiRef, 0);
      total_importe  += r.total;
      total_cobrar   += cobrar;
      total_objetivo += r.md.objetivo;
      total_dietas   += r.md.dietas;
      total_hext     += r.md.h_ext;
      if (r.total > 0) {
        totalp_importe  += r.total;
        totalp_cobrar   += cobrar;
        totalp_objetivo += r.md.objetivo;
      }
    }

    const pct_objetivo = totalp_objetivo > 0 ? (total_cobrar / totalp_objetivo) * 100 : null;
    return { total_importe, total_cobrar, total_objetivo, total_dietas, total_hext, totalp_importe, totalp_cobrar, totalp_objetivo, pct_objetivo };
  }, [rows, kpiRef]);

  // ─── Shared th style helpers ─────────────────────────────────────────────

  const thBase  = 'px-2 py-1 text-center border border-slate-500 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap';
  const thProd  = `${thBase} bg-blue-800`;
  const thCal   = `${thBase} bg-emerald-800`;
  const thOrd   = `${thBase} bg-amber-800`;
  const thHI    = `${thBase} bg-purple-800`;
  const thTot   = `${thBase} bg-slate-600`;
  const thProd2 = `${thBase} bg-blue-700 text-[9px]`;
  const thCal2  = `${thBase} bg-emerald-700 text-[9px]`;
  const thOrd2  = `${thBase} bg-amber-700 text-[9px]`;
  const thHI2   = `${thBase} bg-purple-700 text-[9px]`;
  const thProd3 = `${thBase} bg-blue-600 text-[9px]`;
  const thCal3  = `${thBase} bg-emerald-600 text-[9px]`;
  const thOrd3  = `${thBase} bg-amber-600 text-[9px]`;
  const thHI3   = `${thBase} bg-purple-600 text-[9px]`;

  const td  = 'px-2 py-1.5 text-center border border-slate-200 text-xs whitespace-nowrap';
  const tdi = 'px-1 py-1 border border-slate-200';

  return (
    <div className="space-y-4">

      {/* ── Year selector ── */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-xl px-5 py-3">
        <span className="font-bold text-sm tracking-wide">KPI Mensual</span>
        <span className="text-blue-500">·</span>
        <span className="text-blue-300 text-sm italic">{operario}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAño(y => y - 1)}
            className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            title="Año anterior"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="font-bold text-xl w-16 text-center tabular-nums">{año}</span>
          <button
            onClick={() => setAño(y => y + 1)}
            className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            title="Año siguiente"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Main KPI table ── */}
      <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="min-w-max border-collapse text-xs">
          <thead className="text-white">

            {/* Level 1 — Section groups */}
            <tr>
              <th rowSpan={3} className={`px-3 py-2 text-left border border-slate-600 bg-slate-700 min-w-[96px] text-xs font-bold uppercase`}>
                MES
              </th>
              <th colSpan={3} className={thProd}>PRODUCTIVIDAD</th>
              <th colSpan={10} className={thCal}>CALIDAD</th>
              <th colSpan={9}  className={thOrd}>ORDEN LIMPIEZA Y SEGURIDAD</th>
              <th colSpan={5}  className={thHI}>HORAS IMPRODUCTIVAS</th>
              <th rowSpan={3} className={`${thTot} min-w-[80px]`}>TOTAL</th>
              <th rowSpan={3} className={`${thBase} bg-slate-500 min-w-[36px]`}> </th>
            </tr>

            {/* Level 2 — Sub-sections */}
            <tr>
              {/* Productividad sub */}
              <th colSpan={3} className={thProd2}> </th>
              {/* CALIDAD sub-sections */}
              <th colSpan={3} className={thCal2}>Control Documental</th>
              <th colSpan={3} className={thCal2}>Control Visitas</th>
              <th colSpan={4} className={thCal2}>RETORNO</th>
              {/* ORDEN sub-sections */}
              <th colSpan={3} className={thOrd2}>Herramientas</th>
              <th colSpan={3} className={thOrd2}>Vehículo</th>
              <th colSpan={3} className={thOrd2}>Aseo personal</th>
              {/* Horas sub */}
              <th colSpan={5} className={thHI2}> </th>
            </tr>

            {/* Level 3 — Column labels */}
            <tr>
              {/* Productividad cols */}
              <th className={`${thProd3} min-w-[72px]`}>%Obj</th>
              <th className={`${thProd3} min-w-[62px]`}>Importe</th>
              <th className={`${thProd3} min-w-[66px]`}>Acumulado</th>
              {/* Control Documental */}
              <th className={`${thCal3} min-w-[72px]`}>Puntos</th>
              <th className={`${thCal3} min-w-[62px]`}>Importe</th>
              <th className={`${thCal3} min-w-[66px]`}>Acumulado</th>
              {/* Control Visitas */}
              <th className={`${thCal3} min-w-[66px]`}>Estado</th>
              <th className={`${thCal3} min-w-[62px]`}>Importe</th>
              <th className={`${thCal3} min-w-[66px]`}>Acumulado</th>
              {/* Retorno */}
              <th className={`${thCal3} min-w-[60px]`}>%Ret</th>
              <th className={`${thCal3} min-w-[60px]`}>%P−%R</th>
              <th className={`${thCal3} min-w-[62px]`}>Importe</th>
              <th className={`${thCal3} min-w-[66px]`}>Acumulado</th>
              {/* Herramientas */}
              <th className={`${thOrd3} min-w-[62px]`}>Estado</th>
              <th className={`${thOrd3} min-w-[56px]`}>Importe</th>
              <th className={`${thOrd3} min-w-[66px]`}>Acumulado</th>
              {/* Vehículo */}
              <th className={`${thOrd3} min-w-[62px]`}>Estado</th>
              <th className={`${thOrd3} min-w-[56px]`}>Importe</th>
              <th className={`${thOrd3} min-w-[66px]`}>Acumulado</th>
              {/* Aseo personal */}
              <th className={`${thOrd3} min-w-[62px]`}>Estado</th>
              <th className={`${thOrd3} min-w-[56px]`}>Importe</th>
              <th className={`${thOrd3} min-w-[66px]`}>Acumulado</th>
              {/* Horas Improductivas */}
              <th className={`${thHI3} min-w-[60px]`}>H.Obj</th>
              <th className={`${thHI3} min-w-[60px]`}>H.Inv</th>
              <th className={`${thHI3} min-w-[56px]`}>Dif</th>
              <th className={`${thHI3} min-w-[52px]`}>%</th>
              <th className={`${thHI3} min-w-[70px]`}>Penaliz.</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(r => {
              const isCurrent = r.mes === curMes;
              const isLocked = isOperario && !isCurrent;
              const locked = isLocked || r.isEmpty;
              const rowBg = r.isEmpty ? 'bg-slate-100 opacity-60' : isCurrent ? 'bg-blue-50' : 'bg-white hover:bg-slate-50/80';
              const dash = <span className="text-slate-300 text-xs">—</span>;

              return (
                <tr key={r.mes} className={`${rowBg} transition-colors`}>

                  {/* MES */}
                  <td className={`px-3 py-1.5 border border-slate-200 font-medium whitespace-nowrap ${isCurrent ? 'text-blue-700 font-bold bg-blue-100' : 'text-slate-700'}`}>
                    {MESES[r.mes - 1]}
                    {isCurrent && <span className="ml-1 text-blue-400 text-[9px]">◀</span>}
                  </td>

                  {/* ── PRODUCTIVIDAD ── */}

                  {/* B: %Obj Productividad (manual select) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <select
                        value={r.md.prod_pct}
                        onChange={e => updateField(r.mes, 'prod_pct', Number(e.target.value))}
                        disabled={locked}
                        className={`${selectCls} w-16`}
                      >
                        {PROD_OPTIONS.map(v => <option key={v} value={v}>{v === 0 ? '< 80%' : `${v}%`}</option>)}
                      </select>
                    )}
                  </td>
                  {/* C: Importe Productividad (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_prod)}`}>{r.isEmpty ? '—' : euro(r.imp_prod)}</td>
                  {/* D: Acumulado Productividad (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_prod)}`}>{euro(r.acc_prod)}</td>

                  {/* ── CALIDAD — Control Documental ── */}

                  {/* E: Puntos Obj CtrlDoc (manual select) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <select
                        value={r.md.ctrl_doc_pts}
                        onChange={e => updateField(r.mes, 'ctrl_doc_pts', Number(e.target.value))}
                        disabled={locked}
                        className={`${selectCls} w-16`}
                      >
                        {CTRL_DOC_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                  </td>
                  {/* F: Importe CtrlDoc (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_ctrl_doc)}`}>{r.isEmpty ? '—' : euro(r.imp_ctrl_doc)}</td>
                  {/* G: Acumulado CtrlDoc (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_ctrl_doc)}`}>{euro(r.acc_ctrl_doc)}</td>

                  {/* ── CALIDAD — Control Visitas ── */}

                  {/* H: %Obj Visitas OK/KO/— (manual select) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <select
                        value={r.md.ctrl_vis_pct}
                        onChange={e => updateField(r.mes, 'ctrl_vis_pct', Number(e.target.value))}
                        disabled={locked}
                        className={`${selectCls} w-16`}
                      >
                        <option value={0}>—</option>
                        <option value={100}>OK</option>
                        <option value={-100}>KO</option>
                      </select>
                    )}
                  </td>
                  {/* I: Importe Visitas (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_ctrl_vis)}`}>{r.isEmpty ? '—' : euro(r.imp_ctrl_vis)}</td>
                  {/* J: Acumulado Visitas (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_ctrl_vis)}`}>{euro(r.acc_ctrl_vis)}</td>

                  {/* ── CALIDAD — RETORNO ── */}

                  {/* K: %Obj Retorno (manual number) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <input
                        type="number" step="1" min="0" max="100"
                        value={r.md.retorno_pct}
                        onChange={e => updateField(r.mes, 'retorno_pct', parseFloat(e.target.value) || 0)}
                        disabled={locked}
                        className={numCls}
                      />
                    )}
                  </td>
                  {/* L: %P−%R (auto) */}
                  <td className={`${td} font-semibold ${r.isEmpty ? 'text-slate-300' : r.net_pct >= 100 ? 'text-green-700' : r.net_pct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                    {r.isEmpty ? '—' : `${r.net_pct}%`}
                  </td>
                  {/* M: Importe Retorno (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_ret)}`}>{r.isEmpty ? '—' : euro(r.imp_ret)}</td>
                  {/* N: Acumulado Retorno (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_ret)}`}>{euro(r.acc_ret)}</td>

                  {/* ── ORDEN LIMPIEZA — Herramientas ── */}

                  {/* O: Estado Herramientas OK/KO/— (manual select) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <select
                        value={r.md.herr_pct}
                        onChange={e => updateField(r.mes, 'herr_pct', Number(e.target.value))}
                        disabled={locked}
                        className={`${selectCls} w-14`}
                      >
                        <option value={0}>—</option>
                        <option value={100}>OK</option>
                        <option value={-100}>KO</option>
                      </select>
                    )}
                  </td>
                  {/* P: Importe Herramientas (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_herr)}`}>{r.isEmpty ? '—' : euro(r.imp_herr)}</td>
                  {/* Q: Acumulado Herramientas (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_herr)}`}>{euro(r.acc_herr)}</td>

                  {/* ── ORDEN LIMPIEZA — Vehículo ── */}

                  {/* R: Estado Vehículo OK/KO/— (manual select) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <select
                        value={r.md.vehic_pct}
                        onChange={e => updateField(r.mes, 'vehic_pct', Number(e.target.value))}
                        disabled={locked}
                        className={`${selectCls} w-14`}
                      >
                        <option value={0}>—</option>
                        <option value={100}>OK</option>
                        <option value={-100}>KO</option>
                      </select>
                    )}
                  </td>
                  {/* S: Importe Vehículo (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_vehic)}`}>{r.isEmpty ? '—' : euro(r.imp_vehic)}</td>
                  {/* T: Acumulado Vehículo (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_vehic)}`}>{euro(r.acc_vehic)}</td>

                  {/* ── ORDEN LIMPIEZA — Aseo personal ── */}

                  {/* U: Estado Aseo OK/KO/— (manual select) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <select
                        value={r.md.aseo_pct}
                        onChange={e => updateField(r.mes, 'aseo_pct', Number(e.target.value))}
                        disabled={locked}
                        className={`${selectCls} w-14`}
                      >
                        <option value={0}>—</option>
                        <option value={100}>OK</option>
                        <option value={-100}>KO</option>
                      </select>
                    )}
                  </td>
                  {/* V: Importe Aseo (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : clrEuro(r.imp_aseo)}`}>{r.isEmpty ? '—' : euro(r.imp_aseo)}</td>
                  {/* W: Acumulado Aseo (auto) */}
                  <td className={`${td} ${clrEuro(r.acc_aseo)}`}>{euro(r.acc_aseo)}</td>

                  {/* ── HORAS IMPRODUCTIVAS ── */}

                  {/* X: H.Objetivo (manual number) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <input
                        type="number" step="0.5" min="0"
                        value={r.md.h_obj}
                        onChange={e => updateField(r.mes, 'h_obj', parseFloat(e.target.value) || 0)}
                        disabled={locked}
                        className={numCls}
                      />
                    )}
                  </td>
                  {/* Y: H.Invertidas (manual number) */}
                  <td className={tdi}>
                    {r.isEmpty ? dash : (
                      <input
                        type="number" step="0.5" min="0"
                        value={r.md.h_inv}
                        onChange={e => updateField(r.mes, 'h_inv', parseFloat(e.target.value) || 0)}
                        disabled={locked}
                        className={numCls}
                      />
                    )}
                  </td>
                  {/* Z: Dif = Y − X (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : r.h_dif > 0 ? 'text-red-600 font-semibold' : r.h_dif < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {r.isEmpty ? '—' : r.h_dif === 0 ? '—' : `${r.h_dif > 0 ? '+' : ''}${r.h_dif.toFixed(1)}h`}
                  </td>
                  {/* AA: % = Z/X (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : 'text-slate-600'}`}>
                    {r.isEmpty ? '—' : r.md.h_obj > 0 ? `${r.h_pct.toFixed(0)}%` : '—'}
                  </td>
                  {/* AB: Penalización = MAX(Z,0) × 39 (auto) */}
                  <td className={`${td} ${r.isEmpty ? 'text-slate-300' : r.penalizacion > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                    {r.isEmpty ? '—' : r.penalizacion > 0 ? `−${r.penalizacion.toFixed(0)} €` : '—'}
                  </td>

                  {/* ── TOTAL (AC) ── */}
                  <td className={`${td} font-bold text-sm ${r.isEmpty ? 'text-slate-300' : clrEuro(r.total)}`}>
                    {r.isEmpty ? '—' : euro(r.total)}
                  </td>

                  {/* ── LIMPIAR / RESTAURAR ── */}
                  <td className="px-1 py-1 border border-slate-200 text-center">
                    {r.isEmpty ? (
                      <button
                        onClick={() => restoreMonth(r.mes)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors leading-tight"
                        title="Restaurar mes"
                      >↺</button>
                    ) : (
                      <button
                        onClick={() => clearMonth(r.mes)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors leading-tight"
                        title="Limpiar mes (poner a 0)"
                      >×</button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Annual totals row */}
            <tr className="bg-slate-800 text-white text-xs font-bold">
              <td className="px-3 py-2 border border-slate-700 whitespace-nowrap">TOTAL ANUAL</td>
              {/* Productividad */}
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_prod >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_prod)}</td>
              <td className="border border-slate-700" />
              {/* Control Documental */}
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_ctrl_doc >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_ctrl_doc)}</td>
              <td className="border border-slate-700" />
              {/* Control Visitas */}
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_ctrl_vis >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_ctrl_vis)}</td>
              <td className="border border-slate-700" />
              {/* Retorno */}
              <td className="border border-slate-700" />
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_ret >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_ret)}</td>
              <td className="border border-slate-700" />
              {/* Herramientas */}
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_herr >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_herr)}</td>
              <td className="border border-slate-700" />
              {/* Vehículo */}
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_vehic >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_vehic)}</td>
              <td className="border border-slate-700" />
              {/* Aseo */}
              <td className="border border-slate-700" />
              <td className={`px-2 py-2 text-center border border-slate-700 ${ann.acc_aseo >= 0 ? 'text-green-300' : 'text-red-300'}`}>{euro(ann.acc_aseo)}</td>
              <td className="border border-slate-700" />
              {/* Horas Improductivas — 5 cols */}
              <td className="border border-slate-700" />
              <td className="border border-slate-700" />
              <td className="border border-slate-700" />
              <td className="border border-slate-700" />
              <td className="border border-slate-700" />
              {/* TOTAL ANUAL */}
              <td className={`px-3 py-2 text-center border border-slate-700 text-base ${ann.acc_total >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {euro(ann.acc_total)}
              </td>
              <td className="border border-slate-700" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── RESUMEN INCENTIVOS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Header with KPI Referencia input */}
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-slate-700 to-slate-600 text-white px-4 py-2.5">
          <span className="font-bold text-sm tracking-wide uppercase">Resumen Incentivos</span>
          <div className="flex items-center gap-2 text-xs ml-auto">
            <label className="text-slate-300 whitespace-nowrap">KPI Referencia (umbral):</label>
            <input
              type="number" step="1" min="0"
              value={kpiRef}
              onChange={e => updateKpiRef(parseFloat(e.target.value) || 0)}
              className="w-20 bg-slate-800 border border-slate-500 rounded px-2 py-0.5 text-white text-center outline-none focus:ring-1 focus:ring-blue-400 text-xs"
            />
            <span className="text-slate-400">€</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-600 text-white text-[11px] font-semibold uppercase tracking-wide">
                <th className="px-3 py-2 text-left border border-slate-500 min-w-[100px]">MES</th>
                <th className="px-3 py-2 text-right border border-slate-500 min-w-[90px]">IMPORTE</th>
                <th className="px-3 py-2 text-right border border-slate-500 min-w-[90px]">ACUMULADO</th>
                <th className="px-3 py-2 text-right border border-slate-500 min-w-[110px]">Imp. a Cobrar</th>
                <th className="px-3 py-2 text-right border border-slate-500 min-w-[90px]">OBJETIVO</th>
                <th className="px-3 py-2 text-right border border-slate-500 min-w-[80px]">DIETAS</th>
                <th className="px-3 py-2 text-right border border-slate-500 min-w-[80px]">H EXT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isCurrent = r.mes === curMes;
                const isLocked2 = isOperario && !isCurrent;
                const cobrar = Math.max(r.total - kpiRef, 0);
                return (
                  <tr key={r.mes} className={`${isCurrent ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-slate-100/60 transition-colors`}>
                    <td className={`px-3 py-1.5 border border-slate-200 font-medium ${isCurrent ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                      {MESES[r.mes - 1]}
                      {isCurrent && <span className="ml-1 text-blue-400 text-[9px]">◀</span>}
                    </td>
                    {/* IMPORTE = TOTAL from monthly KPI (auto) */}
                    <td className={`px-3 py-1.5 text-right border border-slate-200 ${clrEuro(r.total)}`}>
                      {euro(r.total)}
                    </td>
                    {/* ACUMULADO = running sum of TOTAL (auto) */}
                    <td className={`px-3 py-1.5 text-right border border-slate-200 ${clrEuro(r.acc_total)}`}>
                      {euro(r.acc_total)}
                    </td>
                    {/* Importe a Cobrar = MAX(IMPORTE − kpiRef, 0) (auto) */}
                    <td className={`px-3 py-1.5 text-right border border-slate-200 font-semibold ${cobrar > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {cobrar > 0 ? euro(cobrar) : '—'}
                    </td>
                    {/* OBJETIVO (manual) */}
                    <td className="px-1 py-1 border border-slate-200">
                      <input
                        type="number" step="1" min="0"
                        value={r.md.objetivo}
                        onChange={e => updateField(r.mes, 'objetivo', parseFloat(e.target.value) || 0)}
                        disabled={isLocked2}
                        className={`${numCls} w-16`}
                      />
                    </td>
                    {/* DIETAS (manual) */}
                    <td className="px-1 py-1 border border-slate-200">
                      <input
                        type="number" step="0.5" min="0"
                        value={r.md.dietas}
                        onChange={e => updateField(r.mes, 'dietas', parseFloat(e.target.value) || 0)}
                        disabled={isLocked2}
                        className={`${numCls} w-16`}
                      />
                    </td>
                    {/* H EXT (manual) */}
                    <td className="px-1 py-1 border border-slate-200">
                      <input
                        type="number" step="0.5" min="0"
                        value={r.md.h_ext}
                        onChange={e => updateField(r.mes, 'h_ext', parseFloat(e.target.value) || 0)}
                        disabled={isLocked2}
                        className={`${numCls} w-16`}
                      />
                    </td>
                  </tr>
                );
              })}

              {/* TOTAL row — all 12 months */}
              <tr className="bg-slate-700 text-white font-bold text-xs">
                <td className="px-3 py-2 border border-slate-600">TOTAL</td>
                <td className={`px-3 py-2 text-right border border-slate-600 ${resumen.total_importe >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {euro(resumen.total_importe)}
                </td>
                <td className="px-3 py-2 text-right border border-slate-600 text-slate-400">—</td>
                <td className={`px-3 py-2 text-right border border-slate-600 ${resumen.total_cobrar > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {resumen.total_cobrar > 0 ? euro(resumen.total_cobrar) : '—'}
                </td>
                <td className="px-3 py-2 text-right border border-slate-600">{euro(resumen.total_objetivo)}</td>
                <td className="px-3 py-2 text-right border border-slate-600">{euro(resumen.total_dietas)}</td>
                <td className="px-3 py-2 text-right border border-slate-600">{euro(resumen.total_hext)}</td>
              </tr>

              {/* TOTAL(P) row — only months where IMPORTE > 0 */}
              <tr className="bg-slate-600 text-white font-semibold text-xs">
                <td className="px-3 py-2 border border-slate-500">TOTAL (P)</td>
                <td className={`px-3 py-2 text-right border border-slate-500 ${resumen.totalp_importe >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {euro(resumen.totalp_importe)}
                </td>
                <td className="px-3 py-2 text-right border border-slate-500 text-slate-400">—</td>
                <td className={`px-3 py-2 text-right border border-slate-500 ${resumen.totalp_cobrar > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {resumen.totalp_cobrar > 0 ? euro(resumen.totalp_cobrar) : '—'}
                </td>
                <td className="px-3 py-2 text-right border border-slate-500">{euro(resumen.totalp_objetivo)}</td>
                <td className="px-3 py-2 text-right border border-slate-500 text-slate-400">—</td>
                <td className="px-3 py-2 text-right border border-slate-500 text-slate-400">—</td>
              </tr>

              {/* % OBJETIVO row */}
              <tr className="bg-emerald-700 text-white font-bold text-xs">
                <td className="px-3 py-2 border border-emerald-600">% OBJETIVO</td>
                <td className="px-3 py-2 text-right border border-emerald-600 text-emerald-200">
                  {euro(resumen.total_cobrar)}
                </td>
                <td className="px-3 py-2 text-right border border-emerald-600 text-emerald-200">
                  {resumen.totalp_objetivo > 0 ? `÷ ${euro(resumen.totalp_objetivo)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right border border-emerald-600 text-xl font-black" colSpan={1}>
                  {resumen.pct_objetivo !== null ? `${resumen.pct_objetivo.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2 border border-emerald-600 text-emerald-300 text-[10px] italic" colSpan={3}>
                  = Imp.a Cobrar total ÷ Objetivo (meses P)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-3.5 rounded bg-blue-50 border border-blue-200" />
          Campo manual (editable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-green-700 font-bold text-sm">+</span>
          Valor positivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-red-600 font-bold text-sm">−</span>
          Valor negativo o penalización
        </span>
        <span className="ml-auto text-slate-400 italic">Los cambios se guardan automáticamente</span>
      </div>

      {/* ── Reference summary ── */}
      <details className="bg-white border border-slate-200 rounded-lg text-xs">
        <summary className="px-4 py-2.5 cursor-pointer font-medium text-slate-600 hover:text-slate-800 select-none">
          Ver tablas de referencia y fórmulas
        </summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <div>
            <p className="font-semibold text-slate-700 mb-1">Productividad (col C)</p>
            <table className="w-full border-collapse">
              <thead><tr className="bg-slate-100"><th className="px-2 py-1 text-left">%Obj</th><th className="px-2 py-1 text-right">€/mes</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {([['< 80%', 0], ['80%', 25], ['90%', 50], ['95%', 75], ['100%', 100], ['105%', 100], ['110%', 100], ['120%', 100]] as [string, number][]).map(([l, v]) =>
                  <tr key={l}><td className="px-2 py-0.5 text-slate-600">{l}</td><td className={`px-2 py-0.5 text-right ${v > 0 ? 'text-green-700' : 'text-slate-400'}`}>{v} €</td></tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 text-slate-400 italic">No se incluye en el TOTAL final</p>
          </div>

          <div>
            <p className="font-semibold text-slate-700 mb-1">Control Documental (col F)</p>
            <table className="w-full border-collapse">
              <thead><tr className="bg-slate-100"><th className="px-2 py-1 text-left">Puntos</th><th className="px-2 py-1 text-right">€/mes</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[[-80,-25],[10,100],[20,100],[30,100],[40,100],[50,75],[60,50],[70,25],[80,0]].map(([p,v]) =>
                  <tr key={p}><td className="px-2 py-0.5 text-slate-600">{p}</td><td className={`px-2 py-0.5 text-right ${v > 0 ? 'text-green-700' : v < 0 ? 'text-red-600' : 'text-slate-400'}`}>{v} €</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Control Visitas (col I)</p>
              <table className="w-full border-collapse">
                <thead><tr className="bg-slate-100"><th className="px-2 py-1 text-left">Estado</th><th className="px-2 py-1 text-right">€/mes</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-2 py-0.5 text-slate-600">OK (100)</td><td className="px-2 py-0.5 text-right text-green-700">25 €</td></tr>
                  <tr><td className="px-2 py-0.5 text-slate-600">KO (−100)</td><td className="px-2 py-0.5 text-right text-red-600">−25 €</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Herramientas · Vehículo · Aseo</p>
              <table className="w-full border-collapse">
                <thead><tr className="bg-slate-100"><th className="px-2 py-1 text-left">Ítem</th><th className="px-2 py-1 text-right">OK</th><th className="px-2 py-1 text-right">KO</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-2 py-0.5 text-slate-600">Herramientas</td><td className="px-2 py-0.5 text-right text-green-700">5 €</td><td className="px-2 py-0.5 text-right text-slate-400">0 €</td></tr>
                  <tr><td className="px-2 py-0.5 text-slate-600">Vehículo</td><td className="px-2 py-0.5 text-right text-green-700">10 €</td><td className="px-2 py-0.5 text-right text-slate-400">0 €</td></tr>
                  <tr><td className="px-2 py-0.5 text-slate-600">Aseo personal</td><td className="px-2 py-0.5 text-right text-green-700">10 €</td><td className="px-2 py-0.5 text-right text-slate-400">0 €</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-semibold text-slate-700 mb-1">Retorno (col M) — %P − %R</p>
            <table className="w-full border-collapse">
              <thead><tr className="bg-slate-100"><th className="px-2 py-1 text-left">%P−%R</th><th className="px-2 py-1 text-right">€/mes</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[['≥ 100',100],['≥ 95',75],['≥ 90',50],['≥ 80',25],['< 80',0]].map(([l,v]) =>
                  <tr key={String(l)}><td className="px-2 py-0.5 text-slate-600">{l}</td><td className={`px-2 py-0.5 text-right ${Number(v) > 0 ? 'text-green-700' : 'text-slate-400'}`}>{v} €</td></tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 text-slate-400 italic">Mismo umbral que Productividad</p>
          </div>

          <div className="sm:col-span-2">
            <p className="font-semibold text-slate-700 mb-1">Horas Improductivas y Penalización</p>
            <div className="space-y-1 text-slate-600">
              <p>Dif = H.Invertidas − H.Objetivo</p>
              <p>% = Dif ÷ H.Objetivo × 100</p>
              <p>Penalización = MAX(Dif, 0) × <strong>{PENALTY_RATE} €/h</strong></p>
            </div>
            <p className="mt-2 font-semibold text-slate-700">TOTAL (col AC)</p>
            <p className="text-slate-600">= CtrlDoc + Visitas + Retorno + Herr + Vehículo + Aseo − Penalización</p>
            <p className="mt-0.5 text-slate-400 italic">Productividad se muestra pero <strong>no</strong> se suma al total mensual</p>
          </div>

        </div>
      </details>

    </div>
  );
}
