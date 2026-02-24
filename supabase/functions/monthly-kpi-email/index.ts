/**
 * monthly-kpi-email — Supabase Edge Function
 *
 * El día 1 de cada mes a las 09:00 envía al JEFE un email por cada uno de sus
 * agentes asignados, con el informe del mes anterior.
 *
 * Flujo:
 *   1. Lee email_config (jefe_id + email + activo=true)
 *   2. Para cada jefe, lee jefe_operario (sus agentes)
 *   3. Para cada agente consulta Supabase del mes anterior
 *   4. Envía un email por agente al jefe via Resend
 *
 * Activar con pg_cron (Supabase SQL Editor):
 *
 *   SELECT cron.schedule(
 *     'monthly-kpi-email',
 *     '0 9 1 * *',
 *     $$
 *       SELECT net.http_post(
 *         url := 'https://<PROJECT_REF>.supabase.co/functions/v1/monthly-kpi-email',
 *         headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>",
 *                      "Content-Type": "application/json"}',
 *         body := '{}'
 *       );
 *     $$
 *   );
 *
 * Variables de entorno requeridas (Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY           — clave de API de resend.com
 *   SUPABASE_URL             — inyectada automáticamente
 *   SUPABASE_SERVICE_ROLE_KEY — inyectada automáticamente
 *   FROM_EMAIL               — ej: informes@tudominio.com (o onboarding@resend.dev en dev)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailConfig {
  jefe_id: string;
  email: string;
}

interface JefeOperario {
  operario_nombre: string;
}

interface IncRow { fecha: string; incidencia: string; puntos: number; observaciones?: string; }
interface CCRow  { fecha: string; tipo_cq: string; horas: number; total_cq: number; descripcion: string; }
interface LimpRow { vestuario_h: number; limpieza_vh: number; seguridad_t: number; herramientas: number; }
interface HIRow  { h_recg_mat: number; h_reunion: number; h_mant_furgos: number; h_mant_instalaciones: number; h_formacion: number; consumibles_e: number; }

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(
  operario: string,
  mes: number,
  año: number,
  inc: IncRow[],
  cc: CCRow[],
  limp: LimpRow[],
  hi: HIRow[],
): string {
  const mesNombre    = MESES[mes - 1];
  const totalInc     = inc.length;
  const puntosInc    = inc.reduce((s, r) => s + r.puntos, 0);
  const retornos     = cc.filter(r => r.tipo_cq === 'RETORNO ATRIBUIBLE');
  const totalRet     = retornos.length;
  const totalHI      = hi.reduce((s, r) => s + r.h_recg_mat + r.h_reunion + r.h_mant_furgos + r.h_mant_instalaciones + r.h_formacion, 0);
  const avgLimp      = limp.length > 0
    ? (limp.reduce((s, r) => s + (r.vestuario_h + r.limpieza_vh + r.seguridad_t + r.herramientas) / 4, 0) / limp.length).toFixed(2)
    : 'N/A';

  const cardColor = (ok: boolean) => ok ? '#e6f4ea' : '#fce8e6';
  const valColor  = (ok: boolean) => ok ? '#1a7340' : '#c5221f';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f0f4fa;margin:0;padding:20px}
  .wrap{max-width:660px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.12)}
  .hdr{background:linear-gradient(135deg,#0d2f6e,#1565c0);padding:24px 32px;text-align:center}
  .hdr img{height:38px;margin-bottom:8px}
  .hdr h1{color:#fff;font-size:18px;margin:0 0 4px}
  .hdr p{color:#90caf9;font-size:12px;margin:0}
  .body{padding:24px 32px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}
  .card{border-radius:8px;padding:14px;text-align:center}
  .card .v{font-size:22px;font-weight:700}
  .card .l{font-size:11px;color:#666;margin-top:2px}
  .sec{font-size:13px;font-weight:700;color:#0d2f6e;margin:18px 0 6px;border-left:4px solid #1565c0;padding-left:8px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
  th{background:#1565c0;color:#fff;padding:7px 9px;text-align:left}
  td{padding:6px 9px;border-bottom:1px solid #e8ecf4}
  tr:nth-child(even) td{background:#f5f8ff}
  .note{color:#aaa;font-style:italic;text-align:center;padding:10px;font-size:12px}
  .ana{background:#fffde7;border-left:4px solid #f9a825;padding:9px 13px;border-radius:4px;font-size:11px;color:#555;margin:8px 0}
  .ftr{background:#f5f8ff;border-top:1px solid #dde6f4;padding:14px 32px;text-align:right;font-size:11px;color:#888}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <img src="https://i.imgur.com/FIay1SB.png" alt="ACM"/>
    <h1>INFORME MENSUAL DE KPI'S</h1>
    <p>TÉCNICO: ${operario.toUpperCase()} &nbsp;·&nbsp; ${mesNombre.toUpperCase()} ${año}</p>
  </div>
  <div class="body">
    <div class="grid">
      <div class="card" style="background:${cardColor(totalInc===0)}">
        <div class="v" style="color:${valColor(totalInc===0)}">${totalInc}</div>
        <div class="l">Incidencias documentales</div>
      </div>
      <div class="card" style="background:${cardColor(puntosInc===0)}">
        <div class="v" style="color:${valColor(puntosInc===0)}">${puntosInc}</div>
        <div class="l">Puntos de penalización</div>
      </div>
      <div class="card" style="background:${cardColor(totalRet===0)}">
        <div class="v" style="color:${valColor(totalRet===0)}">${totalRet}</div>
        <div class="l">Retornos atribuibles</div>
      </div>
      <div class="card" style="background:#e8f0fe">
        <div class="v" style="color:#1a3c8e">${avgLimp === 'N/A' ? 'N/A' : avgLimp + '/10'}</div>
        <div class="l">Promedio limpieza</div>
      </div>
    </div>

    <div class="sec">Control Documental</div>
    ${inc.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Incidencia</th><th>Puntos</th><th>Observaciones</th></tr>
      ${inc.map(r=>`<tr><td>${r.fecha}</td><td>${r.incidencia}</td><td>${r.puntos}</td><td>${r.observaciones||''}</td></tr>`).join('')}
    </table>` : `<p class="note">Sin incidencias documentales este mes.</p>`}
    <div class="ana">${totalInc===0 ? `${operario} no registró incidencias documentales. Cumplimiento óptimo.` : `${totalInc} incidencias — ${puntosInc} puntos de penalización.`}</div>

    <div class="sec">Retornos Atribuibles</div>
    ${retornos.length > 0 ? `
    <table>
      <tr><th>Fecha</th><th>Tipo</th><th>Horas</th><th>Descripción</th></tr>
      ${retornos.map(r=>`<tr><td>${r.fecha}</td><td>${r.tipo_cq}</td><td>${r.horas}</td><td>${r.descripcion}</td></tr>`).join('')}
    </table>` : `<p class="note">Sin retornos atribuibles este mes.</p>`}
    <div class="ana">${totalRet===0 ? 'Alta calidad en la ejecución. Sin retornos.' : `${totalRet} retornos registrados. Revisar causas.`}</div>

    <div class="sec">Horas Improductivas — Total: ${totalHI}h</div>
    ${hi.length > 0 ? `
    <table>
      <tr><th>Recog. Mat.</th><th>Reunión</th><th>Mant. Furgos</th><th>Formación</th><th>Consumibles</th></tr>
      ${hi.map(r=>`<tr><td>${r.h_recg_mat}h</td><td>${r.h_reunion}h</td><td>${r.h_mant_furgos}h</td><td>${r.h_formacion}h</td><td>${r.consumibles_e}€</td></tr>`).join('')}
    </table>` : `<p class="note">Sin horas improductivas registradas.</p>`}

    <div class="sec">Control Limpieza — Promedio: ${avgLimp}</div>
    ${limp.length > 0 ? `
    <table>
      <tr><th>Vestuario</th><th>Limpieza VH</th><th>Seguridad</th><th>Herramientas</th><th>Promedio</th></tr>
      ${limp.map(r=>{const a=((r.vestuario_h+r.limpieza_vh+r.seguridad_t+r.herramientas)/4).toFixed(2);return`<tr><td>${r.vestuario_h}</td><td>${r.limpieza_vh}</td><td>${r.seguridad_t}</td><td>${r.herramientas}</td><td><b>${a}</b></td></tr>`;}).join('')}
    </table>` : `<p class="note">Sin registros de limpieza.</p>`}

    <div class="ana" style="margin-top:16px">
      Informe generado automáticamente el 1 de ${MESES[new Date().getMonth()]} ${new Date().getFullYear()}.
      Para el informe completo en PDF accede a ACM Tools → Informes.
    </div>
  </div>
  <div class="ftr">Director ACM tools &nbsp;·&nbsp; Lluis Diaz</div>
</div>
</body></html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey    = Deno.env.get('RESEND_API_KEY');
  const fromEmail    = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev';

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500 });
  }

  const db = createClient(supabaseUrl, serviceKey);

  // Previous month
  const now      = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mes      = prevDate.getMonth() + 1;
  const año      = prevDate.getFullYear();
  const start    = `${año}-${String(mes).padStart(2,'0')}-01`;
  const end      = new Date(año, mes, 0).toISOString().split('T')[0];

  // 1. Get all active jefe email configs
  const { data: configs } = await db
    .from('email_config')
    .select('jefe_id, email')
    .eq('activo', true);

  if (!configs?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No active configs' }));
  }

  const results: { jefe: string; operario: string; status: string }[] = [];

  for (const cfg of configs as EmailConfig[]) {
    // 2. Get this jefe's agents
    const { data: asignados } = await db
      .from('jefe_operario')
      .select('operario_nombre')
      .eq('jefe_id', cfg.jefe_id);

    if (!asignados?.length) continue;

    for (const row of asignados as JefeOperario[]) {
      const op = row.operario_nombre;

      // 3. Fetch Supabase data for this agent in the previous month
      const [incRes, ccRes, limpRes, hiRes] = await Promise.all([
        db.from('incidencias').select('fecha,incidencia,puntos,observaciones').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('control_calidad').select('fecha,tipo_cq,horas,total_cq,descripcion').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('limpieza').select('vestuario_h,limpieza_vh,seguridad_t,herramientas').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('horas_improductivas').select('h_recg_mat,h_reunion,h_mant_furgos,h_mant_instalaciones,h_formacion,consumibles_e').eq('operario', op).gte('fecha', start).lte('fecha', end),
      ]);

      const html = buildHtml(
        op, mes, año,
        (incRes.data  || []) as IncRow[],
        (ccRes.data   || []) as CCRow[],
        (limpRes.data || []) as LimpRow[],
        (hiRes.data   || []) as HIRow[],
      );

      // 4. Send via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `ACM Tools <${fromEmail}>`,
          to: [cfg.email],
          subject: `📊 Informe KPI — ${op} — ${MESES[mes-1]} ${año}`,
          html,
        }),
      });

      results.push({ jefe: cfg.jefe_id, operario: op, status: res.ok ? 'sent' : `error:${res.status}` });
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;
  return new Response(JSON.stringify({ sent, total: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
