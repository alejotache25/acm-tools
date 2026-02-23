import { useParams, useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  EyeIcon,
  SparklesIcon,
  ClockIcon,
  ListBulletIcon,
  ChartBarIcon,
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
import { useState } from 'react';

const TABS = [
  { id: '01', label: '01 Incidencias',          Icon: ExclamationTriangleIcon },
  { id: '02', label: '02 Control Calidad',       Icon: CheckBadgeIcon },
  { id: '03', label: '03 Visitas',               Icon: EyeIcon },
  { id: '04', label: '04 Limpieza',              Icon: SparklesIcon },
  { id: '05', label: '05 Horas Improductivas',   Icon: ClockIcon },
  { id: '06', label: '06 ISSUS',                 Icon: ListBulletIcon },
  { id: '07', label: '07 KPI Mensual',           Icon: ChartBarIcon },
];

export default function Operario() {
  const { nombre } = useParams<{ nombre: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('01');

  const operario = decodeURIComponent(nombre || '');

  if (!operario) {
    navigate('/seleccionar-operario');
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/seleccionar-operario')}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-white font-bold text-xl">{operario}</h1>
          <p className="text-blue-300 text-sm">Gestión de registros del operario</p>
        </div>
      </div>

      {/* Tab panel */}
      <div className="bg-slate-300 rounded-lg p-4 md:p-6">
        <TabNav tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === '01' && <Incidencias operario={operario} />}
          {activeTab === '02' && <ControlCalidad operario={operario} />}
          {activeTab === '03' && <Visitas operario={operario} />}
          {activeTab === '04' && <Limpieza operario={operario} />}
          {activeTab === '05' && <HorasImproductivas operario={operario} />}
          {activeTab === '06' && <Issus operario={operario} />}
          {activeTab === '07' && <KPIMensual operario={operario} />}
        </div>
      </div>
    </div>
  );
}
