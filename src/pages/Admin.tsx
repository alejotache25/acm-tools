import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import TabNav from '../components/TabNav';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import type { Operario, Usuario } from '../types';

async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TABS = [
  { id: 'operarios', label: 'Operarios' },
  { id: 'jefes',     label: 'Jefes' },
  { id: 'config',    label: 'Configuración' },
];

// ─── Operarios Panel ─────────────────────────────────────────────────────────
function OperariosPanel() {
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Operario | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', activo: true });

  const load = async () => {
    const { data } = await supabase.from('operarios').select('*').order('nombre');
    setOperarios(data || []);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ nombre: '', email: '', activo: true }); setShowModal(true); };
  const openEdit = (o: Operario) => { setEditing(o); setForm({ nombre: o.nombre, email: o.email || '', activo: o.activo }); setShowModal(true); };

  const save = async () => {
    if (!form.nombre.trim()) return;
    if (editing) {
      await supabase.from('operarios').update(form).eq('id', editing.id);
    } else {
      await supabase.from('operarios').insert(form);
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
                  <button onClick={() => openEdit(o)} className="p-1 rounded hover:bg-slate-100">
                    <PencilIcon className="h-4 w-4 text-blue-600" />
                  </button>
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

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel() {
  const [form, setForm] = useState({ webhook_url: '', nombre_empresa: '', logo_url: '' });
  const [configId, setConfigId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('config').select('*').single().then(({ data }) => {
      if (data) { setConfigId(data.id); setForm({ webhook_url: data.webhook_url || '', nombre_empresa: data.nombre_empresa || '', logo_url: data.logo_url || '' }); }
    });
  }, []);

  const save = async () => {
    if (configId) {
      await supabase.from('config').update(form).eq('id', configId);
    } else {
      const { data } = await supabase.from('config').insert(form).select('id').single();
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
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('operarios');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-300 rounded-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-4">Panel de Administración</h1>
        <TabNav tabs={TABS} active={tab} onChange={setTab} />
        <div className="mt-2">
          {tab === 'operarios' && <OperariosPanel />}
          {tab === 'jefes'     && <JefesPanel />}
          {tab === 'config'    && <ConfigPanel />}
        </div>
      </div>
    </div>
  );
}
