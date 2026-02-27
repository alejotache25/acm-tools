import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChartBarIcon, TableCellsIcon, SignalIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import TabNav from '../components/TabNav';
import KPIDashboard from '../tabs/KPIDashboard';
import KPIMensual from '../tabs/KPIMensual';
import { SemaforoKPIPanel } from './SeleccionarOperario';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'dashboard', label: 'Dashboard',    Icon: ChartBarIcon },
  { id: 'kpi',       label: 'KPI Mensual',  Icon: TableCellsIcon },
  { id: 'semaforo',  label: 'Semáforo KPI', Icon: SignalIcon },
];

export default function Operario() {
  const { nombre } = useParams<{ nombre: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const operario = decodeURIComponent(nombre || '');
  const isOperario = user?.rol === 'operario';

  if (!operario) {
    navigate('/seleccionar-operario');
    return null;
  }

  // Operarios can only view their own page
  if (isOperario && user?.nombre !== operario) {
    navigate(`/operario/${encodeURIComponent(user?.nombre ?? '')}`);
    return null;
  }

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
          <p className="text-blue-300 text-sm">Mis registros</p>
        </div>
      </div>

      {/* Tab panel */}
      <div className="bg-slate-300 rounded-lg p-4 md:p-6">
        <TabNav tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === 'dashboard' && <KPIDashboard operariosFilter={[operario]} />}
          {activeTab === 'kpi'       && <KPIMensual operario={operario} readOnly={true} />}
          {activeTab === 'semaforo'  && <SemaforoKPIPanel operarios={[operario]} />}
        </div>
      </div>
    </div>
  );
}
