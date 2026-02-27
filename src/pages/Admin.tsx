import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import TabNav from '../components/TabNav';
import Modal from '../components/Modal';
import DashboardPanel from '../tabs/Dashboard';
import KPIDashboard from '../tabs/KPIDashboard';
import GestionKPIsPanel from '../components/GestionKPIsPanel';
import { supabase } from '../lib/supabase';
import type { Operario, Usuario, UserRole } from '../types';

async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TABS = [
  { id: 'dashboard',      label: 'Dashboard' },
  { id: 'kpi',            label: 'KPI Mensual' },
  { id: 'autorizaciones', label: 'Autorizaciones' },
  { id: 'kpis',           label: 'Gestión KPIs' },
  { id: 'permisos',       label: 'Permisos y Roles' },
  { id: 'operarios',      label: 'Operarios' },
  { id: 'jefes',          label: 'Jefes' },
  { id: 'usuarios',       label: 'Usuarios Operario' },
  { id: 'config',         label: 'Configuración' },
];

// ─── Autorizaciones Panel ─────────────────────────────────────────────────────

interface Solicitud {
  id: string;
  tipo: string;
  tabla: string;
  registro_id: string;
  registro_resumen: string;
  motivo: string;
  solicitante: string;
  solicitante_rol: string;
  estado: string;
  admin_nota: string | null;
  created_at: string;
}

const ESTADO_TABS = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobada',  label: 'Aprobadas' },
  { id: 'rechazada', label: 'Rechazadas' },
];

function AutorizacionesPanel() {
  const [solicitudes, setSolicitudes]   = useState<Solicitud[]>([]);
  const [filtro, setFiltro]             = useState<'pendiente' | 'aprobada' | 'rechazada'>('pendiente');
  const [loading, setLoading]           = useState(true);
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [nota, setNota]                 = useState('');

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('solicitudes') as any)
      .select('*')
      .order('created_at', { ascending: false });
    setSolicitudes(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const aprobar = async (sol: Solicitud) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from(sol.tabla) as any).delete().eq('id', sol.registro_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('solicitudes') as any)
      .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
      .eq('id', sol.id);
    load();
  };

  const rechazar = async (sol: Solicitud) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('solicitudes') as any)
      .update({ estado: 'rechazada', admin_nota: nota.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', sol.id);
    setRechazandoId(null);
    setNota('');
    load();
  };

  const visible      = solicitudes.filter(s => s.estado === filtro);
  const pendingCount = solicitudes.filter(s => s.estado === 'pendiente').length;

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Cargando solicitudes...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Autorizaciones de borrado</h2>
        <button onClick={load} className="text-xs text-slate-500 hover:text-blue-600 underline">Actualizar</button>
      </div>

      {/* Estado filter tabs */}
      <div className="flex gap-2 mb-4">
        {ESTADO_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFiltro(t.id as typeof filtro)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {t.label}
            {t.id === 'pendiente' && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Solicitudes list */}
      <div className="space-y-3">
        {visible.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-lg border border-slate-200">
            No hay solicitudes {filtro === 'pendiente' ? 'pendientes' : filtro === 'aprobada' ? 'aprobadas' : 'rechazadas'}
          </div>
        )}

        {visible.map(sol => (
          <div key={sol.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{sol.tabla}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-500">{sol.solicitante} ({sol.solicitante_rol})</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">
                    {new Date(sol.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                {/* Record summary */}
                <p className="text-sm font-medium text-slate-800 mb-1">{sol.registro_resumen}</p>
                <p className="text-xs text-slate-600">
                  <span className="font-medium">Motivo:</span> {sol.motivo}
                </p>
                {sol.admin_nota && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium">Nota:</span> {sol.admin_nota}
                  </p>
                )}
              </div>

              {/* Actions / badge */}
              {filtro === 'pendiente' ? (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => aprobar(sol)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Aprobar
                  </button>
                  <button
                    onClick={() => { setRechazandoId(sol.id); setNota(''); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Rechazar
                  </button>
                </div>
              ) : (
                <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${
                  sol.estado === 'aprobada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {sol.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                </span>
              )}
            </div>

            {/* Inline rejection form */}
            {rechazandoId === sol.id && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Motivo del rechazo (opcional)</label>
                <div className="flex gap-2">
                  <input
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Explica el motivo..."
                    className="flex-1 bg-slate-100 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    onClick={() => rechazar(sol)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setRechazandoId(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-600 text-xs hover:bg-slate-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Permisos y Roles Panel ───────────────────────────────────────────────────
interface PermisoDef {
  id: string;
  grupo: string;
  label: string;
  desc: string;
  defaults: { jefe: boolean; operario: boolean };
}

const PERMISOS_DEF: PermisoDef[] = [
  // Acceso a datos
  { id: 'ver_datos_equipo',      grupo: 'Acceso a datos',  label: 'Ver datos del equipo',           desc: 'Consultar registros de los operarios asignados',              defaults: { jefe: true,  operario: false } },
  { id: 'editar_datos',          grupo: 'Acceso a datos',  label: 'Editar datos de operarios',      desc: 'Rellenar módulos: incidencias, calidad, visitas, limpieza…',  defaults: { jefe: true,  operario: false } },
  { id: 'ver_datos_propios',     grupo: 'Acceso a datos',  label: 'Ver solo datos propios',         desc: 'Acceso limitado a los propios registros sin ver al equipo',   defaults: { jefe: false, operario: true  } },
  // KPI
  { id: 'rellenar_kpi',          grupo: 'KPI',             label: 'Rellenar KPI mes activo',        desc: 'Introducir datos en el mes en curso',                         defaults: { jefe: true,  operario: true  } },
  { id: 'consultar_historico',   grupo: 'KPI',             label: 'Histórico solo lectura',         desc: 'Ver meses anteriores sin poder modificarlos',                 defaults: { jefe: true,  operario: true  } },
  { id: 'editar_mes_cerrado',    grupo: 'KPI',             label: 'Editar mes cerrado',             desc: 'Reabrir un mes bloqueado para realizar correcciones',         defaults: { jefe: false, operario: false } },
  { id: 'validar_kpi',           grupo: 'KPI',             label: 'Validar KPI mensual',            desc: 'Dar el visto bueno antes de que se congele el periodo',       defaults: { jefe: true,  operario: false } },
  // Visualización
  { id: 'ver_incentivos_equipo', grupo: 'Visualización',   label: 'Ver incentivos del equipo',      desc: 'Ver importes e incentivos de los operarios asignados',        defaults: { jefe: true,  operario: false } },
  { id: 'ver_dashboard_global',  grupo: 'Visualización',   label: 'Dashboard global de KPIs',       desc: 'Ver KPIs consolidados de todos los técnicos',                 defaults: { jefe: false, operario: false } },
  // Exportación
  { id: 'exportar_datos',        grupo: 'Exportación',     label: 'Exportar informes',              desc: 'Descargar reportes PDF de técnicos y periodos',               defaults: { jefe: true,  operario: false } },
  // Configuración
  { id: 'modificar_tablas_ref',  grupo: 'Configuración',   label: 'Modificar tablas de referencia', desc: 'Editar importes, objetivos y umbrales de incentivos',         defaults: { jefe: false, operario: false } },
  { id: 'gestionar_usuarios',    grupo: 'Configuración',   label: 'Gestionar usuarios',             desc: 'Crear, desactivar y asignar roles a los usuarios',            defaults: { jefe: false, operario: false } },
  { id: 'abrir_cerrar_periodos', grupo: 'Configuración',   label: 'Abrir / cerrar periodos',        desc: 'Controlar el bloqueo de edición de meses cerrados',           defaults: { jefe: false, operario: false } },
  { id: 'configurar_incentivos', grupo: 'Configuración',   label: 'Configurar incentivos',          desc: 'Ajustar umbrales mínimos y fórmula de cálculo',               defaults: { jefe: false, operario: false } },
];

type RolPermisos = Record<string, boolean>;
type PermisosConfig = { jefe: RolPermisos; operario: RolPermisos };

const GRUPOS_PERMISOS = [...new Set(PERMISOS_DEF.map(p => p.grupo))];

function buildDefaults(): PermisosConfig {
  const r: PermisosConfig = { jefe: {}, operario: {} };
  for (const p of PERMISOS_DEF) {
    r.jefe[p.id] = p.defaults.jefe;
    r.operario[p.id] = p.defaults.operario;
  }
  return r;
}

function RolToggle({ checked, onChange, disabled = false }: { checked: boolean; onChange?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={disabled ? undefined : onChange}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${
        disabled
          ? checked ? 'bg-purple-400 cursor-default' : 'bg-slate-200 cursor-default'
          : checked ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-slate-300 hover:bg-slate-400 cursor-pointer'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function PermisosPanel() {
  const [configId, setConfigId] = useState<string | null>(null);
  const [permisos, setPermisos] = useState<PermisosConfig>(buildDefaults());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);

  useEffect(() => {
    supabase.from('config').select('*').order('id').limit(1).maybeSingle().then(({ data, error }) => {
      if (error) { setLoading(false); return; }
      if (data) {
        setConfigId(data.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (data as any).permisos_roles;
        if (raw && typeof raw === 'object') {
          const loaded = raw as PermisosConfig;
          const merged = buildDefaults();
          if (loaded.jefe)    Object.assign(merged.jefe,    loaded.jefe);
          if (loaded.operario) Object.assign(merged.operario, loaded.operario);
          setPermisos(merged);
        } else if (raw === undefined) {
          setNeedsMigration(true);
        }
      }
      setLoading(false);
    });
  }, []);

  const toggle = (rol: 'jefe' | 'operario', id: string) =>
    setPermisos(p => ({ ...p, [rol]: { ...p[rol], [id]: !p[rol][id] } }));

  const save = async () => {
    if (!configId) {
      setSaveError('No se encontró la fila de configuración. Recarga la página.');
      return;
    }
    setSaveError('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('config') as any)
      .update({ permisos_roles: permisos })
      .eq('id', configId)
      .select('id')
      .single();
    if (error) {
      setSaveError(`Error al guardar: ${error.message}`);
      return;
    }
    if (!data) {
      setSaveError('La base de datos no actualizó ninguna fila. Comprueba las políticas RLS de la tabla "config" en Supabase (necesita permiso UPDATE).');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Cargando permisos...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Permisos y Roles</h2>
        </div>
        <button
          onClick={save}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {saved ? '¡Guardado!' : 'Guardar cambios'}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {needsMigration && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">Requiere migración de base de datos</p>
          <p className="text-amber-700 text-xs font-mono bg-amber-100 rounded px-2 py-1">
            ALTER TABLE config ADD COLUMN IF NOT EXISTS permisos_roles JSONB;
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-5 text-xs">
        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Jefe / Supervisor
        </span>
        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" /> Operario
        </span>
        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Admin (acceso total)
        </span>
      </div>

      {/* Matrix by group */}
      <div className="space-y-4">
        {GRUPOS_PERMISOS.map(grupo => (
          <div key={grupo} className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-200">
            <div className="bg-slate-600 text-slate-100 text-xs font-semibold uppercase tracking-wider px-4 py-2">
              {grupo}
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Permiso</th>
                  <th className="px-4 py-2 text-center text-xs text-blue-600 font-semibold w-24">Jefe</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500 font-semibold w-24">Operario</th>
                  <th className="px-4 py-2 text-center text-xs text-purple-600 font-semibold w-24">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISOS_DEF.filter(p => p.grupo === grupo).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-800">{p.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.desc}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <RolToggle
                          checked={permisos.jefe[p.id] ?? p.defaults.jefe}
                          onChange={() => toggle('jefe', p.id)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <RolToggle
                          checked={permisos.operario[p.id] ?? p.defaults.operario}
                          onChange={() => toggle('operario', p.id)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <RolToggle checked disabled />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Los cambios configuran los permisos predeterminados de cada rol. Para gestionar usuarios y asignaciones, usa las pestañas Jefes y Usuarios Operario.
      </p>
    </div>
  );
}

// ─── Operarios Panel ─────────────────────────────────────────────────────────
function OperariosPanel() {
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Operario | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', activo: true, pin: '' });

  const load = async () => {
    const { data } = await supabase.from('operarios').select('*').order('nombre');
    setOperarios(data || []);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ nombre: '', email: '', activo: true, pin: '' }); setShowModal(true); };
  const openEdit = (o: Operario) => { setEditing(o); setForm({ nombre: o.nombre, email: o.email || '', activo: o.activo, pin: '' }); setShowModal(true); };

  const del = async (o: Operario) => {
    if (!confirm(`¿Eliminar el operario "${o.nombre}"?\nSe eliminará de todas las asignaciones de jefes y su acceso al sistema.\nEsta acción no se puede deshacer.`)) return;
    await supabase.from('jefe_operario').delete().eq('operario_nombre', o.nombre);
    await supabase.from('usuarios').delete().eq('nombre', o.nombre).eq('rol', 'operario');
    await supabase.from('operarios').delete().eq('id', o.id);
    load();
  };

  const save = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) return;
    if (editing) {
      // Update operario record
      await supabase.from('operarios').update({ nombre, email: form.email, activo: form.activo }).eq('id', editing.id);
      // If name changed, update related tables
      if (nombre !== editing.nombre) {
        await supabase.from('usuarios').update({ nombre }).eq('nombre', editing.nombre).eq('rol', 'operario');
        await supabase.from('jefe_operario').update({ operario_nombre: nombre }).eq('operario_nombre', editing.nombre);
      }
      // Update PIN if provided
      if (form.pin.length === 4) {
        const hashed = await hashPin(form.pin);
        await supabase.from('usuarios').update({ pin: hashed }).eq('nombre', nombre).eq('rol', 'operario');
      }
    } else {
      if (form.pin.length !== 4) return alert('El PIN debe tener 4 dígitos');
      const hashed = await hashPin(form.pin);
      await supabase.from('operarios').insert({ nombre, email: form.email, activo: form.activo });
      await supabase.from('usuarios').insert({ nombre, pin: hashed, rol: 'operario' });
    }
    setShowModal(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Operarios</h2>
        <button onClick={openAdd} className="flex items-center gap-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm px-3 py-2 rounded-lg hover:opacity-90">
          <PlusIcon className="h-4 w-4" /> Añadir
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-center">Activo</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {operarios.map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-slate-800">{o.nombre}</td>
                <td className="px-4 py-2 text-slate-600">{o.email}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {o.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEdit(o)} className="p-1 rounded hover:bg-slate-100" title="Editar">
                      <PencilIcon className="h-4 w-4 text-blue-600" />
                    </button>
                    <button onClick={() => del(o)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                      <TrashIcon className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {operarios.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin operarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Editar operario' : 'Nuevo operario'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PIN de acceso {editing ? '(dejar vacío para no cambiar)' : '(4 dígitos) *'}
              </label>
              <input
                type="password"
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                maxLength={4}
                inputMode="numeric"
                className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                placeholder="••••"
              />
              {!editing && (
                <p className="text-xs text-slate-400 mt-1">El operario usará este PIN para acceder al sistema en modo lectura.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
              <label htmlFor="activo" className="text-sm text-slate-700">Activo</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300">Cancelar</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Jefes Panel ─────────────────────────────────────────────────────────────
function JefesPanel() {
  const [jefes, setJefes] = useState<Usuario[]>([]);
  const [operarios, setOperarios] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ nombre: '', pin: '', asignados: [] as string[] });

  const load = async () => {
    const [{ data: j }, { data: o }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('rol', 'jefe').order('nombre'),
      supabase.from('operarios').select('nombre').eq('activo', true).order('nombre'),
    ]);
    setJefes(j || []);
    setOperarios((o || []).map(r => r.nombre));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ nombre: '', pin: '', asignados: [] }); setShowModal(true); };
  const openEdit = async (j: Usuario) => {
    const { data } = await supabase.from('jefe_operario').select('operario_nombre').eq('jefe_id', j.id);
    setEditing(j);
    setForm({ nombre: j.nombre, pin: '', asignados: (data || []).map(r => r.operario_nombre) });
    setShowModal(true);
  };

  const toggleAsignado = (nombre: string) => {
    setForm(f => ({
      ...f,
      asignados: f.asignados.includes(nombre)
        ? f.asignados.filter(n => n !== nombre)
        : [...f.asignados, nombre],
    }));
  };

  const save = async () => {
    if (!form.nombre.trim()) return;
    let jefeId = editing?.id;

    if (editing) {
      const updates: Record<string, string> = { nombre: form.nombre };
      if (form.pin.length === 4) updates.pin = await hashPin(form.pin);
      await supabase.from('usuarios').update(updates).eq('id', editing.id);
    } else {
      if (form.pin.length !== 4) return alert('El PIN debe tener 4 dígitos');
      const hashed = await hashPin(form.pin);
      const { data } = await supabase
        .from('usuarios')
        .insert({ nombre: form.nombre, pin: hashed, rol: 'jefe' })
        .select('id')
        .single();
      jefeId = data?.id;
    }

    if (jefeId) {
      await supabase.from('jefe_operario').delete().eq('jefe_id', jefeId);
      if (form.asignados.length > 0) {
        await supabase.from('jefe_operario').insert(
          form.asignados.map(nombre => ({ jefe_id: jefeId, operario_nombre: nombre }))
        );
      }
    }
    setShowModal(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Jefes</h2>
        <button onClick={openAdd} className="flex items-center gap-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm px-3 py-2 rounded-lg hover:opacity-90">
          <PlusIcon className="h-4 w-4" /> Añadir
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {jefes.map(j => (
              <tr key={j.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-slate-800">{j.nombre}</td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => openEdit(j)} className="p-1 rounded hover:bg-slate-100">
                    <PencilIcon className="h-4 w-4 text-blue-600" />
                  </button>
                </td>
              </tr>
            ))}
            {jefes.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-400">Sin jefes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Editar jefe' : 'Nuevo jefe'} onClose={() => setShowModal(false)} size="lg">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PIN {editing ? '(dejar vacío para no cambiar)' : '(4 dígitos) *'}
              </label>
              <input
                type="password"
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                maxLength={4}
                inputMode="numeric"
                className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Operarios asignados</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {operarios.map(nombre => (
                  <label key={nombre} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.asignados.includes(nombre)}
                      onChange={() => toggleAsignado(nombre)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700">{nombre}</span>
                  </label>
                ))}
                {operarios.length === 0 && <p className="text-slate-400 text-sm col-span-2">No hay operarios activos</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300">Cancelar</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Usuarios Operario Panel ──────────────────────────────────────────────────
function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [operarios, setOperarios] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ nombre: '', pin: '' });

  const load = async () => {
    const [{ data: u }, { data: o }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('rol', 'operario').order('nombre'),
      supabase.from('operarios').select('nombre').eq('activo', true).order('nombre'),
    ]);
    setUsuarios(u || []);
    setOperarios((o || []).map(r => r.nombre));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ nombre: '', pin: '' }); setShowModal(true); };
  const openEdit = (u: Usuario) => { setEditing(u); setForm({ nombre: u.nombre, pin: '' }); setShowModal(true); };

  const save = async () => {
    if (!form.nombre.trim()) return;
    if (editing) {
      const updates: Record<string, string> = { nombre: form.nombre };
      if (form.pin.length === 4) updates.pin = await hashPin(form.pin);
      await supabase.from('usuarios').update(updates).eq('id', editing.id);
    } else {
      if (form.pin.length !== 4) return alert('El PIN debe tener 4 dígitos');
      const hashed = await hashPin(form.pin);
      await supabase.from('usuarios').insert({ nombre: form.nombre, pin: hashed, rol: 'operario' });
    }
    setShowModal(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Usuarios Operario</h2>
        <button onClick={openAdd} className="flex items-center gap-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm px-3 py-2 rounded-lg hover:opacity-90">
          <PlusIcon className="h-4 w-4" /> Añadir
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full">
          <thead className="bg-slate-600 text-slate-100 text-sm">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-300 text-sm">
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-slate-800">{u.nombre}</td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => openEdit(u)} className="p-1 rounded hover:bg-slate-100">
                    <PencilIcon className="h-4 w-4 text-blue-600" />
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-400">Sin usuarios operario</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Editar usuario operario' : 'Nuevo usuario operario'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              {editing ? (
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              ) : (
                <select value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Seleccionar operario —</option>
                  {operarios.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PIN {editing ? '(dejar vacío para no cambiar)' : '(4 dígitos) *'}
              </label>
              <input
                type="password"
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                maxLength={4}
                inputMode="numeric"
                className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                placeholder="••••"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300">Cancelar</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel() {
  const [form, setForm] = useState({ webhook_url: '', nombre_empresa: '', logo_url: '' });
  const [configId, setConfigId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    supabase.from('config').select('*').order('id').limit(1).maybeSingle().then(({ data }) => {
      if (data) { setConfigId(data.id); setForm({ webhook_url: data.webhook_url || '', nombre_empresa: data.nombre_empresa || '', logo_url: data.logo_url || '' }); }
    });
  }, []);

  const save = async () => {
    setSaveError('');
    if (configId) {
      const { data, error } = await supabase.from('config').update(form).eq('id', configId).select('id').single();
      if (error) { setSaveError(`Error al guardar: ${error.message}`); return; }
      if (!data) { setSaveError('La base de datos no actualizó ninguna fila. Comprueba las políticas RLS de la tabla "config".'); return; }
    } else {
      const { data, error } = await supabase.from('config').insert(form).select('id').single();
      if (error) { setSaveError(`Error al guardar: ${error.message}`); return; }
      if (data) setConfigId(data.id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Configuración</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la empresa</label>
          <input value={form.nombre_empresa} onChange={e => setForm(f => ({ ...f, nombre_empresa: e.target.value }))}
            className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">URL del logo</label>
          <input type="url" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://ejemplo.com/logo.png" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL (n8n)</label>
          <input type="url" value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
            className="w-full bg-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://tu-n8n.com/webhook/..." />
        </div>
        <button onClick={save} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium">
          {saved ? '¡Guardado!' : 'Guardar'}
        </button>
        {saveError && (
          <p className="mt-2 text-sm text-red-600">{saveError}</p>
        )}
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-300 rounded-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-4">Panel de Administración</h1>
        <TabNav tabs={TABS} active={tab} onChange={setTab} />
        <div className="mt-2">
          {tab === 'dashboard'      && <DashboardPanel />}
          {tab === 'kpi'            && <KPIDashboard />}
          {tab === 'autorizaciones' && <AutorizacionesPanel />}
          {tab === 'kpis'           && <GestionKPIsPanel />}
          {tab === 'permisos'       && <PermisosPanel />}
          {tab === 'operarios' && <OperariosPanel />}
          {tab === 'jefes'     && <JefesPanel />}
          {tab === 'usuarios'  && <UsuariosPanel />}
          {tab === 'config'    && <ConfigPanel />}
        </div>
      </div>
    </div>
  );
}
