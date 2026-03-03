import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  DocumentArrowDownIcon,
  ChartBarSquareIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

interface SiteConfig {
  nombre_empresa: string;
  logo_url: string;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<SiteConfig>({ nombre_empresa: 'ACM Tools', logo_url: '' });
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    supabase.from('config').select('nombre_empresa, logo_url').single().then(({ data }) => {
      if (data) setConfig(data);
    });
  }, []);

  // Count pending solicitudes for jefe/admin
  useEffect(() => {
    if (!user || user.rol === 'operario') return;
    (supabase.from('solicitudes') as any)
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .then(({ count }: { count: number | null }) => setNotifCount(count ?? 0));
  }, [user, location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = (user?.nombre ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const perfil = { to: '/perfil', Icon: UserCircleIcon, label: 'Perfil' };

  const jefeLinks = [
    { to: '/seleccionar-operario', Icon: UserGroupIcon,           label: 'Operarios'     },
    { to: '/mis-registros',        Icon: ClipboardDocumentListIcon, label: 'Mis Registros' },
    { to: '/informes',             Icon: DocumentArrowDownIcon,    label: 'Informes'      },
    perfil,
  ];
  const adminLinks = [
    { to: '/admin', Icon: Cog6ToothIcon, label: 'Admin' },
    perfil,
  ];
  const operarioLinks = [
    { to: `/operario/${encodeURIComponent(user?.nombre ?? '')}`, Icon: ChartBarSquareIcon,      label: 'Mis KPIs'      },
    { to: '/mis-registros',                                       Icon: ClipboardDocumentListIcon, label: 'Mis Registros' },
    perfil,
  ];
  const navLinks =
    user?.rol === 'admin'    ? adminLinks    :
    user?.rol === 'operario' ? operarioLinks :
    jefeLinks;

  // Theme-aware classes
  const wrapper  = isDark ? 'min-h-screen bg-gradient-to-b from-blue-900 to-black'     : 'min-h-screen bg-gray-50';
  const header   = isDark ? 'bg-gradient-to-r from-cyan-700 to-blue-700'               : 'bg-white border-b border-gray-200 shadow-sm';
  const nav      = isDark ? 'bg-slate-800 border-b border-slate-700'                   : 'bg-white border-b border-gray-200';
  const navText  = isDark ? 'text-slate-300 hover:text-white'                          : 'text-slate-600 hover:text-blue-700';
  const active   = isDark ? 'text-blue-400' : 'text-blue-600';
  const nameTxt  = isDark ? 'text-white'    : 'text-slate-800';
  const emailTxt = isDark ? 'text-slate-300' : 'text-slate-500';
  const iconBtn  = isDark ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-gray-100';

  return (
    <div className={wrapper}>
      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header className={`${header} px-4 py-2.5`}>
        <div className="flex items-center justify-between gap-4">

          {/* Left: logo + app name */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={config.logo_url || 'https://i.imgur.com/FIay1SB.png'}
              alt="Logo" className="h-9 w-auto object-contain"
            />
            <span className={`font-bold text-lg tracking-wide ${nameTxt}`}>{config.nombre_empresa}</span>
          </div>

          {/* Right: bell + theme + user info */}
          <div className="flex items-center gap-2">

            {/* Notification bell */}
            <button className={`relative p-1.5 rounded-lg transition-colors ${iconBtn}`} title="Notificaciones">
              <BellIcon className="h-5 w-5" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {/* Dark/light toggle */}
            <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-colors ${iconBtn}`} title={isDark ? 'Modo claro' : 'Modo oscuro'}>
              {isDark ? <SunIcon className="h-5 w-5 text-yellow-300" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            {/* User avatar + name + email */}
            <div className="flex items-center gap-2 ml-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className={`text-sm font-semibold ${nameTxt}`}>{user?.nombre}</p>
                <p className={`text-xs ${emailTxt}`}>{user?.email || user?.rol}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Nav bar ────────────────────────────────────────────────────── */}
      <nav className={`${nav} px-4 py-2 flex items-center justify-between flex-wrap gap-2`}>
        <div className="flex items-center gap-4 flex-wrap">
          {navLinks.map(({ to, Icon, label }) => {
            const isActive = to === '/perfil'
              ? location.pathname === '/perfil'
              : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-1 text-sm font-medium transition-all hover:scale-105 ${isActive ? active : navText}`}>
                <Icon className="h-5 w-5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
        <button onClick={handleLogout}
          className={`flex items-center gap-1 text-sm font-medium hover:text-red-500 hover:scale-105 transition-all ${navText}`}>
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </nav>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
