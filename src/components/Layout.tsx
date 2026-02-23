import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface SiteConfig {
  nombre_empresa: string;
  logo_url: string;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<SiteConfig>({ nombre_empresa: 'ACM Tools', logo_url: '' });

  useEffect(() => {
    supabase.from('config').select('nombre_empresa, logo_url').single().then(({ data }) => {
      if (data) setConfig(data);
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const jefeLinks = [
    { to: '/seleccionar-operario', Icon: UserGroupIcon, label: 'Operarios' },
    { to: '/mis-registros', Icon: ClipboardDocumentListIcon, label: 'Mis Registros' },
  ];
  const adminLinks = [
    { to: '/admin', Icon: Cog6ToothIcon, label: 'Admin' },
  ];
  const navLinks = user?.rol === 'admin' ? adminLinks : jefeLinks;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black">
      {/* Top header */}
      <header className="bg-gradient-to-r from-cyan-700 to-blue-700">
        <div className="flex items-center justify-center gap-3 py-3 px-4">
          {config.logo_url && (
            <img src={config.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
          )}
          <span className="text-white font-bold text-xl tracking-wide">{config.nombre_empresa}</span>
        </div>
      </header>

      {/* Bottom nav bar */}
      <nav className="bg-slate-300 flex items-center justify-between px-4 py-2 flex-wrap gap-2">
        <div className="text-sm font-medium text-slate-700">
          <span className="font-semibold">{user?.nombre}</span>
          <span className="text-slate-500"> · </span>
          <span className="capitalize text-slate-500">{user?.rol}</span>
        </div>
        <div className="flex items-center gap-4">
          {navLinks.map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1 text-sm font-medium transition-all hover:text-blue-700 hover:scale-105 ${
                location.pathname.startsWith(to) ? 'text-blue-700' : 'text-slate-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-red-600 hover:scale-105 transition-all"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main className="p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
