/**
 * monthly-kpi-email — Supabase Edge Function
 *
 * Sends the KPI report for the previous month to each agent's configured email.
 * Triggered by Supabase pg_cron on the 1st of each month at 09:00.
 *
 * Setup in Supabase SQL Editor:
 *   SELECT cron.schedule(
 *     'monthly-kpi-email',
 *     '0 9 1 * *',
 *     $$
 *       SELECT net.http_post(
 *         url := 'https://<PROJECT_REF>.supabase.co/functions/v1/monthly-kpi-email',
 *         headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}',
 *         body := '{}'
 *       );
 *     $$
 *   );
 *
 * Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY       — Resend.com API key
 *   SUPABASE_URL         — Auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

interface EmailConfig {
  operario_nombre: string;
  email: string;
  activo: boolean;
}

interface IncidenciaRow {
  fecha: string;
  incidencia: string;
  puntos: number;
  observaciones?: string;
}

interface ControlCalidadRow {
  fecha: string;
  tipo_cq: string;
  horas: number;
  total_cq: number;
  descripcion: string;
}

interface LimpiezaRow {
  vestuario_h: number;
  limpieza_vh: number;
  seguridad_t: number;
  herramientas: number;
}

interface HorasImprodRow {
  h_recg_mat: number;
  h_reunion: number;
  h_mant_furgos: number;
  h_mant_instalaciones: number;
  h_formacion: number;
  consumibles_e: number;
}

// Build HTML email body for one agent
function buildEmailHtml(
  operario: string,
  mes: number,
  año: number,
  incidencias: IncidenciaRow[],
  controlCalidad: ControlCalidadRow[],
  limpieza: LimpiezaRow[],
  horasImprod: HorasImprodRow[],
): string {
  const mesNombre = MESES[mes - 1];
  const totalInc = incidencias.length;
  const puntosInc = incidencias.reduce((s, r) => s + r.puntos, 0);
  const retornos = controlCalidad.filter(r => r.tipo_cq === 'RETORNO ATRIBUIBLE');
  const totalRet = retornos.length;
  const totalHorasImprod = horasImprod.reduce(
    (s, r) => s + r.h_recg_mat + r.h_reunion + r.h_mant_furgos + r.h_mant_instalaciones + r.h_formacion,
    0
  );
  const avgLimp = limpieza.length > 0
    ? (limpieza.reduce((s, r) => s + (r.vestuario_h + r.limpieza_vh + r.seguridad_t + r.herramientas) / 4, 0) / limpieza.length).toFixed(2)
    : 'N/A';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6fa; margin: 0; padding: 0; }
    .wrapper { max-width: 680px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3c78, #0066b2); padding: 28px 32px; text-align: center; }
    .header img { height: 40px; margin-bottom: 10px; }
    .header h1 { color: white; font-size: 20px; margin: 0 0 4px; }
    .header p { color: #b0c8e8; font-size: 13px; margin: 0; }
    .content { padding: 28px 32px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .kpi-card { background: #f0f5ff; border: 1px solid #d0e0f8; border-radius: 8px; padding: 14px; text-align: center; }
    .kpi-card .val { font-size: 22px; font-weight: bold; color: #1e3c78; }
    .kpi-card .lbl { font-size: 11px; color: #666; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th { background: #1e3c78; color: white; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #e8ecf4; }
    tr:nth-child(even) td { background: #f5f8ff; }
    .section-title { font-size: 14px; font-weight: bold; color: #1e3c78; margin: 20px 0 8px; border-left: 4px solid #0066b2; padding-left: 8px; }
    .analysis { background: #fffbe6; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #555; margin: 10px 0; }
    .footer { background: #f8faff; border-top: 1px solid #e0e8f4; padding: 16px 32px; text-align: right; font-size: 11px; color: #888; }
    .no-data { color: #aaa; font-style: italic; text-align: center; padding: 12px; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="https://i.imgur.com/FIay1SB.png" alt="ACM Logo" />
    <h1>INFORME MENSUAL DE KPI'S</h1>
    <p>TÉCNICO: ${operario.toUpperCase()} &nbsp;·&nbsp; MES: ${mesNombre} ${año}</p>
  </div>
  <div class="content">

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="val">${totalInc}</div>
        <div class="lbl">Incidencias Documentales</div>
      </div>
      <div class="kpi-card">
        <div class="val">${puntosInc}</div>
        <div class="lbl">Puntos de Penalización</div>
      </div>
      <div class="kpi-card">
        <div class="val">${totalRet}</div>
        <div class="lbl">Retornos Atribuibles</div>
      </div>
      <div class="kpi-card">
        <div class="val">${avgLimp === 'N/A' ? 'N/A' : `${avgLimp}/10`}</div>
        <div class="lbl">Promedio Limpieza</div>
      </div>
    </div>

    <!-- Control Documental -->
    <div class="section-title">1. Control Documental</div>
    ${incidencias.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Incidencia</th><th>Puntos</th><th>Observaciones</th></tr>
      ${incidencias.map(r => `<tr><td>${r.fecha}</td><td>${r.incidencia}</td><td>${r.puntos}</td><td>${r.observaciones || ''}</td></tr>`).join('')}
    </table>` : `<p class="no-data">Sin incidencias documentales este mes.</p>`}
    <div class="analysis">
      ${totalInc === 0
        ? `${operario} no ha registrado incidencias documentales. Cumplimiento óptimo.`
        : `${totalInc} incidencias registradas con ${puntosInc} puntos de penalización.`}
    </div>

    <!-- Control Calidad / Retornos -->
    <div class="section-title">2. Retornos Atribuibles</div>
    ${retornos.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Tipo</th><th>Horas</th><th>Descripción</th></tr>
      ${retornos.map(r => `<tr><td>${r.fecha}</td><td>${r.tipo_cq}</td><td>${r.horas}</td><td>${r.descripcion}</td></tr>`).join('')}
    </table>` : `<p class="no-data">Sin retornos atribuibles este mes.</p>`}
    <div class="analysis">
      ${retornos.length === 0 ? 'Alta calidad en la ejecución. Sin retornos.' : `${retornos.length} retornos registrados. Revisar causas.`}
    </div>

    <!-- Horas Improductivas -->
    <div class="section-title">3. Horas Improductivas — Total: ${totalHorasImprod}h</div>
    ${horasImprod.length > 0 ? `
    <table>
      <tr><th>Recog. Mat.</th><th>Reunión</th><th>Mant. Furgos</th><th>Mant. Inst.</th><th>Formación</th><th>Consumibles</th></tr>
      ${horasImprod.map(r => `<tr>
        <td>${r.h_recg_mat}h</td><td>${r.h_reunion}h</td><td>${r.h_mant_furgos}h</td>
        <td>${r.h_mant_instalaciones}h</td><td>${r.h_formacion}h</td><td>${r.consumibles_e}€</td>
      </tr>`).join('')}
    </table>` : `<p class="no-data">Sin horas improductivas registradas.</p>`}

    <!-- Limpieza -->
    <div class="section-title">4. Control Limpieza — Promedio: ${avgLimp}</div>
    ${limpieza.length > 0 ? `
    <table>
      <tr><th>Vestuario/Higiene</th><th>Limpieza VH</th><th>Seguridad T.</th><th>Herramientas</th><th>Promedio</th></tr>
      ${limpieza.map(r => {
        const avg = ((r.vestuario_h + r.limpieza_vh + r.seguridad_t + r.herramientas) / 4).toFixed(2);
        return `<tr><td>${r.vestuario_h}</td><td>${r.limpieza_vh}</td><td>${r.seguridad_t}</td><td>${r.herramientas}</td><td><strong>${avg}</strong></td></tr>`;
      }).join('')}
    </table>` : `<p class="no-data">Sin registros de limpieza este mes.</p>`}

    <div class="analysis">
      Este informe fue generado automáticamente el día 1 de ${MESES[new Date().getMonth()]} ${new Date().getFullYear()} por ACM Tools.
      Para el informe completo en PDF, accede a la app y descárgalo desde la sección Informes.
    </div>
  </div>
  <div class="footer">
    Director ACM tools &nbsp;·&nbsp; Lluis Diaz
  </div>
</div>
</body>
</html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 });
  }

  const db = createClient(supabaseUrl, serviceKey);

  // Calculate previous month
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mes  = prevDate.getMonth() + 1;  // 1-12
  const año  = prevDate.getFullYear();
  const startDate = `${año}-${String(mes).padStart(2, '0')}-01`;
  const endDate   = new Date(año, mes, 0).toISOString().split('T')[0];

  // Get all active email configs
  const { data: configs, error: cfgErr } = await db
    .from('email_config')
    .select('operario_nombre, email, activo')
    .eq('activo', true);

  if (cfgErr || !configs?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No active email configs found' }), { status: 200 });
  }

  const results: Array<{ operario: string; status: string }> = [];

  for (const cfg of configs as EmailConfig[]) {
    const { operario_nombre: operario, email } = cfg;

    // Fetch Supabase data for this agent
    const [incRes, ccRes, limpRes, hiRes] = await Promise.all([
      db.from('incidencias').select('fecha,incidencia,puntos,observaciones').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate),
      db.from('control_calidad').select('fecha,tipo_cq,horas,total_cq,descripcion').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate),
      db.from('limpieza').select('vestuario_h,limpieza_vh,seguridad_t,herramientas').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate),
      db.from('horas_improductivas').select('h_recg_mat,h_reunion,h_mant_furgos,h_mant_instalaciones,h_formacion,consumibles_e').eq('operario', operario).gte('fecha', startDate).lte('fecha', endDate),
    ]);

    const html = buildEmailHtml(
      operario, mes, año,
      (incRes.data  || []) as IncidenciaRow[],
      (ccRes.data   || []) as ControlCalidadRow[],
      (limpRes.data || []) as LimpiezaRow[],
      (hiRes.data   || []) as HorasImprodRow[],
    );

    // Send via Resend
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ACM Tools <informes@acmtools.com>',
        to: [email],
        subject: `Informe KPI — ${operario} — ${MESES[mes - 1]} ${año}`,
        html,
      }),
    });

    results.push({ operario, status: sendRes.ok ? 'sent' : `error:${sendRes.status}` });
  }

  return new Response(JSON.stringify({ sent: results.filter(r => r.status === 'sent').length, results }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
