import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  LockClosedIcon,
  ArrowRightIcon,
  EyeSlashIcon,
  EyeIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
  QueueListIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoKPI = 'numerico' | 'escala' | 'binario' | 'calculado';
type TipoRelacion = 'suma' | 'resta' | 'multiplica' | 'condiciona';

interface Tramo {
  desde: number;
  hasta: number | null; // null = sin límite superior
  importe_mensual: number;
}

interface Relacion {
  tipo: TipoRelacion;
  kpi_destino: string;
  condicion: string;
}

interface KPIDefinition {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  modulo: string;
  frecuencia: string;
  activo: boolean;
  tipo: TipoKPI;
  unidad: string;
  contribuye_total: boolean;
  tramos: Tramo[];
  relaciones: Relacion[];
  formula: string;
  aplica_a: string;
  es_base: boolean;
  orden: number;
}

// ─── Base KPIs (exact values from KPIDashboard.tsx) ───────────────────────────

const BASE_KPIS: KPIDefinition[] = [
  {
    id: 'productividad', nombre: 'Productividad', icono: '⚡',
    modulo: '07 KPI Mensual', frecuencia: 'mensual', tipo: 'escala', unidad: '%',
    descripcion: 'Porcentaje de trabajo productivo del mes. Calculado sobre objetivos de horas.',
    contribuye_total: true, es_base: true, activo: true, orden: 1,
    tramos: [
      { desde: 0,  hasta: 79,  importe_mensual: 0 },
      { desde: 80, hasta: 89,  importe_mensual: 25 },
      { desde: 90, hasta: 94,  importe_mensual: 50 },
      { desde: 95, hasta: 99,  importe_mensual: 75 },
      { desde: 100, hasta: null, importe_mensual: 100 },
    ],
    relaciones: [], formula: '', aplica_a: 'todos',
  },
  {
    id: 'ctrl_doc', nombre: 'Control Documentación', icono: '📋',
    modulo: '07 KPI Mensual', frecuencia: 'mensual', tipo: 'escala', unidad: 'pts',
    descripcion: 'Puntuación de control documental (escala 0–80 pts, 80 = sin pendientes).',
    contribuye_total: true, es_base: true, activo: true, orden: 2,
    tramos: [
      { desde: 0,  hasta: 0,   importe_mensual: -25 },
      { desde: 1,  hasta: 49,  importe_mensual: 100 },
      { desde: 50, hasta: 59,  importe_mensual: 75 },
      { desde: 60, hasta: 69,  importe_mensual: 50 },
      { desde: 70, hasta: 79,  importe_mensual: 25 },
      { desde: 80, hasta: null, importe_mensual: 0 },
    ],
    relaciones: [], formula: '', aplica_a: 'todos',
  },
  {
    id: 'ctrl_vis', nombre: 'Control Visitas', icono: '✅',
    modulo: '02 Control Calidad', frecuencia: 'mensual', tipo: 'binario', unidad: '%',
    descripcion: 'Porcentaje de visitas con OK. 100% = +25€, cualquier KO = -25€.',
    contribuye_total: true, es_base: true, activo: true, orden: 3,
    tramos: [], formula: 'ok:25|ko:-25',
    relaciones: [], aplica_a: 'todos',
  },
  {
    id: 'retorno', nombre: 'Retorno de Visitas', icono: '🔄',
    modulo: '07 KPI Mensual', frecuencia: 'mensual', tipo: 'calculado', unidad: '%',
    descripcion: 'Penaliza la Productividad neta: prod_pct − retorno_pct → escala de Productividad.',
    contribuye_total: true, es_base: true, activo: true, orden: 4,
    tramos: [], formula: 'net_pct = prod_pct - retorno_pct → lookupProd()',
    relaciones: [{ tipo: 'resta', kpi_destino: 'productividad', condicion: 'retorno_pct > 0' }],
    aplica_a: 'todos',
  },
  {
    id: 'herramientas', nombre: 'Herramientas', icono: '🔧',
    modulo: '04 Limpieza', frecuencia: 'mensual', tipo: 'binario', unidad: '%',
    descripcion: 'Estado de herramientas. OK = +5€, KO = 0€.',
    contribuye_total: true, es_base: true, activo: true, orden: 5,
    tramos: [], formula: 'ok:5|ko:0',
    relaciones: [], aplica_a: 'todos',
  },
  {
    id: 'vehiculos', nombre: 'Vehículos', icono: '🚗',
    modulo: '04 Limpieza', frecuencia: 'mensual', tipo: 'binario', unidad: '%',
    descripcion: 'Estado del vehículo. OK = +10€, KO = 0€.',
    contribuye_total: true, es_base: true, activo: true, orden: 6,
    tramos: [], formula: 'ok:10|ko:0',
    relaciones: [], aplica_a: 'todos',
  },
  {
    id: 'aseo', nombre: 'Aseo', icono: '🧹',
    modulo: '04 Limpieza', frecuencia: 'mensual', tipo: 'binario', unidad: '%',
    descripcion: 'Estado de aseo personal. OK = +10€, KO = 0€.',
    contribuye_total: true, es_base: true, activo: true, orden: 7,
    tramos: [], formula: 'ok:10|ko:0',
    relaciones: [], aplica_a: 'todos',
  },
  {
    id: 'horas_improductivas', nombre: 'Horas Improductivas', icono: '⏱️',
    modulo: '05 Horas Improd.', frecuencia: 'mensual', tipo: 'calculado', unidad: 'h',
    descripcion: 'Penalización por horas excedidas: max(h_inv − h_obj, 0) × 39€/h.',
    contribuye_total: true, es_base: true, activo: true, orden: 8,
    tramos: [], formula: 'max(h_inv - h_obj, 0) × 39€/h',
    relaciones: [{ tipo: 'resta', kpi_destino: 'total_incentivos', condicion: 'h_inv > h_obj' }],
    aplica_a: 'todos',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function emptyForm(): Omit<KPIDefinition, 'es_base' | 'activo' | 'orden'> {
  return {
    id: '', nombre: '', descripcion: '', icono: '📊',
    modulo: '', frecuencia: 'mensual', tipo: 'numerico',
    unidad: '€', contribuye_total: false,
    tramos: [], relaciones: [], formula: '', aplica_a: 'todos',
  };
}

const TIPO_COLORS: Record<TipoKPI, string> = {
  numerico:  'bg-blue-100 text-blue-700',
  escala:    'bg-purple-100 text-purple-700',
  binario:   'bg-green-100 text-green-700',
  calculado: 'bg-amber-100 text-amber-700',
};

const TIPO_LABELS: Record<TipoKPI, string> = {
  numerico: 'Numérico', escala: 'Escala', binario: 'Binario', calculado: 'Calculado',
};

const RELACION_COLORS: Record<TipoRelacion, string> = {
  suma: 'text-green-600', resta: 'text-red-600',
  multiplica: 'text-blue-600', condiciona: 'text-amber-600',
};

// ─── Wizard form type ─────────────────────────────────────────────────────────
type WizardForm = Omit<KPIDefinition, 'es_base' | 'activo' | 'orden'>;

// ─── Step 1: Identidad ────────────────────────────────────────────────────────

function Step1({ form, setForm, isEditing }: {
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  isEditing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="w-20">
          <label className="block text-xs font-medium text-slate-600 mb-1">Icono</label>
          <input
            value={form.icono}
            onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
            maxLength={4}
            className="w-full bg-slate-100 rounded-lg px-2 py-2 text-2xl text-center outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
          <input
            value={form.nombre}
            onChange={e => setForm(f => ({
              ...f,
              nombre: e.target.value,
              ...(!isEditing ? { id: slugify(e.target.value) } : {}),
            }))}
            placeholder="Ej: Puntualidad"
            className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          {form.id && (
            <p className="text-xs text-slate-400 mt-0.5">
              ID: <code className="bg-slate-100 px-1 rounded">{form.id}</code>
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          rows={2}
          placeholder="Qué mide este KPI y cómo afecta al incentivo..."
          className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Módulo</label>
          <input
            value={form.modulo}
            onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))}
            placeholder="Ej: 08 Puntualidad"
            className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Frecuencia</label>
          <select
            value={form.frecuencia}
            onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))}
            className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="mensual">Mensual</option>
            <option value="semanal">Semanal</option>
            <option value="diario">Diario</option>
            <option value="anual">Anual</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Aplica a</label>
        <select
          value={form.aplica_a}
          onChange={e => setForm(f => ({ ...f, aplica_a: e.target.value }))}
          className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos los operarios</option>
          <option value="asignados">Solo operarios asignados</option>
        </select>
      </div>
    </div>
  );
}

// ─── Step 2: Tipo de medición ─────────────────────────────────────────────────

const UNIDADES_PRESET = ['€', '%', 'h', 'pts', 'u', 'días'];

function Step2({ form, setForm }: {
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
}) {
  const okVal  = form.formula.match(/ok:(-?[\d.]+)/)?.[1] ?? '';
  const koVal  = form.formula.match(/ko:(-?[\d.]+)/)?.[1] ?? '';

  const setOkKo = (ok: string, ko: string) =>
    setForm(f => ({ ...f, formula: `ok:${ok}|ko:${ko}` }));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Tipo de medición *</label>
        <div className="grid grid-cols-2 gap-2">
          {(['numerico', 'escala', 'binario', 'calculado'] as TipoKPI[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, tipo: t }))}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                form.tipo === t ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-medium text-sm text-slate-800">{TIPO_LABELS[t]}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {t === 'numerico'  && 'El operario escribe un valor'}
                {t === 'escala'    && 'Tramos: valor → importe €'}
                {t === 'binario'   && 'OK / KO con importes fijos'}
                {t === 'calculado' && 'Fórmula sobre otros KPIs'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {form.tipo === 'numerico' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unidad del valor</label>
          <div className="flex flex-wrap gap-1.5">
            {UNIDADES_PRESET.map(u => (
              <button
                key={u} type="button"
                onClick={() => setForm(f => ({ ...f, unidad: u }))}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  form.unidad === u
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {u}
              </button>
            ))}
            <input
              value={UNIDADES_PRESET.includes(form.unidad) ? '' : form.unidad}
              onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
              placeholder="Otro…"
              className="w-24 bg-slate-100 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.tipo === 'binario' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Importe si OK (€)</label>
            <input
              type="number"
              value={okVal}
              onChange={e => setOkKo(e.target.value, koVal)}
              placeholder="ej: 25"
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Importe si KO (€)</label>
            <input
              type="number"
              value={koVal}
              onChange={e => setOkKo(okVal, e.target.value)}
              placeholder="ej: -25"
              className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.tipo === 'calculado' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descripción de la fórmula</label>
          <textarea
            value={form.formula}
            onChange={e => setForm(f => ({ ...f, formula: e.target.value }))}
            rows={3}
            placeholder="Ej: sum(Control Calidad) + Limpieza × 0.5 si Productividad ≥ 80%"
            className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            La lógica exacta se implementará en el motor de cálculo por el equipo técnico.
          </p>
        </div>
      )}

      {form.tipo === 'escala' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          En el siguiente paso configurarás los tramos (rango de valores → importe mensual).
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Tramos ───────────────────────────────────────────────────────────

function Step3({ form, setForm }: {
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
}) {
  const addTramo = () => {
    const last = form.tramos[form.tramos.length - 1];
    const desde = last ? (last.hasta !== null ? last.hasta + 1 : 0) : 0;
    setForm(f => ({ ...f, tramos: [...f.tramos, { desde, hasta: null, importe_mensual: 0 }] }));
  };

  const updTramo = (i: number, key: keyof Tramo, val: number | null) =>
    setForm(f => {
      const t = [...f.tramos];
      t[i] = { ...t[i], [key]: val };
      return { ...f, tramos: t };
    });

  const delTramo = (i: number) =>
    setForm(f => ({ ...f, tramos: f.tramos.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Define los rangos y el importe mensual que genera cada uno.</p>
        <button
          type="button"
          onClick={addTramo}
          className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Añadir tramo
        </button>
      </div>

      {form.tramos.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-200">
          Sin tramos. Pulsa "+ Añadir tramo" para empezar.
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Desde</th>
                <th className="px-3 py-2 text-left">Hasta</th>
                <th className="px-3 py-2 text-left">€/mes</th>
                <th className="px-3 py-2 text-left text-slate-400">€/año</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {form.tramos.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={t.desde}
                      onChange={e => updTramo(i, 'desde', Number(e.target.value))}
                      className="w-20 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={t.hasta ?? ''}
                      placeholder="sin límite"
                      onChange={e => updTramo(i, 'hasta', e.target.value ? Number(e.target.value) : null)}
                      className="w-24 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-300"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={t.importe_mensual}
                      onChange={e => updTramo(i, 'importe_mensual', Number(e.target.value))}
                      className="w-20 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-400">
                    {(t.importe_mensual * 12).toFixed(0)}€
                  </td>
                  <td className="px-3 py-1.5">
                    <button type="button" onClick={() => delTramo(i)} className="p-0.5 rounded hover:bg-red-50">
                      <XMarkIcon className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form.tramos.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Vista previa</p>
          <div className="flex flex-wrap gap-1">
            {form.tramos.map((t, i) => (
              <span key={i} className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700">
                {t.desde}–{t.hasta ?? '∞'} → <b className="text-green-700">{t.importe_mensual}€/mes</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Conexiones ───────────────────────────────────────────────────────

function Step4({ form, setForm, allKPIs }: {
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  allKPIs: KPIDefinition[];
}) {
  const destinos = [
    { id: 'total_incentivos', nombre: 'TOTAL incentivos' },
    ...allKPIs.filter(k => k.id !== form.id).map(k => ({ id: k.id, nombre: k.nombre })),
  ];

  const addRel = () =>
    setForm(f => ({ ...f, relaciones: [...f.relaciones, { tipo: 'suma', kpi_destino: 'total_incentivos', condicion: '' }] }));

  const updRel = (i: number, key: keyof Relacion, val: string) =>
    setForm(f => {
      const r = [...f.relaciones];
      r[i] = { ...r[i], [key]: val };
      return { ...f, relaciones: r };
    });

  const delRel = (i: number) =>
    setForm(f => ({ ...f, relaciones: f.relaciones.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <input
          type="checkbox"
          id="contribuye"
          checked={form.contribuye_total}
          onChange={e => setForm(f => ({ ...f, contribuye_total: e.target.checked }))}
          className="w-4 h-4 rounded accent-blue-600"
        />
        <label htmlFor="contribuye" className="text-sm font-medium text-slate-700 cursor-pointer">
          Este KPI contribuye al TOTAL de incentivos del mes
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Relaciones con otros KPIs</p>
          <button
            type="button"
            onClick={addRel}
            className="flex items-center gap-1 text-xs bg-slate-700 text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-600"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Añadir
          </button>
        </div>

        {form.relaciones.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
            Sin relaciones con otros KPIs
          </p>
        ) : (
          <div className="space-y-2">
            {form.relaciones.map((r, i) => (
              <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 flex-wrap">
                <span className="text-xs text-slate-500 font-medium flex-shrink-0">
                  {form.nombre || 'Este KPI'}
                </span>
                <select
                  value={r.tipo}
                  onChange={e => updRel(i, 'tipo', e.target.value)}
                  className="bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="suma">suma a</option>
                  <option value="resta">resta de</option>
                  <option value="multiplica">multiplica</option>
                  <option value="condiciona">condiciona</option>
                </select>
                <select
                  value={r.kpi_destino}
                  onChange={e => updRel(i, 'kpi_destino', e.target.value)}
                  className="flex-1 min-w-0 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {destinos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
                <input
                  value={r.condicion}
                  onChange={e => updRel(i, 'condicion', e.target.value)}
                  placeholder="condición (opcional)"
                  className="w-32 bg-slate-100 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button type="button" onClick={() => delRel(i)} className="p-0.5 rounded hover:bg-red-50 flex-shrink-0">
                  <XMarkIcon className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 5: Resumen ──────────────────────────────────────────────────────────

function StepResumen({ form, allKPIs }: { form: WizardForm; allKPIs: KPIDefinition[] }) {
  const getKPIName = (id: string) =>
    id === 'total_incentivos' ? 'TOTAL incentivos' : (allKPIs.find(k => k.id === id)?.nombre ?? id);

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{form.icono}</span>
        <div>
          <p className="font-bold text-slate-800 text-base">{form.nombre || '(sin nombre)'}</p>
          {form.descripcion && <p className="text-slate-500 text-xs">{form.descripcion}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span className="text-slate-400">Tipo:</span> <span className="font-medium">{TIPO_LABELS[form.tipo]}</span></div>
        <div><span className="text-slate-400">Frecuencia:</span> <span className="font-medium capitalize">{form.frecuencia}</span></div>
        <div><span className="text-slate-400">Módulo:</span> <span className="font-medium">{form.modulo || '—'}</span></div>
        <div><span className="text-slate-400">Aplica a:</span> <span className="font-medium">{form.aplica_a === 'todos' ? 'Todos' : 'Asignados'}</span></div>
        <div>
          <span className="text-slate-400">Contribuye al total:</span>{' '}
          <span className={`font-medium ${form.contribuye_total ? 'text-green-600' : 'text-slate-500'}`}>
            {form.contribuye_total ? 'Sí' : 'No'}
          </span>
        </div>
        {form.tipo === 'numerico' && (
          <div><span className="text-slate-400">Unidad:</span> <span className="font-medium">{form.unidad}</span></div>
        )}
      </div>

      {form.tipo === 'escala' && form.tramos.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Tramos ({form.tramos.length}):</p>
          <div className="flex flex-wrap gap-1">
            {form.tramos.map((t, i) => (
              <span key={i} className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs">
                {t.desde}–{t.hasta ?? '∞'} → <b>{t.importe_mensual}€/mes</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {form.tipo === 'binario' && form.formula && (
        <div className="text-xs">
          <span className="text-slate-400">Importes: </span>
          <span className="font-medium text-green-700">OK {form.formula.match(/ok:(-?[\d.]+)/)?.[1] ?? '?'}€</span>
          {' / '}
          <span className="font-medium text-red-700">KO {form.formula.match(/ko:(-?[\d.]+)/)?.[1] ?? '?'}€</span>
        </div>
      )}

      {form.tipo === 'calculado' && form.formula && (
        <div className="text-xs">
          <span className="text-slate-400">Fórmula: </span>
          <span className="font-mono text-slate-700">{form.formula}</span>
        </div>
      )}

      {form.relaciones.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Relaciones:</p>
          <ul className="space-y-0.5">
            {form.relaciones.map((r, i) => (
              <li key={i} className="text-xs flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-slate-700">{form.nombre}</span>
                <span className={`font-semibold ${RELACION_COLORS[r.tipo]}`}>{r.tipo}</span>
                <span className="font-medium text-slate-700">{getKPIName(r.kpi_destino)}</span>
                {r.condicion && <span className="text-slate-400 italic">si {r.condicion}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Wizard Modal ─────────────────────────────────────────────────────────────

export type { KPIDefinition };
export { BASE_KPIS };

interface WizardStep { n: number; label: string }

export function KPIWizard({ initial, allKPIs, onClose, onSave }: {
  initial?: KPIDefinition;
  allKPIs: KPIDefinition[];
  onClose: () => void;
  onSave: (kpi: KPIDefinition) => void;
}) {
  const isEditing = !!initial;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(
    initial
      ? {
          id: initial.id, nombre: initial.nombre, descripcion: initial.descripcion,
          icono: initial.icono, modulo: initial.modulo, frecuencia: initial.frecuencia,
          tipo: initial.tipo, unidad: initial.unidad, contribuye_total: initial.contribuye_total,
          tramos: initial.tramos, relaciones: initial.relaciones, formula: initial.formula,
          aplica_a: initial.aplica_a,
        }
      : emptyForm()
  );

  // Steps depend on tipo
  const steps: WizardStep[] = [
    { n: 1, label: 'Identidad' },
    { n: 2, label: 'Medición' },
    ...(form.tipo === 'escala' ? [{ n: 3, label: 'Tramos' }] : []),
    { n: 4, label: 'Conexiones' },
    { n: 5, label: 'Resumen' },
  ];

  const idx   = steps.findIndex(s => s.n === step);
  const isFirst = idx === 0;
  const isLast  = idx === steps.length - 1;

  // Guard: if tipo changes away from escala while on step 3, go back to 2
  useEffect(() => {
    if (step === 3 && form.tipo !== 'escala') setStep(2);
  }, [form.tipo, step]);

  const canNext = () => {
    if (step === 1) return form.nombre.trim().length > 0;
    return true;
  };

  const next = () => { if (!isLast) setStep(steps[idx + 1].n); };
  const back = () => { if (!isFirst) setStep(steps[idx - 1].n); };

  const save = () => {
    onSave({
      ...form,
      es_base: false,
      activo: initial?.activo ?? true,
      orden: initial?.orden ?? 100,
    });
  };

  const progress = ((idx + 1) / steps.length) * 100;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-bold text-slate-800">
            {isEditing ? 'Editar KPI' : 'Nuevo KPI'} — {steps[idx].label}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100 flex-shrink-0">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="px-6 pt-3 pb-1 flex items-center gap-1.5 flex-shrink-0">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= idx ? 'bg-blue-500' : 'bg-slate-200'
              }`}
            />
          ))}
          <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
            {idx + 1}/{steps.length}
          </span>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {step === 1 && <Step1 form={form} setForm={setForm} isEditing={isEditing} />}
          {step === 2 && <Step2 form={form} setForm={setForm} />}
          {step === 3 && <Step3 form={form} setForm={setForm} />}
          {step === 4 && <Step4 form={form} setForm={setForm} allKPIs={allKPIs} />}
          {step === 5 && <StepResumen form={form} allKPIs={allKPIs} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <button
            type="button"
            onClick={back}
            disabled={isFirst}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="h-4 w-4" /> Atrás
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={save}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              <CheckCircleIcon className="h-4 w-4" /> Guardar KPI
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={!canNext()}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente <ChevronRightIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mapa de Conexiones ───────────────────────────────────────────────────────

function MapaConexiones({ kpis }: { kpis: KPIDefinition[] }) {
  const withRelations = kpis.filter(k => k.relaciones.length > 0);
  const getKPI = (id: string) =>
    id === 'total_incentivos'
      ? { nombre: 'TOTAL incentivos', icono: '💰' }
      : (kpis.find(k => k.id === id) ?? { nombre: id, icono: '❓' });

  if (withRelations.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No hay relaciones configuradas entre KPIs.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-3">
        Relaciones entre KPIs. El color indica el tipo: <span className="text-green-600 font-medium">suma</span> · <span className="text-red-600 font-medium">resta</span> · <span className="text-blue-600 font-medium">multiplica</span> · <span className="text-amber-600 font-medium">condiciona</span>
      </p>
      {withRelations.map(kpi => (
        <div key={kpi.id} className="flex items-start gap-3 bg-white rounded-lg border border-slate-200 p-3">
          <span className="text-xl mt-0.5 flex-shrink-0">{kpi.icono}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">
              {kpi.nombre}
              {kpi.es_base && (
                <span className="ml-1.5 text-xs text-slate-400 font-normal">(base)</span>
              )}
            </p>
            <div className="mt-1 space-y-1">
              {kpi.relaciones.map((r, i) => {
                const dest = getKPI(r.kpi_destino);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
                    <ArrowRightIcon className={`h-3 w-3 flex-shrink-0 ${RELACION_COLORS[r.tipo]}`} />
                    <span className={`font-semibold ${RELACION_COLORS[r.tipo]}`}>{r.tipo}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-medium text-slate-700">{dest.icono} {dest.nombre}</span>
                    {r.condicion && (
                      <span className="text-slate-400 italic">si {r.condicion}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function GestionKPIsPanel() {
  const [customKPIs, setCustomKPIs] = useState<KPIDefinition[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<'lista' | 'mapa'>('lista');
  const [showWizard, setShowWizard] = useState(false);
  const [editing, setEditing]       = useState<KPIDefinition | null>(null);
  const [needsTable, setNeedsTable] = useState(false);

  const allKPIs = [...BASE_KPIS, ...customKPIs];

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('kpi_definitions') as any)
      .select('*')
      .order('orden');
    if (error?.code === '42P01') {
      setNeedsTable(true);
    } else {
      setNeedsTable(false);
      setCustomKPIs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveKPI = async (kpi: KPIDefinition) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('kpi_definitions') as any).upsert({
      id: kpi.id, nombre: kpi.nombre, descripcion: kpi.descripcion,
      icono: kpi.icono, modulo: kpi.modulo, frecuencia: kpi.frecuencia,
      activo: kpi.activo, tipo: kpi.tipo, unidad: kpi.unidad,
      contribuye_total: kpi.contribuye_total, tramos: kpi.tramos,
      relaciones: kpi.relaciones, formula: kpi.formula,
      aplica_a: kpi.aplica_a, es_base: false, orden: kpi.orden,
      updated_at: new Date().toISOString(),
    });
    setShowWizard(false);
    setEditing(null);
    load();
  };

  const toggleActivo = async (kpi: KPIDefinition) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('kpi_definitions') as any)
      .update({ activo: !kpi.activo, updated_at: new Date().toISOString() })
      .eq('id', kpi.id);
    load();
  };

  const deleteKPI = async (id: string) => {
    if (!confirm('¿Eliminar este KPI? Esta acción no se puede deshacer.')) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('kpi_definitions') as any).delete().eq('id', id);
    load();
  };

  const openEdit = (kpi: KPIDefinition) => { setEditing(kpi); setShowWizard(true); };
  const openNew  = () => { setEditing(null); setShowWizard(true); };

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Cargando KPIs...</div>;

  return (
    <div>
      {/* SQL migration notice */}
      {needsTable && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">Requiere creación de tabla en Supabase</p>
          <p className="text-xs text-amber-700 mb-2">Ejecuta el siguiente SQL en Supabase → SQL Editor:</p>
          <pre className="bg-amber-100 rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS kpi_definitions (
  id               TEXT         PRIMARY KEY,
  nombre           TEXT         NOT NULL,
  descripcion      TEXT         DEFAULT '',
  icono            TEXT         DEFAULT '📊',
  modulo           TEXT         DEFAULT '',
  frecuencia       TEXT         DEFAULT 'mensual',
  activo           BOOLEAN      DEFAULT true,
  tipo             TEXT         NOT NULL,
  unidad           TEXT         DEFAULT '€',
  contribuye_total BOOLEAN      DEFAULT false,
  tramos           JSONB        DEFAULT '[]',
  relaciones       JSONB        DEFAULT '[]',
  formula          TEXT         DEFAULT '',
  aplica_a         TEXT         DEFAULT 'todos',
  es_base          BOOLEAN      DEFAULT false,
  orden            INTEGER      DEFAULT 0,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);`}
          </pre>
          <button onClick={load} className="mt-2 text-xs text-amber-700 underline hover:text-amber-900">
            Reintentar tras ejecutar el SQL →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Gestión de KPIs</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView('lista')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'lista' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <QueueListIcon className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => setView('mapa')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'mapa' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShareIcon className="h-3.5 w-3.5" /> Mapa
            </button>
          </div>

          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4" /> Nuevo KPI
          </button>
        </div>
      </div>

      {/* Info banner */}
      <p className="text-xs text-slate-500 mb-3">
        <LockClosedIcon className="h-3 w-3 inline mr-1 text-slate-400" />
        Los KPIs marcados como <b>Base</b> son los del sistema actual. Son de solo lectura; configura KPIs adicionales con "+ Nuevo KPI".
      </p>

      {/* List view */}
      {view === 'lista' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full">
            <thead className="bg-slate-600 text-slate-100 text-xs">
              <tr>
                <th className="px-3 py-2 text-center w-10"></th>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Módulo</th>
                <th className="px-4 py-2 text-center">Tipo</th>
                <th className="px-4 py-2 text-center hidden md:table-cell">Contribuye</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-sm">
              {allKPIs.map(kpi => (
                <tr key={kpi.id} className={`hover:bg-slate-50 transition-colors ${!kpi.activo ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 text-center text-xl">{kpi.icono}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {kpi.es_base && (
                        <LockClosedIcon className="h-3 w-3 text-slate-300 flex-shrink-0" title="KPI base del sistema" />
                      )}
                      <span className="font-medium text-slate-800">{kpi.nombre}</span>
                    </div>
                    {kpi.descripcion && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{kpi.descripcion}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 hidden sm:table-cell">{kpi.modulo || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[kpi.tipo]}`}>
                      {TIPO_LABELS[kpi.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center hidden md:table-cell">
                    {kpi.contribuye_total
                      ? <span className="text-green-600 text-xs font-medium">Sí</span>
                      : <span className="text-slate-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      kpi.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {kpi.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {kpi.es_base ? (
                      <span className="text-xs text-slate-300">Base</span>
                    ) : (
                      <div className="flex justify-center items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(kpi)}
                          className="p-1 rounded hover:bg-slate-100"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4 text-blue-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActivo(kpi)}
                          className="p-1 rounded hover:bg-slate-100"
                          title={kpi.activo ? 'Desactivar' : 'Activar'}
                        >
                          {kpi.activo
                            ? <EyeSlashIcon className="h-4 w-4 text-amber-500" />
                            : <EyeIcon className="h-4 w-4 text-green-500" />
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteKPI(kpi.id)}
                          className="p-1 rounded hover:bg-red-50"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Map view */}
      {view === 'mapa' && <MapaConexiones kpis={allKPIs} />}

      {/* Wizard */}
      {showWizard && (
        <KPIWizard
          initial={editing ?? undefined}
          allKPIs={allKPIs}
          onClose={() => { setShowWizard(false); setEditing(null); }}
          onSave={saveKPI}
        />
      )}
    </div>
  );
}
