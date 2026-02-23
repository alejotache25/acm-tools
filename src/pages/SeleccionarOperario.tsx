import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function SeleccionarOperario() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [operarios, setOperarios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('jefe_operario')
      .select('operario_nombre')
      .eq('jefe_id', user.id)
      .then(({ data }) => {
        setOperarios((data || []).map(r => r.operario_nombre));
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-300 rounded-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Seleccionar Operario</h1>
        <p className="text-slate-600 text-sm mb-6">Elige el operario para gestionar sus registros.</p>

        {loading ? (
          <div className="text-slate-500 text-center py-8">Cargando operarios...</div>
        ) : operarios.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            No tienes operarios asignados. Contacta con el administrador.
          </div>
        ) : (
          <div className="space-y-3">
            {operarios.map(nombre => (
              <button
                key={nombre}
                onClick={() => navigate(`/operario/${encodeURIComponent(nombre)}`)}
                className="w-full flex items-center justify-between bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg px-4 py-4 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-full p-2 group-hover:bg-blue-200 transition-colors">
                    <UserIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-slate-800">{nombre}</span>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
