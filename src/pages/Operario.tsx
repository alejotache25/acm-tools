import { useState, useEffect } from 'react';
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
import KPIDashboard from '../tabs/KPIDashboard';
import { SemaforoKPIPanel } from './SeleccionarOperario';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Tabs shown to jefes (editable forms 01-07)
const JEFE_TABS = [
  { id: '01', label: '01 Incidencias',          Icon: ExclamationTriangleIcon },
  { id: '02', label: '02 Control Calidad',       Icon: CheckBadgeIcon },
  { id: '03', label: '03 Visitas',               Icon: EyeIcon },
  { id: '04', label: '04 Limpieza',              Icon: SparklesIcon },
  { id: '05', label: '05 Horas Improductivas',   Icon: ClockIcon },
  { id: '06', label: '06 ISSUS',                 Icon: ListBulletIcon },
  { id: '07', label: '07 KPI Mensual',           Icon: ChartBarIcon },
];

// Tabs shown to operarios (read-only KPI views)
const OPERARIO_TABS = [
  { id: 'dashboard', label: 'Dashboard',    Icon: ChartBarIcon },
  { id: 'kpi',       label: 'KPI Mensual',  Icon: TableCellsIcon },
  { id: 'semaforo',  label: 'Semáforo KPI', Icon: SignalIcon },
];

export default function Operario() {
  const { nombre } = useParams<{ nombre: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('');
  const [asignados, setAsignados] = useState<string[]>([]);

  const operario = decodeURIComponent(nombre || '');
  const isOperario = user?.rol === 'operario';
  const isJefe = user?.rol === 'jefe';

  useEffect(() => {
    if (!isJefe || !user?.id) return;
    supabase.from('jefe_operario').select('operario_nombre').eq('jefe_id', user.id)
      .then(({ data }) => setAsignados((data || []).map(r => r.operario_nombre)));
  }, [isJefe, user?.id]);

  // Reset tab when switching between jefe/operario mode
  useEffect(() => {
    setActiveTab(isOperario ? 'dashboard' : '01');
  }, [isOperario]);

  if (!operario) {
    navigate('/seleccionar-operario');
    return null;
  }

  // Operarios can only view their own page
  if (isOperario && user?.nombre !== operario) {
    navigate(`/operario/${encodeURIComponent(user?.nombre ?? '')}`);
    return null;
  }

  // readOnly when: jefe viewing someone not assigned to them
  const readOnly = isJefe && asignados.length > 0 && !asignados.includes(operario);

  const tabs = isOperario ? OPERARIO_TABS : JEFE_TABS;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back + title */}
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

      {/* Tab panel */}
      <div className="bg-slate-300 rounded-lg p-4 md:p-6">
        {activeTab && (
          <>
            <TabNav tabs={tabs} active={activeTab} onChange={setActiveTab} />

            <div className="mt-4">
              {/* Jefe tabs — editable forms 01-07 */}
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

              {/* Operario tabs — read-only KPI views */}
              {isOperario && (
                <>
                  {activeTab === 'dashboard' && <KPIDashboard operariosFilter={[operario]} />}
                  {activeTab === 'kpi'       && <KPIMensual operario={operario} readOnly={true} />}
                  {activeTab === 'semaforo'  && <SemaforoKPIPanel operarios={[operario]} />}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
