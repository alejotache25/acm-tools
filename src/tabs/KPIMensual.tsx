import { useState, useEffect, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiMensualData {
  mes: number;
  año: number;
  tecnico: string;
  // Section B inputs
  productividad_pct: number;
  control_documental_pts: number;
  control_visitas_pct: number;
  retorno_pct: number;
  herramientas: 'OK' | 'KO';
  vehiculo: 'OK' | 'KO';
  aseo_personal: 'OK' | 'KO';
  horas_improductivas: number;
  // Section A extras
  dietas: number;
  h_extras: number;
  // Calculated (persisted for accumulated reads)
  importe_productividad: number;
  importe_control_doc: number;
  importe_visitas: number;
  importe_retorno: number;
  importe_herramientas: number;
  importe_vehiculo: number;
  importe_aseo: number;
  penalizacion_horas: number;
  total_mes: number;
}

type FormInputs = Pick<
  KpiMensualData,
  | 'productividad_pct'
  | 'control_documental_pts'
  | 'control_visitas_pct'
  | 'retorno_pct'
  | 'herramientas'
  | 'vehiculo'
  | 'aseo_personal'
  | 'horas_improductivas'
  | 'dietas'
  | 'h_extras'
>;

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const OBJETIVO_HORAS = 1.5;
const PVP_HORA = 35;
const NOW = new Date();

// ─── Reference Table Data ─────────────────────────────────────────────────────

const TABLA_PRODUCTIVIDAD = [
  { pct: 80,  mensual: 25,  anual: 0    },   // excepción anual = 0
  { pct: 90,  mensual: 50,  anual: 600  },
  { pct: 95,  mensual: 75,  anual: 900  },
  { pct: 100, mensual: 100, anual: 1200 },
  { pct: 105, mensual: 100, anual: 1200 },
  { pct: 110, mensual: 100, anual: 1200 },
  { pct: 120, mensual: 100, anual: 1200 },
];

const TABLA_CONTROL_DOC = [
  { pts: -80, mensual: -25, anual: -300 },
  { pts: 1,   mensual: 100, anual: 1200 },
  { pts: 10,  mensual: 100, anual: 1200 },
  { pts: 20,  mensual: 100, anual: 1200 },
  { pts: 30,  mensual: 100, anual: 1200 },
  { pts: 40,  mensual: 100, anual: 1200 },
  { pts: 50,  mensual: 75,  anual: 900  },
  { pts: 60,  mensual: 50,  anual: 600  },
  { pts: 70,  mensual: 25,  anual: 300  },
  { pts: 80,  mensual: 0,   anual: 0    },
];

const TABLA_VISITAS = [
  { pts:  100, mensual:  25, anual:  300 },
  { pts: -100, mensual: -25, anual: -300 },
];

const TABLA_OLS = [
  { item: 'Herramientas (OK)', pts:  100, mensual:  5, anual:  60 },
  { item: 'Herramientas (KO)', pts: -100, mensual:  0, anual:   0 },
  { item: 'Vehículo (OK)',     pts:  100, mensual: 10, anual: 120 },
  { item: 'Vehículo (KO)',     pts: -100, mensual:  0, anual:   0 },
  { item: 'Aseo personal (OK)',pts:  100, mensual: 10, anual: 120 },
  { item: 'Aseo personal (KO)',pts: -100, mensual:  0, anual:   0 },
];

// ─── Lookup Functions ─────────────────────────────────────────────────────────

function lookupProductividad(pct: number): number {
  let result = 0;
  for (const row of TABLA_PRODUCTIVIDAD) {
    if (pct >= row.pct) result = row.mensual;
    else break;
  }
  return result;
}

function lookupControlDoc(pts: number): number {
  if (pts >= 80)   return 0;
  if (pts >= 70)   return 25;
  if (pts >= 60)   return 50;
  if (pts >= 50)   return 75;
  if (pts >= 1)    return 100;
  if (pts <= -80)  return -25;
  return 100; // < 1 but > -80: full bonus
}

function lookupVisitas(pct: number): number {
  if (pct >= 100)  return 25;
  if (pct <= -100) return -25;
  return 0;
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

const kpiKey    = (t: string, a: number, m: number) => `kpi_mensual:${t}:${a}:${m}`;
const umbralKey = (t: string, a: number)            => `kpi_umbral:${t}:${a}`;

function loadKpi(tecnico: string, año: number, mes: number): KpiMensualData | null {
  try {
    const raw = localStorage.getItem(kpiKey(tecnico, año, mes));
    return raw ? (JSON.parse(raw) as KpiMensualData) : null;
  } catch { return null; }
}

function saveKpi(data: KpiMensualData): void {
  localStorage.setItem(kpiKey(data.tecnico, data.año, data.mes), JSON.stringify(data));
}

function loadUmbral(tecnico: string, año: number): number {
  try { return JSON.parse(localStorage.getItem(umbralKey(tecnico, año)) || '0') as number; }
  catch { return 0; }
}

function saveUmbral(tecnico: string, año: number, val: number): void {
  localStorage.setItem(umbralKey(tecnico, año), JSON.stringify(val));
}

const defaultForm = (): FormInputs => ({
  productividad_pct: 100,
  control_documental_pts: 1,
  control_visitas_pct: 100,
  retorno_pct: 0,
  herramientas: 'OK',
  vehiculo: 'OK',
  aseo_personal: 'OK',
  horas_improductivas: OBJETIVO_HORAS,
  dietas: 0,
  h_extras: 0,
});

// ─── Helper Components ────────────────────────────────────────────────────────

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-500 text-white text-xs font-medium hover:bg-slate-600 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  );
}

function RefTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table className="min-w-full text-xs">
      <thead className="bg-slate-100">
        <tr>
          {headers.map(h => (
            <th key={h} className="px-3 py-1.5 text-left font-semibold text-slate-600">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50">
            {row.map((cell, j) => <td key={j} className="px-3 py-1.5 text-slate-700">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OKKOToggle({
  value,
  onChange,
}: {
  value: 'OK' | 'KO';
  onChange: (v: 'OK' | 'KO') => void;
}) {
  return (
    <div className="flex gap-1.5 justify-center">
      {(['OK', 'KO'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            value === v
              ? v === 'OK'
                ? 'bg-green-600 text-white shadow-sm scale-105'
                : 'bg-red-600 text-white shadow-sm scale-105'
              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  return n < 0 ? `−${abs} €` : `${abs} €`;
}

function clr(n: number): string {
  if (n > 0) return 'text-green-600';
  if (n < 0) return 'text-red-600';
  return 'text-slate-500';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KPIMensual({ operario }: { operario: string }) {
  const [mes,  setMes]  = useState(NOW.getMonth() + 1);
  const [año,  setAño]  = useState(NOW.getFullYear());
  const [form, setForm] = useState<FormInputs>(defaultForm());
  const [umbral, setUmbral] = useState(0);
  const [showTables, setShowTables] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  // Incrementing this triggers memos to re-read localStorage after a save
  const [tick, setTick] = useState(0);

  // Load stored data when mes / año / operario changes
  useEffect(() => {
    const data = loadKpi(operario, año, mes);
    setForm(
      data
        ? {
            productividad_pct:       data.productividad_pct,
            control_documental_pts:  data.control_documental_pts,
            control_visitas_pct:     data.control_visitas_pct,
            retorno_pct:             data.retorno_pct,
            herramientas:            data.herramientas,
            vehiculo:                data.vehiculo,
            aseo_personal:           data.aseo_personal,
            horas_improductivas:     data.horas_improductivas,
            dietas:                  data.dietas,
            h_extras:                data.h_extras,
          }
        : defaultForm()
    );
  }, [operario, año, mes]);

  useEffect(() => {
    setUmbral(loadUmbral(operario, año));
  }, [operario, año]);

  // ─── Live calculations ─────────────────────────────────────────────────────

  const netProd          = form.productividad_pct - form.retorno_pct;
  const impProductividad = lookupProductividad(netProd);
  const impControlDoc    = lookupControlDoc(form.control_documental_pts);
  const impVisitas       = lookupVisitas(form.control_visitas_pct);
  const impRetorno       = 0;
  const impHerramientas  = form.herramientas  === 'OK' ? 5  : 0;
  const impVehiculo      = form.vehiculo      === 'OK' ? 10 : 0;
  const impAseo          = form.aseo_personal === 'OK' ? 10 : 0;

  const horasDif     = form.horas_improductivas - OBJETIVO_HORAS;
  const horasPctVal  = OBJETIVO_HORAS > 0 ? (horasDif / OBJETIVO_HORAS) * 100 : 0;
  const penalizacion = +(Math.max(horasDif, 0) * PVP_HORA).toFixed(2);

  const totalMes = +(
    impProductividad + impControlDoc + impVisitas + impRetorno +
    impHerramientas + impVehiculo + impAseo - penalizacion
  ).toFixed(2);

  // ─── Accumulated per concept (reads localStorage months 1..mes) ───────────

  const accum = useMemo(() => {
    const r = {
      productividad: 0, control_doc: 0, visitas: 0, retorno: 0,
      herramientas: 0, vehiculo: 0, aseo: 0, total: 0,
    };
    for (let m = 1; m <= mes; m++) {
      const d = loadKpi(operario, año, m);
      if (d) {
        r.productividad += d.importe_productividad;
        r.control_doc   += d.importe_control_doc;
        r.visitas       += d.importe_visitas;
        r.retorno       += d.importe_retorno;
        r.herramientas  += d.importe_herramientas;
        r.vehiculo      += d.importe_vehiculo;
        r.aseo          += d.importe_aseo;
        r.total         += d.total_mes;
      }
    }
    return r;
  }, [operario, año, mes, tick]);

  // ─── Annual summary rows ──────────────────────────────────────────────────

  const annualRows = useMemo(() => {
    let runningTotal   = 0;
    let runningCobrar  = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const m      = i + 1;
      const stored = loadKpi(operario, año, m)?.total_mes ?? null;
      const imp    = stored ?? 0;
      runningTotal  += imp;
      const cobrar  = Math.max(imp - umbral, 0);
      runningCobrar += cobrar;
      return { mes: m, stored, imp, acum: runningTotal, cobrar, acumCobrar: runningCobrar };
    });
  }, [operario, año, umbral, tick]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const set = <K extends keyof FormInputs>(k: K, v: FormInputs[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const data: KpiMensualData = {
      mes, año, tecnico: operario,
      ...form,
      importe_productividad: impProductividad,
      importe_control_doc:   impControlDoc,
      importe_visitas:       impVisitas,
      importe_retorno:       impRetorno,
      importe_herramientas:  impHerramientas,
      importe_vehiculo:      impVehiculo,
      importe_aseo:          impAseo,
      penalizacion_horas:    penalizacion,
      total_mes:             totalMes,
    };
    saveKpi(data);
    saveUmbral(operario, año, umbral);
    setTick(t => t + 1);
    setSaveMsg(`✓ Guardado — ${MESES[mes - 1]} ${año}`);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Global Header: Mes + Año ── */}
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-800 border border-blue-700 rounded-xl px-5 py-3">
        <span className="text-white font-bold text-sm tracking-wide">KPI Mensual</span>
        <span className="text-blue-500">·</span>

        <div className="flex items-center gap-2">
          <label className="text-blue-300 text-xs font-medium">Mes</label>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
          >
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-blue-300 text-xs font-medium">Año</label>
          <input
            type="number"
            value={año}
            onChange={e => setAño(Number(e.target.value))}
            className="bg-blue-800 text-white border border-blue-600 rounded-lg px-3 py-1.5 text-sm w-24 outline-none focus:ring-2 focus:ring-cyan-400 text-center"
          />
        </div>

        <span className="ml-auto text-blue-400 text-xs italic">{operario}</span>
      </div>

      {/* ── Reference Tables (collapsible) ── */}
      <div className="bg-slate-300 rounded-lg p-4">
        <button
          type="button"
          onClick={() => setShowTables(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-700 transition-colors"
        >
          {showTables
            ? <ChevronUpIcon className="h-4 w-4" />
            : <ChevronDownIcon className="h-4 w-4" />}
          {showTables ? 'Ocultar tablas de referencia' : 'Ver tablas de referencia'}
        </button>

        {showTables && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <Collapsible title="Tabla 1 — Productividad">
              <RefTable
                headers={['% Consecución', 'Mensual €', 'Anual €']}
                rows={TABLA_PRODUCTIVIDAD.map(r => [`${r.pct}%`, `${r.mensual} €`, `${r.anual} €`])}
              />
            </Collapsible>

            <Collapsible title="Tabla 2 — Control Documental">
              <RefTable
                headers={['Puntos', 'Mensual €', 'Anual €']}
                rows={TABLA_CONTROL_DOC.map(r => [`${r.pts} pts`, `${r.mensual} €`, `${r.anual} €`])}
              />
            </Collapsible>

            <Collapsible title="Tabla 3 — Control Visitas">
              <RefTable
                headers={['Objetivo', 'Mensual €', 'Anual €']}
                rows={TABLA_VISITAS.map(r => [`${r.pts} pts`, `${r.mensual} €`, `${r.anual} €`])}
              />
            </Collapsible>

            <Collapsible title="Tabla 4 — Orden, Limpieza y Seguridad">
              <RefTable
                headers={['Ítem', 'Puntos', 'Mensual €', 'Anual €']}
                rows={TABLA_OLS.map(r => [r.item, `${r.pts} pts`, `${r.mensual} €`, `${r.anual} €`])}
              />
            </Collapsible>

            <Collapsible title="Tabla 5 — Horas Improductivas">
              <div className="p-3 text-xs text-slate-700 space-y-1.5">
                <div className="flex gap-6">
                  <span>Objetivo: <strong>{OBJETIVO_HORAS}h</strong></span>
                  <span>PVP: <strong>{PVP_HORA} €/h</strong></span>
                </div>
                <div>Diferencia = invertidas − objetivo</div>
                <div>% = diferencia / objetivo × 100</div>
                <div>Penalización = MAX(diferencia, 0) × {PVP_HORA} €</div>
              </div>
            </Collapsible>

            <Collapsible title="Tabla 6 — Retornos">
              <div className="p-3 text-xs text-slate-700 space-y-1">
                <div>Objetivo: <strong>0</strong></div>
                <div className="text-slate-500 italic">
                  Las horas de retorno restan de la productividad (% P − % R).
                </div>
              </div>
            </Collapsible>
          </div>
        )}
      </div>

      {/* ── Section B — Cuadro Mensual ── */}
      <div className="bg-slate-300 rounded-lg p-4">
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4">
          Sección B — Cuadro Mensual · {MESES[mes - 1]} {año}
        </h3>

        {/* Horas Improductivas inline (only manual input in this block) */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3 flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">Horas Improductivas</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Horas invertidas</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.horas_improductivas}
              onChange={e => set('horas_improductivas', parseFloat(e.target.value) || 0)}
              className="w-20 bg-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <span>Obj: <strong>{OBJETIVO_HORAS}h</strong></span>
            <span>
              Dif:{' '}
              <strong className={horasDif > 0 ? 'text-red-600' : 'text-green-600'}>
                {horasDif >= 0 ? '+' : ''}{horasDif.toFixed(2)}h
              </strong>
            </span>
            <span>%: <strong>{horasPctVal.toFixed(1)}%</strong></span>
            {penalizacion > 0
              ? <span className="text-red-600 font-bold">Penalización: −{penalizacion.toFixed(2)} €</span>
              : <span className="text-green-600">Sin penalización ✓</span>
            }
          </div>
        </div>

        {/* KPI table */}
        <div className="overflow-x-auto rounded-lg">
          <table className="min-w-full">
            <thead className="bg-slate-600 text-slate-100 text-sm">
              <tr>
                <th className="px-3 py-2.5 text-left w-44">CONCEPTO</th>
                <th className="px-3 py-2.5 text-center">INPUT / % OBJ</th>
                <th className="px-3 py-2.5 text-right">IMPORTE €</th>
                <th className="px-3 py-2.5 text-right">ACUMULADO €</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">

              {/* Productividad */}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-800">Productividad</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number" step="1"
                      value={form.productividad_pct}
                      onChange={e => set('productividad_pct', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-100 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="text-slate-400 text-xs">%</span>
                  </div>
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${clr(impProductividad)}`}>
                  {fmt(impProductividad)}
                </td>
                <td className={`px-3 py-2.5 text-right ${clr(accum.productividad)}`}>
                  {fmt(accum.productividad)}
                </td>
              </tr>

              {/* Control Documental */}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-800">Control Documental</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number" step="1"
                      value={form.control_documental_pts}
                      onChange={e => set('control_documental_pts', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-100 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="text-slate-400 text-xs">pts</span>
                  </div>
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${clr(impControlDoc)}`}>
                  {fmt(impControlDoc)}
                </td>
                <td className={`px-3 py-2.5 text-right ${clr(accum.control_doc)}`}>
                  {fmt(accum.control_doc)}
                </td>
              </tr>

              {/* Control Visitas */}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-800">Control Visitas</td>
                <td className="px-3 py-2.5 text-center">
                  <select
                    value={form.control_visitas_pct}
                    onChange={e => set('control_visitas_pct', Number(e.target.value))}
                    className="bg-slate-100 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={100}>100 — OK (+25 €)</option>
                    <option value={-100}>−100 — NOK (−25 €)</option>
                  </select>
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${clr(impVisitas)}`}>
                  {fmt(impVisitas)}
                </td>
                <td className={`px-3 py-2.5 text-right ${clr(accum.visitas)}`}>
                  {fmt(accum.visitas)}
                </td>
              </tr>

              {/* Retorno */}
              <tr className="hover:bg-blue-50 bg-blue-50/40">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-slate-800">Retorno</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    % P − % R ={' '}
                    <strong className="text-blue-700">{netProd}%</strong>
                    <span className="ml-2 text-slate-400">(prod. neta)</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number" step="1" min="0"
                      value={form.retorno_pct}
                      onChange={e => set('retorno_pct', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-100 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="text-slate-400 text-xs">%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-slate-400 text-xs italic">— (afecta % prod.)</td>
                <td className="px-3 py-2.5 text-right text-slate-400">—</td>
              </tr>

              {/* Herramientas */}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-800">Herramientas</td>
                <td className="px-3 py-2.5">
                  <OKKOToggle value={form.herramientas} onChange={v => set('herramientas', v)} />
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${clr(impHerramientas)}`}>
                  {fmt(impHerramientas)}
                </td>
                <td className={`px-3 py-2.5 text-right ${clr(accum.herramientas)}`}>
                  {fmt(accum.herramientas)}
                </td>
              </tr>

              {/* Vehículo */}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-800">Vehículo</td>
                <td className="px-3 py-2.5">
                  <OKKOToggle value={form.vehiculo} onChange={v => set('vehiculo', v)} />
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${clr(impVehiculo)}`}>
                  {fmt(impVehiculo)}
                </td>
                <td className={`px-3 py-2.5 text-right ${clr(accum.vehiculo)}`}>
                  {fmt(accum.vehiculo)}
                </td>
              </tr>

              {/* Aseo Personal */}
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-800">Aseo Personal</td>
                <td className="px-3 py-2.5">
                  <OKKOToggle value={form.aseo_personal} onChange={v => set('aseo_personal', v)} />
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${clr(impAseo)}`}>
                  {fmt(impAseo)}
                </td>
                <td className={`px-3 py-2.5 text-right ${clr(accum.aseo)}`}>
                  {fmt(accum.aseo)}
                </td>
              </tr>

              {/* Penalización horas (only shown when > 0) */}
              {penalizacion > 0 && (
                <tr className="bg-red-50">
                  <td className="px-3 py-2 text-red-700 font-medium text-sm">
                    Penalización H. Improductivas
                  </td>
                  <td className="px-3 py-2 text-center text-red-500 text-xs">
                    {horasDif.toFixed(2)}h exceso × {PVP_HORA} €/h
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-red-600">
                    {fmt(-penalizacion)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              )}

              {/* TOTAL */}
              <tr className="bg-slate-700 text-white">
                <td className="px-3 py-3 font-bold text-base">TOTAL</td>
                <td className="px-3 py-3" />
                <td className={`px-3 py-3 text-right font-bold text-lg ${totalMes >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {fmt(totalMes)}
                </td>
                <td className={`px-3 py-3 text-right font-semibold ${accum.total >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {fmt(accum.total)}
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold px-8 py-3 rounded-xl text-sm shadow-lg transition-all"
        >
          💾 Guardar — {MESES[mes - 1]} {año}
        </button>
        {saveMsg && (
          <span className="text-green-700 font-semibold text-sm bg-green-100 px-3 py-1.5 rounded-lg animate-pulse">
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Section A — Resumen Incentivos Anual ── */}
      <div className="bg-slate-300 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
            Sección A — Resumen Incentivos · {año}
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-slate-600 text-xs font-medium">Umbral mínimo</label>
            <input
              type="number" step="1" min="0"
              value={umbral}
              onChange={e => setUmbral(parseFloat(e.target.value) || 0)}
              className="w-24 bg-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
            <span className="text-slate-500 text-xs">€</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg mb-4">
          <table className="min-w-full">
            <thead className="bg-slate-600 text-slate-100 text-sm">
              <tr>
                <th className="px-3 py-2.5 text-left">MES</th>
                <th className="px-3 py-2.5 text-right">IMPORTE €</th>
                <th className="px-3 py-2.5 text-right">ACUMULADO €</th>
                <th className="px-3 py-2.5 text-right">A COBRAR €</th>
                <th className="px-3 py-2.5 text-right">ACUM. COBRAR €</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {annualRows
                .filter(row => row.stored !== null || row.mes === mes)
                .map(row => {
                  const isActive      = row.mes === mes;
                  const hasData       = row.stored !== null;
                  // For active unsaved month, preview current calculated total
                  const displayImp    = hasData ? row.stored! : totalMes;
                  const displayCobrar = Math.max(displayImp - umbral, 0);

                  return (
                    <tr
                      key={row.mes}
                      className={
                        isActive
                          ? 'bg-blue-50 ring-2 ring-inset ring-blue-400 font-semibold'
                          : 'hover:bg-gray-50'
                      }
                    >
                      <td className="px-3 py-2 text-slate-800">
                        {MESES[row.mes - 1]}
                        {isActive && (
                          <span className="ml-2 text-blue-500 text-xs font-normal">
                            ← activo{!hasData ? ' (preview)' : ''}
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right ${clr(displayImp)}`}>
                        {fmt(displayImp)}{!hasData && isActive ? ' *' : ''}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(row.acum)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${displayCobrar > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                        {fmt(displayCobrar)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(row.acumCobrar)}</td>
                    </tr>
                  );
                })}
              {annualRows.every(r => r.stored === null) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Sin datos guardados para {año}. Guarda el mes actual para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dietas & H. Extras for the active month */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Dietas € — {MESES[mes - 1]} {año}
            </label>
            <input
              type="number" step="0.01" min="0"
              value={form.dietas}
              onChange={e => set('dietas', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="bg-white rounded-lg p-3">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              H. Extras € — {MESES[mes - 1]} {año}
            </label>
            <input
              type="number" step="0.01" min="0"
              value={form.h_extras}
              onChange={e => set('h_extras', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
