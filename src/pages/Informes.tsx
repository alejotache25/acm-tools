import { useState, useEffect } from 'react';
import { DocumentArrowDownIcon, EnvelopeIcon, Cog6ToothIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateKpiPdf, previewKpiPdf, type ReportParams } from '../utils/pdfReport';
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
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingOps, setLoadingOps]   = useState(true);
  const [error, setError]             = useState('');

  // Preview
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);

  // Email config state
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [jefeEmail, setJefeEmail]             = useState('');
  const [emailActivo, setEmailActivo]         = useState(false);
  const [savingEmail, setSavingEmail]         = useState(false);
  const [emailSaved, setEmailSaved]           = useState(false);
  // Legacy — kept to avoid unused-variable warning
  const [emailMap]                            = useState<Record<string, string>>({});

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

  // Load jefe email config
  useEffect(() => {
    if (!user) return;
    supabase
      .from('email_config')
      .select('email, activo')
      .eq('jefe_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setJefeEmail(data.email ?? '');
          setEmailActivo(data.activo ?? false);
        }
      });
  }, [user]);

  const fetchReportParams = async (): Promise<ReportParams> => {
    const startDate = `${año}-${String(mes).padStart(2, '0')}-01`;
    const endDate   = new Date(año, mes, 0).toISOString().split('T')[0];
    const [incRes, ccRes, visRes, limpRes, hiRes] = await Promise.all([
      supabase.from('incidencias').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
      supabase.from('control_calidad').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
      supabase.from('visitas').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
      supabase.from('limpieza').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
      supabase.from('horas_improductivas').select('*').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate).order('fecha'),
    ]);
    return {
      operario, mes, año,
      kpiData:        loadKpiYear(operario, año),
      kpiRef:         loadKpiRef(operario, año),
      incidencias:    (incRes.data  || []) as Incidencia[],
      controlCalidad: (ccRes.data   || []) as ControlCalidad[],
      visitas:        (visRes.data  || []) as Visita[],
      limpieza:       (limpRes.data || []) as Limpieza[],
      horasImprod:    (hiRes.data   || []) as HorasImproductivas[],
    };
  };

  const handleGenerarPdf = async () => {
    if (!operario) return;
    setLoading(true);
    setError('');
    try {
      await generateKpiPdf(await fetchReportParams());
    } catch (e) {
      console.error(e);
      setError(`Error generando el PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!operario) return;
    setLoadingPreview(true);
    setError('');
    try {
      const url = await previewKpiPdf(await fetchReportParams());
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      setError(`Error generando la vista previa: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!user || !jefeEmail.trim()) return;
    setSavingEmail(true);
    const { error: upsertErr } = await supabase
      .from('email_config')
      .upsert({ jefe_id: user.id, email: jefeEmail.trim(), activo: emailActivo }, { onConflict: 'jefe_id' });
    if (!upsertErr) {
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
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

        {/* Buttons */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handlePreview}
            disabled={loadingPreview || loading || !operario}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed text-slate-700 font-semibold rounded-xl py-3 border border-slate-300 transition-all"
          >
            {loadingPreview ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Cargando...
              </>
            ) : (
              <>
                <EyeIcon className="h-5 w-5" />
                Vista previa
              </>
            )}
          </button>

          <button
            onClick={handleGenerarPdf}
            disabled={loading || loadingPreview || !operario}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-all"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generando...
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="h-5 w-5" />
                Descargar PDF
              </>
            )}
          </button>
        </div>

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
            <p className="text-sm text-slate-500 mt-4 mb-4">
              El <strong>día 1 de cada mes</strong> recibirás automáticamente <strong>un email por cada agente</strong> con
              el informe del mes anterior. Configura aquí tu email de recepción.
            </p>

            {/* Jefe email input */}
            <div className="flex items-center gap-3 mb-3">
              <EnvelopeIcon className="h-5 w-5 text-blue-500 shrink-0" />
              <input
                type="email"
                placeholder="tu@email.com"
                value={jefeEmail}
                onChange={e => setJefeEmail(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <div
                onClick={() => setEmailActivo(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${emailActivo ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${emailActivo ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-slate-600">
                {emailActivo ? '✓ Envío automático activado' : 'Envío automático desactivado'}
              </span>
            </label>

            <button
              onClick={handleSaveEmail}
              disabled={savingEmail || !jefeEmail.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-lg py-2 text-sm transition-all"
            >
              {savingEmail ? 'Guardando...' : 'Guardar configuración'}
            </button>

            {emailSaved && (
              <p className="mt-3 text-sm text-green-600 font-medium">✓ Configuración guardada. Recibirás los informes el día 1 de cada mes.</p>
            )}

            {/* Agents preview */}
            {operarios.length > 0 && (
              <div className="mt-4 bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Recibirás informes de {operarios.length} agente{operarios.length > 1 ? 's' : ''}:</p>
                <div className="flex flex-wrap gap-2">
                  {operarios.map(op => (
                    <span key={op} className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-1">{op}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Requiere configuración en Supabase (ver paso a paso):</p>
              <ol className="text-xs text-amber-600 space-y-0.5 list-decimal list-inside">
                <li>Crear tabla <code className="bg-amber-100 px-1 rounded">email_config</code> en Supabase</li>
                <li>Desplegar Edge Function <code className="bg-amber-100 px-1 rounded">monthly-kpi-email</code></li>
                <li>Añadir secret <code className="bg-amber-100 px-1 rounded">RESEND_API_KEY</code></li>
                <li>Activar pg_cron: <code className="bg-amber-100 px-1 rounded">0 9 1 * *</code></li>
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

      {/* ─── Preview Modal ─── */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          {/* Modal header */}
          <div className="flex items-center justify-between bg-blue-900 px-5 py-3 shrink-0">
            <span className="text-white font-semibold text-sm">
              Vista previa — {operario} · {MESES[mes - 1]} {año}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerarPdf}
                disabled={loading}
                className="flex items-center gap-2 bg-white text-blue-900 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Descargar
              </button>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* PDF iframe */}
          <iframe
            src={previewUrl}
            className="flex-1 w-full"
            title="Vista previa del informe"
          />
        </div>
      )}
    </div>
  );
}
