import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function fmtFecha(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const brevoKey    = Deno.env.get('BREVO_API_KEY');
  const fromEmail   = Deno.env.get('FROM_EMAIL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!brevoKey) {
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY not set' }), { status: 500 });
  }
  if (!fromEmail) {
    return new Response(JSON.stringify({ error: 'FROM_EMAIL not set' }), { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400 });
  }

  const newRec = payload.record;
  const oldRec = payload.old_record;

  // Only act when estado changes to aprobada/rechazada
  if (!newRec || !oldRec || newRec.estado === oldRec.estado) {
    return new Response(JSON.stringify({ skipped: 'no state change' }), { status: 200 });
  }

  if (newRec.estado !== 'aprobada' && newRec.estado !== 'rechazada') {
    return new Response(JSON.stringify({ skipped: 'not resolved' }), { status: 200 });
  }

  // Service role client — bypasses all RLS
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get operario email: stored field first, then operarios table, then usuarios
  let toEmail: string | null = newRec.operario_email?.trim() || null;
  if (!toEmail) {
    const { data: opRow } = await supabase
      .from('operarios')
      .select('email')
      .eq('nombre', newRec.operario_nombre)
      .maybeSingle();
    toEmail = opRow?.email?.trim() || null;
  }
  if (!toEmail) {
    const { data: uRow } = await supabase
      .from('usuarios')
      .select('email')
      .eq('nombre', newRec.operario_nombre)
      .maybeSingle();
    toEmail = uRow?.email?.trim() || null;
  }

  if (!toEmail) {
    return new Response(JSON.stringify({ error: 'operario email not found', operario: newRec.operario_nombre }), { status: 200 });
  }

  const aprobada = newRec.estado === 'aprobada';
  const estadoLabel = aprobada ? 'APROBADA ✅' : 'RECHAZADA ❌';
  const colorEstado = aprobada ? '#16a34a' : '#dc2626';
  const comentario = newRec.comentario_jefe?.trim() || null;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <tr><td style="background:#1d4ed8;padding:32px 40px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Resolución de Solicitud</h1>
        <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">Sistema de Gestión de Ausencias</p>
      </td></tr>
      <tr><td style="padding:40px">
        <p style="margin:0 0 24px;font-size:16px;color:#374151">Hola <strong>${newRec.operario_nombre}</strong>,</p>
        <p style="margin:0 0 24px;font-size:15px;color:#6b7280">Tu solicitud de ausencia ha sido resuelta:</p>

        <div style="background:#f9fafb;border-radius:8px;padding:24px;margin-bottom:24px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px">Estado:</td>
                <td style="padding:6px 0;font-weight:700;font-size:16px;color:${colorEstado}">${estadoLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Tipo:</td>
                <td style="padding:6px 0;color:#111827;font-size:14px">${newRec.tipo ?? '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Inicio:</td>
                <td style="padding:6px 0;color:#111827;font-size:14px">${fmtFecha(newRec.fecha_inicio)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Fin:</td>
                <td style="padding:6px 0;color:#111827;font-size:14px">${fmtFecha(newRec.fecha_fin)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Días:</td>
                <td style="padding:6px 0;color:#111827;font-size:14px">${newRec.dias ?? '-'}</td></tr>
            ${comentario ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Comentario:</td>
                <td style="padding:6px 0;color:#111827;font-size:14px">${comentario}</td></tr>` : ''}
          </table>
        </div>

        <p style="margin:0;font-size:13px;color:#9ca3af">Este es un mensaje automático del sistema ACM Tools.</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
        <p style="margin:0;font-size:12px;color:#9ca3af">ACM Tools — Gestión de Ausencias</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoKey,
    },
    body: JSON.stringify({
      sender: { name: 'ACM Tools', email: fromEmail },
      to: [{ email: toEmail, name: newRec.operario_nombre }],
      subject: `Solicitud ${aprobada ? 'aprobada' : 'rechazada'} — ACM Tools`,
      htmlContent: html,
    }),
  });

  const brevoData = await brevoRes.json();

  if (!brevoRes.ok) {
    return new Response(JSON.stringify({ error: 'brevo failed', details: brevoData }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, messageId: brevoData.messageId, to: toEmail }), { status: 200 });
});
