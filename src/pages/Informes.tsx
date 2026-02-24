import { useState, useEffect } from 'react';
import { DocumentArrowDownIcon, EnvelopeIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateKpiPdf, type ReportParams } from '../utils/pdfReport';
import type { Incidencia, ControlCalidad, Visita, Limpieza, HorasImproductivas } from '../types';

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const currentYear = new Date().getFullYear();
const AÑOS = [currentYear - 1, currentYear, currentYear + 1];

// ─── localStorage helpers (mirror of KPIMensual) ──────────────────────────────

type MonthData = {
  prod_pct: number; ctrl_doc_pts: number; ctrl_vis_pct: number; retorno_pct: number;
  herr_pct: number; vehic_pct: number; aseo_pct: number; h_obj: number; h_inv: number;
  objetivo: number; dietas: number; h_ext: number;
};
type YearData = Record<number, MonthData>;

function loadKpiYear(operario: string, año: number): YearData {
  try {
    const raw = localStorage.getItem(`kpi_mensual:${operario}:${año}`);
    return raw ? (JSON.parse(raw) as YearData) : {};
  } catch { return {}; }
}

function loadKpiRef(operario: string, año: number): number {
  try {
    const raw = localStorage.getItem(`kpi_ref:${operario}:${año}`);
    return raw !== null ? parseFloat(raw) : 0;
  } catch { return 0; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Informes() {
  const { user } = useAuth();

  // Filter state
  const [operarios, setOperarios]     = useState<string[]>([]);
  const [operario, setOperario]       = useState('');
  const [mes, setMes]                 = useState(new Date().getMonth() + 1);
  const [año, setAño]                 = useState(currentYear);

  // Status
  const [loading, setLoading]         = useState(false);
  const [loadingOps, setLoadingOps]   = useState(true);
  const [error, setError]             = useState('');

  // Email config state
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [emailMap, setEmailMap]               = useState<Record<string, string>>({});
  const [savingEmail, setSavingEmail]         = useState(false);
  const [emailSaved, setEmailSaved]           = useState(false);

  // Load operarios
  useEffect(() => {
    if (!user) return;
    if (user.rol === 'admin') {
      supabase.from('operarios').select('nombre').eq('activo', true).then(({ data }) => {
        const names = (data || []).map((r: { nombre: string }) => r.nombre);
        setOperarios(names);
        if (names.length > 0) setOperario(names[0]);
        setLoadingOps(false);
      });
    } else {
      supabase.from('jefe_operario').select('operario_nombre').eq('jefe_id', user.id).then(({ data }) => {
        const names = (data || []).map((r: { operario_nombre: string }) => r.operario_nombre);
        setOperarios(names);
        if (names.length > 0) setOperario(names[0]);
        setLoadingOps(false);
      });
    }
  }, [user]);

  // Load email config
  useEffect(() => {
    if (!operarios.length) return;
    supabase
      .from('email_config')
      .select('operario_nombre, email')
      .in('operario_nombre', operarios)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: { operario_nombre: string; email: string }) => {
          map[r.operario_nombre] = r.email;
        });
        setEmailMap(map);
      });
  }, [operarios]);

  const handleGenerarPdf = async () => {
    if (!operario) return;
    setLoading(true);
    setError('');

    try {
      // Date range for the selected month
      const startDate = `${año}-${String(mes).padStart(2, '0')}-01`;
      const endDate   = new Date(año, mes, 0).toISOString().split('T')[0];

      // Fetch all Supabase data in parallel
      const [incRes, ccRes, visRes, limpRes, hiRes] = await Promise.all([
        supabase.from('incidencias').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
        supabase.from('control_calidad').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
        supabase.from('visitas').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
        supabase.from('limpieza').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
        supabase.from('horas_improductivas').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
      ]);

      const params: ReportParams = {
        operario,
        mes,
        año,
        kpiData:        loadKpiYear(operario, año),
        kpiRef:         loadKpiRef(operario, año),
        incidencias:    (incRes.data  || []) as Incidencia[],
        controlCalidad: (ccRes.data   || []) as ControlCalidad[],
        visitas:        (visRes.data  || []) as Visita[],
        limpieza:       (limpRes.data || []) as Limpieza[],
        horasImprod:    (hiRes.data   || []) as HorasImproductivas[],
      };

      await generateKpiPdf(params);
    } catch (e) {
      console.error(e);
      setError('Error generando el PDF. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async (op: string, email: string) => {
    setSavingEmail(true);
    const { error: upsertErr } = await supabase
      .from('email_config')
      .upsert({ operario_nombre: op, email, activo: true }, { onConflict: 'operario_nombre' });
    if (!upsertErr) {
      setEmailMap(prev => ({ ...prev, [op]: email }));
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    }
    setSavingEmail(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-xl p-5 text-white">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <DocumentArrowDownIcon className="h-6 w-6" />
          Generador de Informes PDF
        </h1>
        <p className="text-blue-200 text-sm mt-1">
          Genera el informe mensual KPI en PDF idéntico al formato oficial ACM Tools.
        </p>
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Filtros del informe</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Operario */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Operario</label>
            {loadingOps ? (
              <div className="h-9 bg-slate-100 rounded animate-pulse" />
            ) : (
              <select
                value={operario}
                onChange={e => setOperario(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              >
                {operarios.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            )}
          </div>

          {/* Mes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mes</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            >
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Año */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
            <select
              value={año}
              onChange={e => setAño(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            >
              {AÑOS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerarPdf}
          disabled={loading || !operario}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-all"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generando PDF...
            </>
          ) : (
            <>
              <DocumentArrowDownIcon className="h-5 w-5" />
              Descargar PDF — {operario || '—'} · {MESES[mes - 1]} {año}
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 mt-2 text-center">
          El PDF incluye 9 secciones: KPI anual, Calidad Documental, Visitas, Retornos, Limpieza, Horas Improductivas, Análisis y más.
        </p>
      </div>

      {/* ─── Email Config ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setShowEmailConfig(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-700">
            <EnvelopeIcon className="h-5 w-5 text-blue-600" />
            Envío automático mensual
          </span>
          <Cog6ToothIcon className={`h-5 w-5 text-slate-400 transition-transform ${showEmailConfig ? 'rotate-90' : ''}`} />
        </button>

        {showEmailConfig && (
          <div className="px-6 pb-6 border-t border-slate-100">
            <p className="text-sm text-slate-500 mt-3 mb-4">
              El sistema enviará automáticamente el informe del mes vencido <strong>el día 1 de cada mes</strong> al email configurado por cada agente.
              Esta función requiere activar la Edge Function en Supabase (ver instrucciones en README).
            </p>

            <div className="space-y-3">
              {operarios.map(op => (
                <div key={op} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700 w-36 shrink-0 truncate">{op}</span>
                  <input
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={emailMap[op] ?? ''}
                    onChange={e => setEmailMap(prev => ({ ...prev, [op]: e.target.value }))}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <button
                    onClick={() => handleSaveEmail(op, emailMap[op] ?? '')}
                    disabled={savingEmail}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 font-medium transition-all disabled:opacity-50"
                  >
                    {savingEmail ? '...' : 'Guardar'}
                  </button>
                </div>
              ))}
            </div>

            {emailSaved && (
              <p className="mt-3 text-sm text-green-600 font-medium">✓ Email guardado correctamente.</p>
            )}

            <div className="mt-5 bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-blue-700 font-semibold mb-1">Para activar el envío automático:</p>
              <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                <li>Despliega la Edge Function <code className="bg-blue-100 px-1 rounded">monthly-kpi-email</code> en Supabase</li>
                <li>Configura las variables de entorno: <code className="bg-blue-100 px-1 rounded">RESEND_API_KEY</code></li>
                <li>Activa pg_cron en Supabase con: <code className="bg-blue-100 px-1 rounded">0 9 1 * *</code> (1º de cada mes a las 9:00)</li>
                <li>Los informes se enviarán automáticamente con los datos del mes anterior</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* ─── Info cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { num: '9', label: 'Secciones en el PDF' },
          { num: '12', label: 'Meses en tabla KPI' },
          { num: 'Auto', label: 'Email día 1 del mes' },
        ].map(c => (
          <div key={c.label} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{c.num}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
