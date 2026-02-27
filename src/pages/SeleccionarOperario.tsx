import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, ChevronRightIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import TabNav from '../components/TabNav';
import DashboardPanel from '../tabs/Dashboard';
import KPIDashboard, { buildSummary, rowToMonthData, MESES, MESES_FULL } from '../tabs/KPIDashboard';
import type { YearData } from '../tabs/KPIDashboard';
import AutorizacionVacaciones from '../tabs/AutorizacionVacaciones';

// ─── Constants ────────────────────────────────────────────────────────────────

const JEFE_TABS = [
  { id: 'tecnicos',   label: 'Técnicos' },
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'kpi',        label: 'KPI Mensual' },
  { id: 'semaforo',   label: 'Semáforo KPI' },
  { id: 'vacaciones', label: 'Autorización Vacaciones' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euro(n: number) {
  const abs = Math.abs(n);
  const fmt = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2);
  return `${n < 0 ? '−' : ''}${fmt} €`;
}

function RagBadge({ rag }: { rag: 'green' | 'amber' | 'red' }) {
  const map = {
    green: { bg: 'bg-green-100 text-green-800 border-green-200', label: 'VERDE',    dot: 'bg-green-500' },
    amber: { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: 'AMARILLO', dot: 'bg-amber-500' },
    red:   { bg: 'bg-red-100   text-red-800   border-red-200',   label: 'ROJO',     dot: 'bg-red-500'   },
  };
  const s = map[rag];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Semáforo KPI Panel ───────────────────────────────────────────────────────

function SemaforoKPIPanel({ operarios }: { operarios: string[] }) {
  const now = new Date();
  const [año, setAño] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  // KPI data from Supabase
  const [yearDataMap, setYearDataMap] = useState<Record<string, YearData>>({});
  const [kpiRefsMap, setKpiRefsMap]   = useState<Record<string, number>>({});

  useEffect(() => {
    if (operarios.length === 0) { setYearDataMap({}); setKpiRefsMap({}); return; }
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
    });
  }, [operarios, año]);

  const summaries = useMemo(
    () => operarios.map(n => buildSummary(n, yearDataMap[n] || {}, kpiRefsMap[n] || 0)),
    [operarios, yearDataMap, kpiRefsMap],
  );

  // ── 1. RAG current month table ──
  const ragRows = useMemo(() => summaries.map(s => {
    const m      = s.months[mes - 1];
    const cobrar = Math.max(m.total - s.kpiRef, 0);
    const rag: 'green' | 'amber' | 'red' =
      m.total < 0                           ? 'red'   :
      (m.total > 0 && m.total >= s.kpiRef)  ? 'green' : 'amber';
    return { nombre: s.nombre, total: m.total, cobrar, rag, kpiRef: s.kpiRef, prod_pct: m.md.prod_pct };
  }).sort((a, b) => b.total - a.total), [summaries, mes]);

  // ── 2. Incentivos acumulados (full year) ──
  const incentivosRows = useMemo(() =>
    summaries
      .map(s => ({ nombre: s.nombre, cobrar: s.total_cobrar }))
      .sort((a, b) => b.cobrar - a.cobrar),
    [summaries],
  );
  const maxIncentivo = Math.max(...incentivosRows.map(r => r.cobrar), 0.01);

  // ── 3. Alertas meses sin rellenar ──
  const alertas = useMemo(() => {
    const nowDate = new Date();
    const maxMes  = año === nowDate.getFullYear() ? nowDate.getMonth() + 1 : 12;
    return operarios.map(nombre => {
      const yearData = yearDataMap[nombre] || {};
      const faltantes = Array.from({ length: maxMes }, (_, i) => i + 1)
        .filter(m => !yearData[m]);
      return { nombre, faltantes };
    }).filter(a => a.faltantes.length > 0);
  }, [operarios, yearDataMap, año]);

  // ── 4. Comparativa productividad ──
  const prodRows = useMemo(() => summaries.map(s => ({
    nombre:   s.nombre,
    prod_pct: s.months[mes - 1].md.prod_pct,
  })).sort((a, b) => b.prod_pct - a.prod_pct), [summaries, mes]);
  const maxProd = Math.max(...prodRows.map(r => r.prod_pct), 0.01);

  if (operarios.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin técnicos asignados</p>;
  }

  return (
    <div className="space-y-4 mt-4">

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm text-sm">
          <button onClick={() => setAño(y => y - 1)} className="px-1 text-slate-400 hover:text-blue-600 font-bold">‹</button>
          <span className="font-bold text-slate-800 w-12 text-center">{año}</span>
          <button onClick={() => setAño(y => y + 1)} className="px-1 text-slate-400 hover:text-blue-600 font-bold">›</button>
        </div>
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className="bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MESES_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <span className="text-xs text-slate-400 italic ml-auto">
          {operarios.length} técnico{operarios.length !== 1 ? 's' : ''} asignados
        </span>
      </div>

      {/* ── 1. RAG Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-700 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
          Semáforo KPI — {MESES_FULL[mes - 1]} {año}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Técnico</th>
                <th className="px-3 py-2 text-center text-slate-500 font-medium">% Prod.</th>
                <th className="px-3 py-2 text-center text-slate-500 font-medium">Total KPI</th>
                <th className="px-3 py-2 text-center text-slate-500 font-medium">A cobrar</th>
                <th className="px-3 py-2 text-center text-slate-500 font-medium">Estado RAG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ragRows.map(r => (
                <tr key={r.nombre} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{r.nombre}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.prod_pct}%</td>
                  <td className={`px-3 py-2.5 text-center font-bold ${
                    r.total > 0 ? 'text-green-700' : r.total < 0 ? 'text-red-600' : 'text-slate-400'
                  }`}>{euro(r.total)}</td>
                  <td className={`px-3 py-2.5 text-center font-semibold ${
                    r.cobrar > 0 ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    {r.cobrar > 0 ? euro(r.cobrar) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <RagBadge rag={r.rag} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 text-[10px] text-slate-500">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Verde: total ≥ umbral KPI</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Amarillo: positivo, bajo umbral</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Rojo: total negativo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── 2. Incentivos acumulados chart ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
            Incentivos acumulados — {año}
          </div>
          <div className="p-4 space-y-3">
            {incentivosRows.every(r => r.cobrar === 0) ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                Ningún técnico supera el umbral KPI en {año}
              </p>
            ) : (
              incentivosRows.map(r => (
                <div key={r.nombre}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[55%]">{r.nombre}</span>
                    <span className={r.cobrar > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {r.cobrar > 0 ? euro(r.cobrar) : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${r.cobrar > 0 ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      style={{ width: `${r.cobrar > 0 ? Math.max(4, (r.cobrar / maxIncentivo) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── 3. Alertas meses sin rellenar ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-amber-600 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
            Alertas — meses sin rellenar ({año})
          </div>
          <div className="p-4 space-y-2">
            {alertas.length === 0 ? (
              <div className="flex items-center gap-2 py-3">
                <span className="text-green-500 text-lg">✓</span>
                <span className="text-sm text-green-700 font-medium">Todos los técnicos al día</span>
              </div>
            ) : (
              alertas.map(a => (
                <div key={a.nombre} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-900">{a.nombre}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Sin datos: {a.faltantes.map(m => MESES[m - 1]).join(', ')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── 4. Comparativa de productividad ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-blue-700 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
          Comparativa de productividad — {MESES_FULL[mes - 1]} {año}
        </div>
        <div className="p-4 space-y-3">
          {prodRows.map((r, i) => (
            <div key={r.nombre}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[10px] w-4 text-right">{i + 1}.</span>
                  <span className="font-medium text-slate-800">{r.nombre}</span>
                </div>
                <span className={`font-bold ${
                  r.prod_pct >= 100 ? 'text-green-700' :
                  r.prod_pct >= 90  ? 'text-amber-600' : 'text-red-600'
                }`}>{r.prod_pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    r.prod_pct >= 100 ? 'bg-green-500' :
                    r.prod_pct >= 90  ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(100, (r.prod_pct / maxProd) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Técnicos Tab ────────────────────────────────────────────────────────────

function TecnicosTab({ operarios, onRemove }: { operarios: string[]; onRemove: (nombre: string) => void }) {
  const navigate = useNavigate();

  if (operarios.length === 0) {
    return (
      <div className="text-slate-500 text-center py-8">
        No tienes operarios asignados. Contacta con el administrador.
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {operarios.map(nombre => (
        <div key={nombre} className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/operario/${encodeURIComponent(nombre)}`)}
            className="flex-1 flex items-center justify-between bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg px-4 py-4 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 rounded-full p-2 group-hover:bg-blue-200 transition-colors">
                <UserIcon className="h-5 w-5 text-blue-600" />
              </div>
              <span className="font-medium text-slate-800">{nombre}</span>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </button>
          <button
            onClick={() => onRemove(nombre)}
            className="p-2.5 rounded-lg border border-red-200 bg-white text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
            title="Eliminar operario de mi lista"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SeleccionarOperario() {
  const { user } = useAuth();
  const [operarios, setOperarios] = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('tecnicos');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('jefe_operario')
      .select('operario_nombre')
      .eq('jefe_id', user.id)
      .then(({ data }) => {
        setOperarios((data || []).map(r => r.operario_nombre));
        setLoading(false);
      });
  }, [user]);

  const removeOperario = async (nombre: string) => {
    if (!user) return;
    if (!confirm(`¿Eliminar al operario "${nombre}"?\nSe eliminará definitivamente del sistema y de todas las asignaciones.`)) return;
    await supabase.from('jefe_operario').delete().eq('operario_nombre', nombre);
    await supabase.from('operarios').delete().eq('nombre', nombre);
    setOperarios(prev => prev.filter(n => n !== nombre));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-300 rounded-lg p-6">
          <div className="text-slate-500 text-center py-8">Cargando técnicos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-300 rounded-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-4">Panel de Jefe</h1>
        <TabNav tabs={JEFE_TABS} active={tab} onChange={setTab} />
        <div className="mt-2">
          {tab === 'tecnicos'   && <TecnicosTab operarios={operarios} onRemove={removeOperario} />}
          {tab === 'dashboard'  && <DashboardPanel operariosFilter={operarios} />}
          {tab === 'kpi'        && <KPIDashboard operariosFilter={operarios} />}
          {tab === 'semaforo'   && <SemaforoKPIPanel operarios={operarios} />}
          {tab === 'vacaciones' && <AutorizacionVacaciones operarios={operarios} />}
        </div>
      </div>
    </div>
  );
}
