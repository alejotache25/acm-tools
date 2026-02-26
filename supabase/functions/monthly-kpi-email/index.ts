import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const C = {
  navy:   rgb(0.051, 0.184, 0.431),
  blue:   rgb(0.086, 0.396, 0.753),
  white:  rgb(1, 1, 1),
  lBlue:  rgb(0.953, 0.969, 1.0),
  text:   rgb(0.1, 0.1, 0.1),
  green:  rgb(0.102, 0.451, 0.251),
  red:    rgb(0.773, 0.133, 0.122),
  border: rgb(0.8, 0.86, 0.93),
  yellow: rgb(1, 0.992, 0.878),
  grey:   rgb(0.6, 0.6, 0.6),
  lGreen: rgb(0.902, 0.957, 0.914),
  lRed:   rgb(0.988, 0.91, 0.902),
};

// Safe base64 conversion for large Uint8Array
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function drawTable(
  page: any, font: any, bold: any,
  headers: string[], rows: string[][],
  x: number, startY: number, colWidths: number[],
  rowH = 18, fontSize = 8,
): number {
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  page.drawRectangle({ x, y: startY - rowH, width: totalW, height: rowH, color: C.blue });
  let cx = x;
  headers.forEach((h, i) => {
    page.drawText(h, { x: cx + 3, y: startY - rowH + 5, size: fontSize - 0.5, font: bold, color: C.white, maxWidth: colWidths[i] - 6 });
    cx += colWidths[i];
  });

  let curY = startY - rowH;
  rows.forEach((row, ri) => {
    const rY = curY - rowH;
    page.drawRectangle({ x, y: rY, width: totalW, height: rowH, color: ri % 2 === 0 ? C.white : C.lBlue });
    page.drawLine({ start: { x, y: rY }, end: { x: x + totalW, y: rY }, thickness: 0.3, color: C.border });
    let cx2 = x;
    row.forEach((cell, ci) => {
      const text = String(cell || '');
      const clipped = text.length > 40 ? text.substring(0, 38) + '..' : text;
      page.drawText(clipped, { x: cx2 + 3, y: rY + 5, size: fontSize, font, color: C.text, maxWidth: colWidths[ci] - 6 });
      cx2 += colWidths[ci];
    });
    curY = rY;
  });

  page.drawRectangle({ x, y: curY, width: totalW, height: startY - curY, opacity: 0, borderColor: C.border, borderWidth: 0.5 });
  return curY;
}

function addHeader(page: any, bold: any, font: any, operario: string, mesNombre: string, año: number) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 48, width, height: 48, color: C.navy });
  page.drawText("INFORME MENSUAL DE KPI'S", { x: 20, y: height - 22, size: 13, font: bold, color: C.white });
  page.drawText(`TÉCNICO: ${operario.toUpperCase()}   ·   ${mesNombre.toUpperCase()} ${año}`, { x: 20, y: height - 38, size: 8, font, color: rgb(0.565, 0.792, 0.976) });
  page.drawRectangle({ x: 0, y: height - 52, width, height: 4, color: C.blue });
}

function addFooter(page: any, font: any) {
  const { width } = page.getSize();
  page.drawLine({ start: { x: 20, y: 28 }, end: { x: width - 20, y: 28 }, thickness: 0.5, color: C.border });
  page.drawText('Director ACM tools   ·   Lluis Diaz', { x: width - 165, y: 15, size: 8, font, color: C.grey });
}

function addSectionTitle(page: any, bold: any, text: string, x: number, y: number) {
  page.drawRectangle({ x, y: y - 2, width: 3, height: 14, color: C.blue });
  page.drawText(text, { x: x + 8, y, size: 11, font: bold, color: C.navy });
}

function addAnalysisBox(page: any, font: any, text: string, x: number, y: number) {
  page.drawRectangle({ x, y: y - 30, width: 535, height: 30, color: C.yellow, borderColor: rgb(0.976, 0.659, 0.145), borderWidth: 0.5 });
  page.drawText(text, { x: x + 8, y: y - 19, size: 9, font, color: rgb(0.3, 0.22, 0.05), maxWidth: 519 });
}

async function buildPdf(
  operario: string, mes: number, año: number,
  inc: any[], cc: any[], limp: any[], hi: any[], visitas: any[]
): Promise<Uint8Array> {
  const pdf  = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mesNombre = MESES[mes - 1];

  const retornos  = cc.filter((r: any) => r.tipo_cq === 'RETORNO ATRIBUIBLE');
  const totalInc  = inc.length;
  const puntosInc = inc.reduce((s: number, r: any) => s + (r.puntos || 0), 0);
  const totalRet  = retornos.length;
  const totalHI   = hi.reduce((s: number, r: any) =>
    s + (r.h_recg_mat||0) + (r.h_reunion||0) + (r.h_mant_furgos||0) + (r.h_mant_instalaciones||0) + (r.h_formacion||0), 0);
  const avgLimp   = limp.length > 0
    ? (limp.reduce((s: number, r: any) => s + ((r.vestuario_h||0)+(r.limpieza_vh||0)+(r.seguridad_t||0)+(r.herramientas||0))/4, 0) / limp.length).toFixed(2)
    : 'N/A';

  // ── PAGE 1: Resumen KPI ──────────────────────────────────────────────────
  {
    const pg = pdf.addPage([595, 842]);
    const H  = pg.getSize().height;
    addHeader(pg, bold, font, operario, mesNombre, año);
    addFooter(pg, font);

    let y = H - 72;
    addSectionTitle(pg, bold, "RESUMEN DE KPI'S DEL MES", 30, y);
    y -= 28;

    const cardData = [
      { label: 'Incidencias documentales', val: String(totalInc),                              good: totalInc === 0 },
      { label: 'Puntos de penalización',   val: String(puntosInc),                             good: puntosInc === 0 },
      { label: 'Retornos atribuibles',     val: String(totalRet),                              good: totalRet === 0 },
      { label: 'Horas improductivas',      val: `${totalHI}h`,                                 good: totalHI < 10 },
      { label: 'Promedio limpieza',        val: avgLimp === 'N/A' ? 'N/A' : `${avgLimp}/10`,  good: true },
      { label: 'Registros de visita',      val: String(visitas.length),                        good: true },
    ];

    const cW = 170, cH = 60, gX = 12;
    cardData.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = 30 + col * (cW + gX);
      const cy = y - row * (cH + gX);
      pg.drawRectangle({ x: cx, y: cy - cH, width: cW, height: cH, color: c.good ? C.lGreen : C.lRed, borderColor: c.good ? rgb(0.4,0.75,0.45) : rgb(0.85,0.35,0.3), borderWidth: 1 });
      pg.drawText(c.val, { x: cx + cW/2 - c.val.length * 5, y: cy - 30, size: 18, font: bold, color: c.good ? C.green : C.red });
      pg.drawText(c.label, { x: cx + 6, y: cy - cH + 8, size: 7.5, font, color: rgb(0.35,0.35,0.35), maxWidth: cW - 12 });
    });

    y -= 2 * (cH + gX) + 20;
    const nota = totalInc === 0
      ? `${operario} no registró incidencias documentales en ${mesNombre} ${año}. Cumplimiento óptimo.`
      : `Se registraron ${totalInc} incidencias con ${puntosInc} puntos de penalización en ${mesNombre} ${año}.`;
    addAnalysisBox(pg, font, nota, 30, y);
  }

  // ── PAGE 2: Control Documental ───────────────────────────────────────────
  {
    const pg = pdf.addPage([595, 842]);
    const H  = pg.getSize().height;
    addHeader(pg, bold, font, operario, mesNombre, año);
    addFooter(pg, font);
    let y = H - 72;
    addSectionTitle(pg, bold, 'CONTROL DOCUMENTAL — INCIDENCIAS', 30, y);
    y -= 25;
    if (inc.length > 0) {
      const endY = drawTable(pg, font, bold,
        ['Fecha','Incidencia','Puntos','Observaciones'],
        inc.map((r:any) => [r.fecha||'', r.incidencia||'', String(r.puntos||0), r.observaciones||'']),
        30, y, [70, 195, 55, 215]);
      if (endY > 60) addAnalysisBox(pg, font, `${totalInc} incidencias — ${puntosInc} puntos de penalización.`, 30, endY - 10);
    } else {
      pg.drawText('Sin incidencias documentales registradas en este período.', { x:30, y:y-30, size:10, font, color:C.grey });
      addAnalysisBox(pg, font, `${operario} no registró incidencias documentales. Cumplimiento óptimo.`, 30, y - 55);
    }
  }

  // ── PAGE 3: Control de Calidad / Retornos ────────────────────────────────
  {
    const pg = pdf.addPage([595, 842]);
    const H  = pg.getSize().height;
    addHeader(pg, bold, font, operario, mesNombre, año);
    addFooter(pg, font);
    let y = H - 72;
    addSectionTitle(pg, bold, 'CONTROL DE CALIDAD — RETORNOS', 30, y);
    y -= 25;
    if (cc.length > 0) {
      const endY = drawTable(pg, font, bold,
        ['Fecha','Tipo CQ','Horas','Total CQ','Descripción'],
        cc.map((r:any) => [r.fecha||'', r.tipo_cq||'', String(r.horas||0), String(r.total_cq||0), r.descripcion||'']),
        30, y, [65, 115, 50, 60, 245]);
      if (endY > 60) addAnalysisBox(pg, font, totalRet === 0 ? 'Sin retornos atribuibles. Calidad óptima en la ejecución.' : `${totalRet} retornos atribuibles registrados.`, 30, endY - 10);
    } else {
      pg.drawText('Sin registros de control de calidad en este período.', { x:30, y:y-30, size:10, font, color:C.grey });
      addAnalysisBox(pg, font, 'Sin retornos atribuibles. Calidad óptima en la ejecución.', 30, y - 55);
    }
  }

  // ── PAGE 4: Limpieza ─────────────────────────────────────────────────────
  {
    const pg = pdf.addPage([595, 842]);
    const H  = pg.getSize().height;
    addHeader(pg, bold, font, operario, mesNombre, año);
    addFooter(pg, font);
    let y = H - 72;
    addSectionTitle(pg, bold, `CONTROL DE LIMPIEZA — PROMEDIO: ${avgLimp}`, 30, y);
    y -= 25;
    if (limp.length > 0) {
      drawTable(pg, font, bold,
        ['Vestuario/H','Limpieza VH','Seguridad T.','Herramientas','Promedio'],
        limp.map((r:any) => {
          const a = (((r.vestuario_h||0)+(r.limpieza_vh||0)+(r.seguridad_t||0)+(r.herramientas||0))/4).toFixed(2);
          return [String(r.vestuario_h||0), String(r.limpieza_vh||0), String(r.seguridad_t||0), String(r.herramientas||0), a];
        }),
        30, y, [107, 107, 107, 107, 107]);
    } else {
      pg.drawText('Sin registros de limpieza en este período.', { x:30, y:y-30, size:10, font, color:C.grey });
    }
  }

  // ── PAGE 5: Horas Improductivas ──────────────────────────────────────────
  {
    const pg = pdf.addPage([595, 842]);
    const H  = pg.getSize().height;
    addHeader(pg, bold, font, operario, mesNombre, año);
    addFooter(pg, font);
    let y = H - 72;
    addSectionTitle(pg, bold, `HORAS IMPRODUCTIVAS — TOTAL: ${totalHI}h`, 30, y);
    y -= 25;
    if (hi.length > 0) {
      const endY = drawTable(pg, font, bold,
        ['Recog. Mat.','Reunión','Mant. Furgos','Mant. Inst.','Formación','Consumibles €'],
        hi.map((r:any) => [
          `${r.h_recg_mat||0}h`, `${r.h_reunion||0}h`, `${r.h_mant_furgos||0}h`,
          `${r.h_mant_instalaciones||0}h`, `${r.h_formacion||0}h`, `${r.consumibles_e||0}€`
        ]),
        30, y, [90, 82, 88, 82, 82, 111]);
      if (endY > 60) addAnalysisBox(pg, font, `Total horas improductivas del mes: ${totalHI}h.`, 30, endY - 10);
    } else {
      pg.drawText('Sin horas improductivas registradas en este período.', { x:30, y:y-30, size:10, font, color:C.grey });
    }
  }

  // ── PAGE 6: Visitas (solo si hay datos) ──────────────────────────────────
  if (visitas.length > 0) {
    const pg = pdf.addPage([595, 842]);
    const H  = pg.getSize().height;
    addHeader(pg, bold, font, operario, mesNombre, año);
    addFooter(pg, font);
    let y = H - 72;
    addSectionTitle(pg, bold, 'VISITAS', 30, y);
    y -= 25;
    const cols = Object.keys(visitas[0]).filter(k => k !== 'id' && k !== 'operario' && k !== 'created_at');
    const colW = Math.floor(535 / Math.max(cols.length, 1));
    drawTable(pg, font, bold,
      cols.map(c => c.replace(/_/g,' ').toUpperCase()),
      visitas.map((r:any) => cols.map(c => String(r[c] ?? ''))),
      30, y, cols.map(() => colW));
  }

  return pdf.save();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmailConfig  { jefe_id: string; email: string; }
interface JefeOperario { operario_nombre: string; }

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey   = Deno.env.get('RESEND_API_KEY');
  const fromEmail   = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev';

  if (!resendKey) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500 });

  const db = createClient(supabaseUrl, serviceKey);
  const now      = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mes   = prevDate.getMonth() + 1;
  const año   = prevDate.getFullYear();
  const start = `${año}-${String(mes).padStart(2,'0')}-01`;
  const end   = new Date(año, mes, 0).toISOString().split('T')[0];

  const { data: configs } = await db.from('email_config').select('jefe_id, email').eq('activo', true);
  if (!configs?.length) return new Response(JSON.stringify({ sent: 0, message: 'No active configs' }));

  const results: { jefe: string; operario: string; status: string }[] = [];

  for (const cfg of configs as EmailConfig[]) {
    const { data: asignados } = await db.from('jefe_operario').select('operario_nombre').eq('jefe_id', cfg.jefe_id);
    if (!asignados?.length) continue;

    for (const row of asignados as JefeOperario[]) {
      const op = row.operario_nombre;

      const [incRes, ccRes, limpRes, hiRes, visRes] = await Promise.all([
        db.from('incidencias').select('fecha,incidencia,puntos,observaciones').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('control_calidad').select('fecha,tipo_cq,horas,total_cq,descripcion').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('limpieza').select('vestuario_h,limpieza_vh,seguridad_t,herramientas').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('horas_improductivas').select('h_recg_mat,h_reunion,h_mant_furgos,h_mant_instalaciones,h_formacion,consumibles_e').eq('operario', op).gte('fecha', start).lte('fecha', end),
        db.from('visitas').select('*').eq('operario', op).gte('fecha', start).lte('fecha', end),
      ]);

      // Generate PDF
      const pdfBytes  = await buildPdf(op, mes, año, incRes.data||[], ccRes.data||[], limpRes.data||[], hiRes.data||[], visRes.data||[]);
      const base64Pdf = uint8ToBase64(pdfBytes);
      const filename  = `informe_${op.replace(/\s+/g,'_').toLowerCase()}_${MESES[mes-1].toLowerCase()}_${año}.pdf`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `ACM Tools <${fromEmail}>`,
          to: [cfg.email],
          subject: `📊 Informe KPI — ${op} — ${MESES[mes-1]} ${año}`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px;background:#f0f4fa">
            <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
              <div style="background:linear-gradient(135deg,#0d2f6e,#1565c0);padding:22px 28px">
                <img src="https://i.imgur.com/FIay1SB.png" alt="ACM" style="height:32px;margin-bottom:8px;display:block"/>
                <h1 style="color:#fff;font-size:16px;margin:0 0 4px">INFORME MENSUAL DE KPI'S</h1>
                <p style="color:#90caf9;font-size:11px;margin:0">TÉCNICO: ${op.toUpperCase()} · ${MESES[mes-1].toUpperCase()} ${año}</p>
              </div>
              <div style="padding:22px 28px">
                <p style="color:#333;font-size:13px;margin:0 0 12px">Adjunto encontrarás el informe completo en PDF de <strong>${op}</strong> correspondiente a <strong>${MESES[mes-1]} ${año}</strong>.</p>
                <p style="color:#888;font-size:11px;margin:0">Para descargar informes adicionales accede a <strong>ACM Tools → Informes</strong>.</p>
              </div>
              <div style="background:#f5f8ff;border-top:1px solid #dde6f4;padding:12px 28px;text-align:right;font-size:10px;color:#aaa">
                Director ACM tools · Lluis Diaz
              </div>
            </div>
          </div>`,
          attachments: [{ filename, content: base64Pdf }],
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
