import emailjs from '@emailjs/browser';

const SERVICE_ID          = import.meta.env.VITE_EMAILJS_SERVICE_ID        as string | undefined;
const PUBLIC_KEY          = import.meta.env.VITE_EMAILJS_PUBLIC_KEY         as string | undefined;
const TEMPLATE_SOLICITUD  = import.meta.env.VITE_EMAILJS_TEMPLATE_SOLICITUD as string | undefined;
const TEMPLATE_RESOLUCION = import.meta.env.VITE_EMAILJS_TEMPLATE_RESOLUCION as string | undefined;

const configured = !!(SERVICE_ID && PUBLIC_KEY && TEMPLATE_SOLICITUD && TEMPLATE_RESOLUCION);

// Sent to jefe when operario submits a request
export async function sendSolicitudEmail(params: {
  to_email:        string;
  to_name:         string;
  operario_nombre: string;
  tipo:            string;
  fecha_inicio:    string;
  fecha_fin:       string;
  dias:            number;
}) {
  if (!configured) return;
  try {
    await emailjs.send(SERVICE_ID!, TEMPLATE_SOLICITUD!, params, PUBLIC_KEY!);
  } catch (e) {
    console.warn('EmailJS solicitud error:', e);
  }
}

// Sent to operario when jefe approves or rejects
export async function sendResolucionEmail(params: {
  to_email:        string;
  to_name:         string;
  tipo:            string;
  fecha_inicio:    string;
  fecha_fin:       string;
  dias:            number;
  estado:          string;
  comentario:      string;
  jefe_nombre:     string;
}) {
  if (!configured) return;
  try {
    await emailjs.send(SERVICE_ID!, TEMPLATE_RESOLUCION!, params, PUBLIC_KEY!);
  } catch (e) {
    console.warn('EmailJS resolución error:', e);
  }
}
