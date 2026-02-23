import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type TablaKey = 'incidencias' | 'control_calidad' | 'visitas' | 'limpieza' | 'horas_improductivas' | 'issus';

const TABLAS: { key: TablaKey; label: string }[] = [
  { key: 'incidencias',         label: '01 Incidencias' },
  { key: 'control_calidad',     label: '02 Control Calidad' },
  { key: 'visitas',             label: '03 Visitas' },
  { key: 'limpieza',            label: '04 Limpieza' },
  { key: 'horas_improductivas', label: '05 Horas Improductivas' },
  { key: 'issus',               label: '06 ISSUS' },
];

interface RegistroRow {
  id: string;
  operario: string;
  fecha: string;
  tabla: string;
  resumen: string;
  sync_pending?: boolean;
}

function summarize(row: Record<string, unknown>, tabla: TablaKey): string {
  switch (tabla) {
    case 'incidencias':         return String(row.incidencia ?? '');
    case 'control_calidad':     return `${row.cliente ?? ''} - ${row.tipo_cq ?? ''}`;
    case 'visitas':             return `${row.tipo_visita ?? ''} - ${row.ok_visita ?? ''}`;
    case 'limpieza':            return `Vestuario: ${row.vestuario_h ?? 0}`;
    case 'horas_improductivas': return `H.Rec.Mat: ${row.h_recg_mat ?? 0}`;
    case 'issus':               return `${row.tipo ?? ''} - ${String(row.descripcion ?? '').slice(0, 40)}`;
    default:                    return '';
  }
}

export default function MisRegistros() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RegistroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTabla, setFiltroTabla] = useState<string>('all');
  const [filtroOperario, setFiltroOperario] = useState<string>('all');
  const [operarios, setOperarios] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    (async () => {
      setLoading(true);
      const allRows: RegistroRow[] = [];

      for (const { key, label } of TABLAS) {
        const { data } = await supabase
          .from(key)
          .select('*')
          .eq('jefe_id', user.id)
          .gte('fecha', start)
          .lte('fecha', end)
          .order('fecha', { ascending: false });

        (data || []).forEach(row => {
          allRows.push({
            id: row.id,
            operario: row.operario,
            fecha: row.fecha,
            tabla: label,
            resumen: summarize(row as Record<string, unknown>, key),
            sync_pending: row.sync_pending,
          });
        });
      }

      allRows.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setRows(allRows);

      const ops = [...new Set(allRows.map(r => r.operario))].sort();
      setOperarios(ops);
      setLoading(false);
    })();
  }, [user]);

  const filtered = rows.filter(r => {
    if (filtroTabla !== 'all' && r.tabla !== filtroTabla) return false;
    if (filtroOperario !== 'all' && r.operario !== filtroOperario) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-slate-300 rounded-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Mis Registros</h1>
        <p className="text-slate-600 text-sm mb-4">Registros del mes actual.</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filtroTabla}
            onChange={e => setFiltroTabla(e.target.value)}
            className="bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          >
            <option value="all">Todas las secciones</option>
            {TABLAS.map(t => <option key={t.key} value={t.label}>{t.label}</option>)}
          </select>
          <select
            value={filtroOperario}
            onChange={e => setFiltroOperario(e.target.value)}
            className="bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          >
            <option value="all">Todos los operarios</option>
            {operarios.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-slate-500 text-center py-8">Cargando registros...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg">
            <table className="min-w-full">
              <thead className="bg-slate-600 text-slate-100 text-sm">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Operario</th>
                  <th className="px-4 py-2 text-left">Sección</th>
                  <th className="px-4 py-2 text-left">Resumen</th>
                  <th className="px-4 py-2 text-center">Sync</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-300 text-sm">
                {filtered.map(r => (
                  <tr key={`${r.tabla}-${r.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{r.fecha}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{r.operario}</td>
                    <td className="px-4 py-2">
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{r.tabla}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{r.resumen}</td>
                    <td className="px-4 py-2 text-center">
                      {r.sync_pending
                        ? <span className="text-amber-600 text-xs font-medium">Pendiente</span>
                        : <span className="text-green-600 text-xs font-medium">OK</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin registros para los filtros seleccionados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
