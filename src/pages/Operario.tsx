import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  EyeIcon,
  SparklesIcon,
  ClockIcon,
  ListBulletIcon,
  ChartBarIcon,
  TableCellsIcon,
  SignalIcon,
  CalendarDaysIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import TabNav from '../components/TabNav';
import Incidencias from '../tabs/Incidencias';
import ControlCalidad from '../tabs/ControlCalidad';
import Visitas from '../tabs/Visitas';
import Limpieza from '../tabs/Limpieza';
import HorasImproductivas from '../tabs/HorasImproductivas';
import Issus from '../tabs/Issus';
import KPIMensual from '../tabs/KPIMensual';
import KPIDashboard, { buildSummary, rowToMonthData, MESES_FULL } from '../tabs/KPIDashboard';
import type { YearData } from '../tabs/KPIDashboard';
import MisAusencias from '../tabs/MisAusencias';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const JEFE_TABS = [
  { id: '01', label: '01 Incidencias',          Icon: ExclamationTriangleIcon },
  { id: '02', label: '02 Control Calidad',       Icon: CheckBadgeIcon },
  { id: '03', label: '03 Visitas',               Icon: EyeIcon },
  { id: '04', label: '04 Limpieza',              Icon: SparklesIcon },
  { id: '05', label: '05 Horas Improductivas',   Icon: ClockIcon },
  { id: '06', label: '06 ISSUS',                 Icon: ListBulletIcon },
  { id: '07', label: '07 KPI Mensual',           Icon: ChartBarIcon },
];

const OPERARIO_TABS = [
  { id: 'dashboard', label: 'Dashboard',    Icon: ChartBarIcon },
  { id: 'kpi',       label: 'KPI Mensual',  Icon: TableCellsIcon },
  { id: 'semaforo',  label: 'Semáforo KPI', Icon: SignalIcon },
  { id: 'ausencias', label: 'Mis Ausencias', Icon: CalendarDaysIcon },
];

// ─── Semáforo KPI (operario view — single operario) ──────────────────────────

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

function euro(n: number) {
  const abs = Math.abs(n);
  const fmt = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2);
  return `${n < 0 ? '−' : ''}${fmt} €`;
}

function SemaforoOperario({ operario }: { operario: string }) {
  const now = new Date();
  const [año, setAño] = useState(now.getFullYear());
  const [mes, setMes]  = useState(now.getMonth() + 1);
  const [yearData, setYearData] = useState<YearData>({});
  const [kpiRef, setKpiRef]     = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from('kpi_mensual').select('*').eq('año', año).eq('operario', operario),
      supabase.from('kpi_ref').select('valor').eq('año', año).eq('operario', operario).maybeSingle(),
    ]).then(([{ data: rows }, { data: ref }]) => {
      const yd: YearData = {};
      for (const row of rows || []) yd[row.mes] = rowToMonthData(row);
      setYearData(yd);
      setKpiRef(ref ? Number(ref.valor) : 0);
    });
  }, [operario, año]);

  const summary = useMemo(() => buildSummary(operario, yearData, kpiRef), [operario, yearData, kpiRef]);

  const m      = summary.months[mes - 1];
  const cobrar = Math.max(m.total - kpiRef, 0);
  const rag: 'green' | 'amber' | 'red' =
    m.total < 0                          ? 'red'   :
    m.total > 0 && m.total >= kpiRef     ? 'green' : 'amber';

  // Alertas: months with no data
  const maxMes   = año === now.getFullYear() ? now.getMonth() + 1 : 12;
  const faltantes = Array.from({ length: maxMes }, (_, i) => i + 1).filter(n => !yearData[n]);

  return (
    <div className="space-y-4 mt-4">

      {/* Controls */}
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
          {MESES_FULL.map((mn, i) => <option key={i + 1} value={i + 1}>{mn}</option>)}
        </select>
      </div>

      {/* RAG card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-700 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
          Semáforo KPI — {MESES_FULL[mes - 1]} {año}
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-center text-slate-500 font-medium">% Prod.</th>
              <th className="px-3 py-2 text-center text-slate-500 font-medium">Total KPI</th>
              <th className="px-3 py-2 text-center text-slate-500 font-medium">A cobrar</th>
              <th className="px-3 py-2 text-center text-slate-500 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-3 text-center text-slate-600 font-semibold">{m.md.prod_pct}%</td>
              <td className={`px-3 py-3 text-center font-bold text-base ${
                m.total > 0 ? 'text-green-700' : m.total < 0 ? 'text-red-600' : 'text-slate-400'
              }`}>{euro(m.total)}</td>
              <td className={`px-3 py-3 text-center font-semibold ${cobrar > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                {cobrar > 0 ? euro(cobrar) : '—'}
              </td>
              <td className="px-3 py-3 text-center"><RagBadge rag={rag} /></td>
            </tr>
          </tbody>
        </table>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 text-[10px] text-slate-500">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Verde: total ≥ umbral KPI</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Amarillo: positivo, bajo umbral</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Rojo: total negativo</span>
        </div>
      </div>

      {/* Incentivos acumulados anuales */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
          Incentivos acumulados — {año}
        </div>
        <div className="p-4">
          {summary.total_cobrar === 0 ? (
            <p className="text-sm text-slate-400 py-2 text-center">Aún sin superar el umbral KPI en {año}</p>
          ) : (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Total acumulado</span>
                <span className="text-emerald-700 font-semibold">{euro(summary.total_cobrar)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="h-3 rounded-full bg-emerald-500" style={{ width: '100%' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alertas meses sin rellenar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-amber-600 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5">
          Alertas — meses sin datos ({año})
        </div>
        <div className="p-4">
          {faltantes.length === 0 ? (
            <div className="flex items-center gap-2 py-1">
              <span className="text-green-500 text-lg">✓</span>
              <span className="text-sm text-green-700 font-medium">Todos los meses al día</span>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-amber-700">
                Sin datos: {faltantes.map(n => MESES_FULL[n - 1]).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Operario() {
  const { nombre } = useParams<{ nombre: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('');
  const [asignados, setAsignados] = useState<string[]>([]);

  const operario   = decodeURIComponent(nombre || '');
  const isOperario = user?.rol === 'operario';
  const isJefe     = user?.rol === 'jefe';

  useEffect(() => {
    if (!isJefe || !user?.id) return;
    supabase.from('jefe_operario').select('operario_nombre').eq('jefe_id', user.id)
      .then(({ data }) => setAsignados((data || []).map(r => r.operario_nombre)));
  }, [isJefe, user?.id]);

  useEffect(() => {
    setActiveTab(isOperario ? 'dashboard' : '01');
  }, [isOperario]);

  if (!operario) {
    navigate('/seleccionar-operario');
    return null;
  }

  if (isOperario && user?.nombre !== operario) {
    navigate(`/operario/${encodeURIComponent(user?.nombre ?? '')}`);
    return null;
  }

  const readOnly = isJefe && asignados.length > 0 && !asignados.includes(operario);
  const tabs     = isOperario ? OPERARIO_TABS : JEFE_TABS;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        {!isOperario && (
          <button
            onClick={() => navigate('/seleccionar-operario')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-white font-bold text-xl">{operario}</h1>
          <p className="text-blue-300 text-sm">
            {isOperario ? 'Mis registros' : readOnly ? 'Vista de solo lectura' : 'Gestión de registros del operario'}
          </p>
        </div>
      </div>

      <div className="bg-slate-300 rounded-lg p-4 md:p-6">
        {activeTab && (
          <>
            <TabNav tabs={tabs} active={activeTab} onChange={setActiveTab} />
            <div className="mt-4">

              {/* Jefe: formularios 01-07 sin cambio */}
              {!isOperario && (
                <>
                  {activeTab === '01' && <Incidencias operario={operario} readOnly={readOnly} />}
                  {activeTab === '02' && <ControlCalidad operario={operario} readOnly={readOnly} />}
                  {activeTab === '03' && <Visitas operario={operario} readOnly={readOnly} />}
                  {activeTab === '04' && <Limpieza operario={operario} readOnly={readOnly} />}
                  {activeTab === '05' && <HorasImproductivas operario={operario} readOnly={readOnly} />}
                  {activeTab === '06' && <Issus operario={operario} readOnly={readOnly} />}
                  {activeTab === '07' && <KPIMensual operario={operario} />}
                </>
              )}

              {/* Operario: vistas KPI de solo lectura + mis ausencias */}
              {isOperario && (
                <>
                  {activeTab === 'dashboard' && <KPIDashboard operariosFilter={[operario]} />}
                  {activeTab === 'kpi'       && <KPIMensual operario={operario} readOnly={true} />}
                  {activeTab === 'semaforo'  && <SemaforoOperario operario={operario} />}
                  {activeTab === 'ausencias' && <MisAusencias operario={operario} />}
                </>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}
