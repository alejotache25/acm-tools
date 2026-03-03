import { supabase } from './supabase';
import type { AuthUser } from '../types';

export async function logDelete(
  user: AuthUser | null,
  accion: string,
  tabla: string,
  datos: Record<string, unknown>
): Promise<void> {
  if (!user) return;
  await (supabase.from('audit_log') as any).insert({
    accion,
    tabla,
    registro_id:      String(datos.id ?? ''),
    datos_eliminados: datos,
    usuario_id:       user.id,
    usuario_nombre:   user.nombre,
    usuario_email:    user.email ?? '',
    usuario_rol:      user.rol,
  });
}
