import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { retrySyncPending } from './lib/webhook';
import Layout from './components/Layout';
import Login from './pages/Login';
import Admin from './pages/Admin';
import SeleccionarOperario from './pages/SeleccionarOperario';
import Operario from './pages/Operario';
import MisRegistros from './pages/MisRegistros';
import Informes from './pages/Informes';
import Perfil from './pages/Perfil';

const SYNC_TABLES = [
  { table: 'incidencias',         fuente: '01_DB_INCIDENCIAS' },
  { table: 'control_calidad',     fuente: '02_CONTROL_CALIDAD' },
  { table: 'visitas',             fuente: '03_VISITAS' },
  { table: 'limpieza',            fuente: '04_LIMPIEZA' },
  { table: 'horas_improductivas', fuente: '05_HORAS_IMPROD' },
  { table: 'issus',               fuente: '06_INCIDENCIAS_ISSUS' },
];

function PrivateRoute({ children, adminOnly = false, jefeOnly = false }: { children: ReactNode; adminOnly?: boolean; jefeOnly?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.rol !== 'admin') return <Navigate to="/seleccionar-operario" replace />;
  if (jefeOnly && user.rol === 'operario') return <Navigate to={`/operario/${encodeURIComponent(user.nombre)}`} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    // Retry any pending webhook syncs on app load
    SYNC_TABLES.forEach(({ table, fuente }) => retrySyncPending(table, fuente));
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={
        <PrivateRoute adminOnly>
          <Layout><Admin /></Layout>
        </PrivateRoute>
      } />

      <Route path="/seleccionar-operario" element={
        <PrivateRoute jefeOnly>
          <Layout><SeleccionarOperario /></Layout>
        </PrivateRoute>
      } />

      <Route path="/operario/:nombre" element={
        <PrivateRoute>
          <Layout><Operario /></Layout>
        </PrivateRoute>
      } />

      <Route path="/mis-registros" element={
        <PrivateRoute>
          <Layout><MisRegistros /></Layout>
        </PrivateRoute>
      } />

      <Route path="/informes" element={
        <PrivateRoute jefeOnly>
          <Layout><Informes /></Layout>
        </PrivateRoute>
      } />

      <Route path="/perfil" element={
        <PrivateRoute>
          <Layout><Perfil /></Layout>
        </PrivateRoute>
      } />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
