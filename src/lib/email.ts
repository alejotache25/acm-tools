import { supabase } from './supabase';

// Sends email via the send-ausencia-email Supabase Edge Function (uses Resend).
// Gracefully skips if the function is not deployed yet.

async function invoke(payload: Record<string, unknown>) {
  try {
    await supabase.functions.invoke('send-ausencia-email', { body: payload });
  } catch (e) {
    console.warn('send-ausencia-email edge function error:', e);
  }
}

// Sent to jefe when operario submits a request
export async function sendSolicitudEmail(params: {
  to_email:        string;
  to_name:         string;
  operario_nombre: string;
  tipo:            string;
  fecha_inicio:    string;
  fecha_fin:       string;
  dias:            number;
  app_url?:        string;
}) {
  await invoke({ type: 'solicitud', ...params });
}

// Sent to operario when jefe approves or rejects
export async function sendResolucionEmail(params: {
  to_email:    string;
  to_name:     string;
  tipo:        string;
  fecha_inicio: string;
  fecha_fin:    string;
  dias:        number;
  estado:      string;
  comentario:  string;
  jefe_nombre: string;
}) {
  await invoke({ type: 'resolucion', ...params });
}
