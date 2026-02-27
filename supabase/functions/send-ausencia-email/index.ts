Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev';

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500 });
  }

  const body = await req.json();
  const { type, to_email, to_name } = body;

  let subject = '';
  let html    = '';

  // ── Email to jefe when operario submits a request ──
  if (type === 'solicitud') {
    const { operario_nombre, tipo, fecha_inicio, fecha_fin, dias } = body;
    subject = `📅 Nueva solicitud de ${operario_nombre}: ${tipo}`;
    html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#1e3a5f;padding:24px 28px">
          <h1 style="color:#fff;margin:0;font-size:18px">Nueva solicitud de ausencia</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">ACM Tools · Notificación automática</p>
        </div>
        <div style="padding:28px">
          <p style="color:#374151;font-size:14px;margin:0 0 20px">
            Hola <strong>${to_name}</strong>, el operario <strong>${operario_nombre}</strong> ha enviado una solicitud de ausencia.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:#f8fafc">
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b;width:40%">Tipo</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b">${tipo}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b">Fecha inicio</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b">${fecha_inicio}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b">Fecha fin</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b">${fecha_fin}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b">Días</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-weight:700">${dias} día${dias !== 1 ? 's' : ''} naturales</td>
            </tr>
          </table>
          <div style="margin-top:24px;padding:14px;background:#fef9c3;border:1px solid #fde047;border-radius:8px">
            <p style="margin:0;font-size:13px;color:#713f12">
              🔔 La solicitud está <strong>pendiente de revisión</strong>. Accede a la app para aprobarla o rechazarla.
            </p>
          </div>
        </div>
      </div>`;

  // ── Email to operario when jefe decides ──
  } else if (type === 'resolucion') {
    const { tipo, fecha_inicio, fecha_fin, dias, estado, comentario, jefe_nombre } = body;
    const aprobada  = estado === 'Aprobada ✓';
    const colorBg   = aprobada ? '#f0fdf4' : '#fef2f2';
    const colorBdr  = aprobada ? '#86efac' : '#fca5a5';
    const colorTxt  = aprobada ? '#15803d' : '#dc2626';
    const icon      = aprobada ? '✅' : '❌';

    subject = `${icon} Tu solicitud de ${tipo} ha sido ${estado}`;
    html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#1e3a5f;padding:24px 28px">
          <h1 style="color:#fff;margin:0;font-size:18px">Resolución de solicitud</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">ACM Tools · Notificación automática</p>
        </div>
        <div style="padding:28px">
          <div style="padding:16px;background:${colorBg};border:1px solid ${colorBdr};border-radius:8px;margin-bottom:20px;text-align:center">
            <p style="margin:0;font-size:20px;font-weight:700;color:${colorTxt}">${icon} ${estado}</p>
          </div>
          <p style="color:#374151;font-size:14px;margin:0 0 20px">
            Hola <strong>${to_name}</strong>, tu solicitud de ausencia ha sido revisada por <strong>${jefe_nombre}</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:#f8fafc">
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b;width:40%">Tipo</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b">${tipo}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b">Fechas</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b">${fecha_inicio} → ${fecha_fin}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b">Días</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-weight:700">${dias} día${dias !== 1 ? 's' : ''} naturales</td>
            </tr>
            ${comentario && comentario !== '—' ? `
            <tr>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;color:#64748b">Comentario</td>
              <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-style:italic">${comentario}</td>
            </tr>` : ''}
          </table>
        </div>
      </div>`;
  } else {
    return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${resendKey}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({
      from: `ACM Tools <${fromEmail}>`,
      to:   [to_email],
      subject,
      html,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status:  res.status,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  '*',
    },
  });
});
