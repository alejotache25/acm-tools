/**
 * pdfReport.ts
 * Generates the 9-section monthly KPI PDF report matching the ACM Tools template.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Incidencia, ControlCalidad, Visita, Limpieza, HorasImproductivas } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthData {
  prod_pct:     number;
  ctrl_doc_pts: number;
  ctrl_vis_pct: number;
  retorno_pct:  number;
  herr_pct:     number;
  vehic_pct:    number;
  aseo_pct:     number;
  h_obj:        number;
  h_inv:        number;
  objetivo:     number;
  dietas:       number;
  h_ext:        number;
}

type YearData = Record<number, MonthData>;

export interface ReportParams {
  operario:       string;
  mes:            number;   // 1-12 — the month to highlight / filter Supabase data
  año:            number;
  kpiData:        YearData; // full-year data from localStorage
  kpiRef:         number;
  incidencias:    Incidencia[];
  controlCalidad: ControlCalidad[];
  visitas:        Visita[];
  limpieza:       Limpieza[];
  horasImprod:    HorasImproductivas[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const DEFAULT_MONTH: MonthData = {
  prod_pct: 100, ctrl_doc_pts: 1, ctrl_vis_pct: 100, retorno_pct: 0,
  herr_pct: 100, vehic_pct: 100, aseo_pct: 100,
  h_obj: 1.5, h_inv: 0, objetivo: 250, dietas: 0, h_ext: 0,
};

const PENALTY_RATE = 39;

// Header/accent colours matching ACM branding
const DARK_BLUE : [number,number,number] = [30, 60, 120];
const MID_BLUE  : [number,number,number] = [0, 102, 178];
const LIGHT_BLUE: [number,number,number] = [220, 235, 250];
const HEADER_BG : [number,number,number] = [8, 46, 102];

// ─── KPI Calculation (mirror of KPIMensual.tsx) ───────────────────────────────

function lookupProd(pct: number): number {
  if (pct >= 120) return 100;
  if (pct >= 110) return 100;
  if (pct >= 105) return 100;
  if (pct >= 100) return 100;
  if (pct >= 95)  return 75;
  if (pct >= 90)  return 50;
  if (pct >= 80)  return 25;
  return 0;
}

function lookupCtrlDoc(pts: number): number {
  if (pts >= 80) return 0;
  if (pts >= 70) return 25;
  if (pts >= 60) return 50;
  if (pts >= 50) return 75;
  if (pts >= 1)  return 100;
  return -25;
}

function lookupVis(pct: number): number { return pct >= 100 ? 25 : -25; }
function lookupHerr(pct: number): number { return pct >= 100 ? 5 : 0; }
function lookupVehic(pct: number): number { return pct >= 100 ? 10 : 0; }
function lookupAseo(pct: number): number { return pct >= 100 ? 10 : 0; }

function getMD(data: YearData, mes: number): MonthData {
  return data[mes] ?? { ...DEFAULT_MONTH };
}

function calcRows(data: YearData, kpiRef: number) {
  let acc_prod = 0, acc_ctrl_doc = 0, acc_ctrl_vis = 0, acc_ret = 0;
  let acc_herr = 0, acc_vehic = 0, acc_aseo = 0, acc_total = 0;
  let running_acum = 0;

  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const md  = getMD(data, mes);

    const imp_prod     = lookupProd(md.prod_pct);
    const imp_ctrl_doc = lookupCtrlDoc(md.ctrl_doc_pts);
    const imp_ctrl_vis = lookupVis(md.ctrl_vis_pct);
    const net_pct      = md.prod_pct - md.retorno_pct;
    const imp_ret      = lookupProd(net_pct);
    const imp_herr     = lookupHerr(md.herr_pct);
    const imp_vehic    = lookupVehic(md.vehic_pct);
    const imp_aseo     = lookupAseo(md.aseo_pct);
    const h_dif        = md.h_inv - md.h_obj;
    const h_pct        = md.h_obj > 0 ? (h_dif / md.h_obj) * 100 : 0;
    const penalizacion = +(Math.max(h_dif, 0) * PENALTY_RATE).toFixed(2);
    const total        = +(imp_ctrl_doc + imp_ctrl_vis + imp_ret + imp_herr + imp_vehic + imp_aseo - penalizacion).toFixed(2);
    const cobrar       = Math.max(total - kpiRef, 0);

    acc_prod     += imp_prod;
    acc_ctrl_doc += imp_ctrl_doc;
    acc_ctrl_vis += imp_ctrl_vis;
    acc_ret      += imp_ret;
    acc_herr     += imp_herr;
    acc_vehic    += imp_vehic;
    acc_aseo     += imp_aseo;
    acc_total    += total;
    running_acum += total;

    return {
      mes, md,
      imp_prod, acc_prod,
      imp_ctrl_doc, acc_ctrl_doc,
      imp_ctrl_vis, acc_ctrl_vis,
      net_pct, imp_ret, acc_ret,
      imp_herr, acc_herr,
      imp_vehic, acc_vehic,
      imp_aseo, acc_aseo,
      h_dif, h_pct, penalizacion,
      total, acc_total,
      cobrar, acumulado: running_acum,
    };
  });
}

// ─── Image Loader ─────────────────────────────────────────────────────────────

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Page Header / Footer ─────────────────────────────────────────────────────

function addPageHeader(
  doc: jsPDF,
  operario: string,
  mes: number,
  año: number,
  logoBase64: string | null,
) {
  const pw = doc.internal.pageSize.getWidth();

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', 10, 6, 32, 14); } catch { /* skip */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...DARK_BLUE);
  doc.text('INFORME MENSUAL DE KPI\'S', pw / 2, 12, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(`TECNICO: ${operario.toUpperCase()}`, pw / 2, 18, { align: 'center' });
  doc.text(`MES: ${MESES[mes - 1]} ${año}`, pw / 2, 23, { align: 'center' });

  // Separator line
  doc.setDrawColor(...MID_BLUE);
  doc.setLineWidth(0.5);
  doc.line(10, 26, pw - 10, 26);
}

function addPageFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Director ACM tools', pw - 12, ph - 12, { align: 'right' });
  doc.text('Lluis Diaz', pw - 12, ph - 8, { align: 'right' });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK_BLUE);
  doc.text(title, 10, y);
  return y + 4;
}

function fmt(n: number, unit = '€'): string {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}${unit}`;
}

function pct(n: number): string { return `${Math.round(n)}%`; }

// ─── Page 1: KPI Anual + RESUMEN INCENTIVOS ───────────────────────────────────

function page1Kpi(doc: jsPDF, params: ReportParams, logo: string | null, rows: ReturnType<typeof calcRows>) {
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '1. INFORME KPI', 31);

  // Big KPI table — landscape, so it fits
  const head1: string[][] = [
    [
      'MES',
      '%Obj','Imp','Acum',        // PRODUCTIVIDAD
      '%Obj','Imp','Acum',        // CALIDAD DOC
      '%Obj','Imp','Acum',        // CONTROL VISITAS
      '%Obj','%P-%R','Imp','Acum',// RETORNO
      '%Obj','Imp','Acum',        // HERRAMIENTAS
      '%Obj','Imp','Acum',        // VEHÍCULO
      '%Obj','Imp','Acum',        // ASEO PERSONAL
      'Obj','Inv','Dif','%','Pen',// HORAS IMPROD
      'TOTAL',
    ],
  ];

  const body1 = rows.map(r => [
    MESES[r.mes - 1],
    pct(r.md.prod_pct), fmt(r.imp_prod), fmt(r.acc_prod),
    String(r.md.ctrl_doc_pts), fmt(r.imp_ctrl_doc), fmt(r.acc_ctrl_doc),
    pct(r.md.ctrl_vis_pct), fmt(r.imp_ctrl_vis), fmt(r.acc_ctrl_vis),
    pct(r.md.prod_pct), pct(r.net_pct), fmt(r.imp_ret), fmt(r.acc_ret),
    pct(r.md.herr_pct), fmt(r.imp_herr), fmt(r.acc_herr),
    pct(r.md.vehic_pct), fmt(r.imp_vehic), fmt(r.acc_vehic),
    pct(r.md.aseo_pct), fmt(r.imp_aseo), fmt(r.acc_aseo),
    String(r.md.h_obj), String(r.md.h_inv), r.h_dif.toFixed(1),
    pct(r.h_pct), fmt(r.penalizacion),
    fmt(r.total),
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        { content: 'CUADRO MENSUAL INCENTIVOS ACM', colSpan: 31, styles: { halign: 'center', fillColor: HEADER_BG, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 } },
      ],
      [
        { content: 'MES', rowSpan: 2 },
        { content: 'PRODUCTIVIDAD', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'CALIDAD DOCUMENTAL', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'CONTROL VISITAS', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'RETORNO', colSpan: 4, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'HERRAMIENTAS', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'VEHÍCULO', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'ASEO PERSONAL', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'HORAS IMPRODUCTIVAS', colSpan: 5, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255] } },
        { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      ],
      head1[0],
    ],
    body: body1,
    styles: { fontSize: 5.5, cellPadding: 1, halign: 'center' },
    headStyles: { fillColor: [200, 215, 235], textColor: [30,30,30], fontStyle: 'bold', fontSize: 5.5 },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 14 } },
    margin: { left: 8, right: 8 },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // RESUMEN INCENTIVOS
  let ry = afterTable;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_BLUE);
  doc.text('RESUMEN INCENTIVOS', 10, ry);
  ry += 4;

  let total_importe = 0, total_cobrar = 0, total_objetivo = 0, total_dietas = 0;
  let totalp_importe = 0, totalp_cobrar = 0, totalp_objetivo = 0;

  const resumenBody: string[][] = [];
  for (const r of rows) {
    if (r.mes > params.mes) continue; // only show up to current report month
    total_importe  += r.total;
    total_cobrar   += r.cobrar;
    total_objetivo += r.md.objetivo;
    total_dietas   += r.md.dietas;
    if (r.total > 0) {
      totalp_importe  += r.total;
      totalp_cobrar   += r.cobrar;
      totalp_objetivo += r.md.objetivo;
    }
    resumenBody.push([
      MESES[r.mes - 1],
      fmt(r.total), fmt(r.acumulado), fmt(r.cobrar),
      fmt(r.md.objetivo), fmt(r.md.dietas),
    ]);
  }

  const pct_objetivo = totalp_objetivo > 0
    ? Math.round((total_cobrar / totalp_objetivo) * 100)
    : 0;

  autoTable(doc, {
    startY: ry,
    head: [[
      { content: 'MES', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'IMPORTE', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'ACUMULADO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'A COBRAR', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'OBJETIVO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'DIETAS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [
      ...resumenBody,
      [
        { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: [255,255,255] } },
        { content: fmt(total_importe), styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: [255,255,255] } },
        { content: fmt(total_importe), styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: [255,255,255] } },
        { content: fmt(total_cobrar), styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: [255,255,255] } },
        { content: fmt(total_objetivo), styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: [255,255,255] } },
        { content: fmt(total_dietas), styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: [255,255,255] } },
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    tableWidth: 120,
    margin: { left: 10 },
  });

  const resumenFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // % OBJETIVO + TOTAL KPI box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 100, 0);
  doc.text(`% OBJETIVO: ${pct_objetivo}%`, 10, resumenFinalY + 4);

  // TOTAL KPI box (right side)
  const boxX = 160, boxY = afterTable, boxW = 50, boxH = 20;
  doc.setFillColor(...DARK_BLUE);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('TOTAL KPI', boxX + boxW / 2, boxY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.text(fmt(total_cobrar), boxX + boxW / 2, boxY + 16, { align: 'center' });

  // Disclaimer text
  const disclaimerY = resumenFinalY + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Este cuadro detalla el rendimiento mensual del operario en las áreas clave de productividad, calidad, retornos, orden y horas improductivas.',
    10, disclaimerY, { maxWidth: 190 }
  );

  addPageFooter(doc);
}

// ─── Page 2: Control Documental ───────────────────────────────────────────────

function page2CtrlDoc(doc: jsPDF, params: ReportParams, logo: string | null) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '2. INFORME DE CONTROL DOCUMENTAL MENSUAL', 31);
  y += 2;

  const inc = params.incidencias;
  const totalPuntos = inc.reduce((s, r) => s + (r.puntos || 0), 0);

  // Summary table
  autoTable(doc, {
    startY: y,
    head: [[
      { content: `FECHA (Varios elementos) | AÑO ${params.año}`, colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ],[
      { content: 'OPERARIO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'TOTAL PUNTOS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'Cuenta INCIDENCIA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [
      [params.operario.toUpperCase(), String(totalPuntos), String(inc.length)],
      [{ content: 'Total general', styles: { fontStyle: 'bold' } }, { content: String(totalPuntos), styles: { fontStyle: 'bold' } }, { content: String(inc.length), styles: { fontStyle: 'bold' } }],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 100,
    margin: { left: 10 },
  });

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Detail table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_BLUE);
  doc.text('Detalle de incidencias documentales', 10, afterSummary);

  autoTable(doc, {
    startY: afterSummary + 3,
    head: [[
      { content: 'FECHA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'OT', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'INCIDENCIA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'PUNTOS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'OBSERVACIONES', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: inc.length > 0
      ? inc.map(r => [r.fecha, String(r.ot ?? ''), r.incidencia, String(r.puntos), r.observaciones ?? ''])
      : [['Sin registros para este período.', '', '', '', '']],
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    margin: { left: 10, right: 10 },
  });

  const afterDetail = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Este informe muestra el total de puntos de penalización por incidencias documentales registradas durante el mes.', 10, afterDetail, { maxWidth: 180 });

  const analysis = inc.length === 0
    ? `${params.operario} no ha registrado incidencias documentales este mes, lo que refleja un cumplimiento riguroso de los procedimientos.`
    : `${params.operario} acumula ${totalPuntos} puntos de penalización en ${inc.length} incidencias. Se recomienda revisar los procedimientos afectados.`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, afterDetail + 8, 180, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, afterDetail + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis, 35, afterDetail + 14, { maxWidth: 152 });

  addPageFooter(doc);
}

// ─── Page 3: Control Visitas ──────────────────────────────────────────────────

function page3Visitas(doc: jsPDF, params: ReportParams, logo: string | null) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '3. INFORME CONTROL DE VISITAS MENSUAL', 31);
  y += 2;

  const vis = params.visitas;
  const totalNok = vis.filter(v => v.ok_visita && v.ok_visita.toUpperCase() !== 'OK').length;

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'FECHA (Todas)', colSpan: 2, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ],[
      { content: 'Etiquetas de fila', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'Suma de NOK', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [
      [params.operario.toUpperCase(), String(totalNok)],
      [{ content: 'Total general', styles: { fontStyle: 'bold' } }, { content: String(totalNok), styles: { fontStyle: 'bold' } }],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 90,
    margin: { left: 10 },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Calendar grid
  const months12 = MESES;
  const calData = [[months12[0], months12[1], months12[2], months12[3]], [months12[4], months12[5], months12[6], months12[7]], [months12[8], months12[9], months12[10], months12[11]]];
  autoTable(doc, {
    startY: y,
    head: [[{ content: `AÑO ${params.año}`, colSpan: 4, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } }]],
    body: calData.map(row => row.map((m) => {
      const mIdx = calData.flat().indexOf(m);
      const isCurrent = mIdx + 1 === params.mes;
      return { content: m, styles: { fillColor: (isCurrent ? [30,80,180] : [245,248,255]) as [number,number,number], textColor: isCurrent ? [255,255,255] as [number,number,number] : [30,30,30] as [number,number,number], fontStyle: isCurrent ? 'bold' : 'normal' } };
    })),
    styles: { fontSize: 8, cellPadding: 3 },
    tableWidth: 90,
    margin: { left: 110 },
  });

  doc.setFillColor(255, 255, 180);
  doc.roundedRect(10, afterTable, 40, 6, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setTextColor(60,60,60);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTAS: 0=OK    SUMA= NOK', 12, afterTable + 4);

  const disclaimerY = afterTable + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Registra el control de visitas de mantenimiento realizadas. Un valor 0 indica visita correcta (OK); un valor positivo indica incidencias (NOK).', 10, disclaimerY, { maxWidth: 180 });

  const analysis = vis.length === 0
    ? 'No se han registrado visitas de mantenimiento en este período. Verificar si corresponde al planning asignado para este mes.'
    : `Se han registrado ${vis.length} visitas, con ${totalNok} NOK (incidencias). Ratio de cumplimiento: ${vis.length > 0 ? Math.round(((vis.length - totalNok) / vis.length) * 100) : 0}%.`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, disclaimerY + 8, 180, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, disclaimerY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis, 35, disclaimerY + 14, { maxWidth: 152 });

  addPageFooter(doc);
}

// ─── Page 4: Control No Calidad (Retornos) ────────────────────────────────────

function page4Retornos(doc: jsPDF, params: ReportParams, logo: string | null, rows: ReturnType<typeof calcRows>) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '4. INFORME CONTROL NO CALIDAD (RETORNOS ATRIBUIBLES)', 31);
  y += 2;

  const cq = params.controlCalidad.filter(r => r.tipo_cq === 'RETORNO ATRIBUIBLE');
  const totalOts = cq.length;
  const totalHoras = cq.reduce((s, r) => s + (r.horas || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'TIPO (Varios) | FECHA (Varios)', colSpan: 3, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ],[
      { content: 'Etiquetas de fila', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'Cuenta de OT', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'Suma de HORAS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: cq.length > 0
      ? [
          ...cq.map(r => [r.tipo_cq, String(r.ot ?? ''), String(r.horas ?? 0)]),
          [{ content: 'Total general', styles: { fontStyle: 'bold' } }, { content: String(totalOts), styles: { fontStyle: 'bold' } }, { content: String(totalHoras), styles: { fontStyle: 'bold' } }],
        ]
      : [
          ['Sin registros para este período.', '', ''],
          [{ content: 'Total general', styles: { fontStyle: 'bold' } }, { content: '0', styles: { fontStyle: 'bold' } }, { content: '0', styles: { fontStyle: 'bold' } }],
        ],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 100,
    margin: { left: 10 },
  });

  const afterLeft = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Right: conversion table
  const mesRow = rows[params.mes - 1];
  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'CUADRO DE CONVERSIÓN HORAS OPERARIOS', colSpan: 4, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ],[
      { content: 'OPERARIO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H INV', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H. R', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: '% HR/H INV', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [[
      params.operario.toUpperCase(),
      String(mesRow.md.h_inv),
      String(totalHoras),
      mesRow.md.h_inv > 0 ? pct((totalHoras / mesRow.md.h_inv) * 100) : '0%',
    ]],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 90,
    margin: { left: 110 },
  });

  const disclaimerY = afterLeft + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Registra los retornos de trabajos atribuibles al operario que generan re-intervenciones no planificadas.', 10, disclaimerY, { maxWidth: 180 });

  const analysis = cq.length === 0
    ? `No se han registrado retornos atribuibles este mes, lo que indica una alta calidad en la ejecución de los trabajos.`
    : `Se han registrado ${cq.length} retornos atribuibles con un total de ${totalHoras}h. Revisar los tipos de trabajo con mayor recurrencia.`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, disclaimerY + 8, 180, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, disclaimerY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis, 35, disclaimerY + 14, { maxWidth: 152 });

  addPageFooter(doc);
}

// ─── Page 5: Limpieza ─────────────────────────────────────────────────────────

function page5Limpieza(doc: jsPDF, params: ReportParams, logo: string | null) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '5. INFORME CONTROL LIMPIEZA MENSUAL', 31);
  y += 2;

  const limp = params.limpieza;

  function avg(vals: number[]) {
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const body = limp.map(r => {
    const vals = [r.vestuario_h, r.limpieza_vh, r.seguridad_t, r.herramientas];
    return [
      r.fecha,
      String(r.vestuario_h), String(r.limpieza_vh),
      String(r.seguridad_t), String(r.herramientas),
      avg(vals).toFixed(2),
    ];
  });

  const promedioGeneral = limp.length > 0
    ? avg(limp.map(r => avg([r.vestuario_h, r.limpieza_vh, r.seguridad_t, r.herramientas]))).toFixed(2)
    : '0.00';

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'FECHA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'VESTUARIO/HIGIENE', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'LIMPIEZA VH', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'SEGURIDAD TRABAJOS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'HERRAMIENTAS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'PROMEDIO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: limp.length > 0
      ? [
          ...body,
          [
            { content: 'PROMEDIO GENERAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: promedioGeneral, styles: { fontStyle: 'bold' } },
          ],
        ]
      : [
          [{ content: 'Sin registros para este período.', colSpan: 6, styles: { halign: 'center' } }],
          [
            { content: 'PROMEDIO GENERAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: '0.00', styles: { fontStyle: 'bold' } },
          ],
        ],
    styles: { fontSize: 9, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    margin: { left: 10, right: 10 },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Control mensual del estado de limpieza e higiene del operario, vehículo, equipos y herramientas. Escala 1–10. Promedio > 8 indica cumplimiento óptimo.', 10, afterTable, { maxWidth: 180 });

  const analysis = limp.length === 0
    ? 'No se han registrado controles de limpieza en este período. Es fundamental realizar estas evaluaciones mensualmente.'
    : `Promedio general: ${promedioGeneral}/10. ${parseFloat(promedioGeneral) >= 8 ? 'Cumplimiento óptimo.' : 'Por debajo del umbral recomendado (8). Revisar áreas con menor puntuación.'}`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, afterTable + 8, 180, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, afterTable + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis, 35, afterTable + 14, { maxWidth: 152 });

  addPageFooter(doc);
}

// ─── Page 6: Horas Improductivas ─────────────────────────────────────────────

function page6HorasImprod(doc: jsPDF, params: ReportParams, logo: string | null) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '6. INFORME HORAS IMPRODUCTIVAS MENSUAL', 31);
  y += 2;

  const hi = params.horasImprod;
  const totalH = hi.reduce((s, r) => s + r.h_recg_mat + r.h_reunion + r.h_mant_furgos + r.h_mant_instalaciones + r.h_formacion, 0);

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'FECHA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H. RECOGIDA MAT.', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H. REUNIÓN', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H. MANT. FURGOS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H. MANT. INST.', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'H. FORMACIÓN', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'CONSUMIBLES', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'TOTAL', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: hi.length > 0
      ? [
          ...hi.map(r => {
            const t = r.h_recg_mat + r.h_reunion + r.h_mant_furgos + r.h_mant_instalaciones + r.h_formacion;
            return [r.fecha, String(r.h_recg_mat), String(r.h_reunion), String(r.h_mant_furgos), String(r.h_mant_instalaciones), String(r.h_formacion), String(r.consumibles_e), `${t}h`];
          }),
          [
            { content: 'TOTAL', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: `${totalH}h`, styles: { fontStyle: 'bold' } },
          ],
        ]
      : [
          [{ content: 'Sin registros para este período.', colSpan: 8, styles: { halign: 'center' } }],
          [
            { content: 'TOTAL', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: '0h', styles: { fontStyle: 'bold' } },
          ],
        ],
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    margin: { left: 10, right: 10 },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Registro del tiempo dedicado a actividades necesarias pero no directamente productivas. Obj: Recogida mat. 1.5h | Reuniones 1h | Mantenimiento furgonetas 2h/mes.', 10, afterTable, { maxWidth: 180 });

  const analysis = hi.length === 0
    ? 'No se han registrado horas improductivas este mes. Verificar que el registro se esté realizando correctamente.'
    : `Total horas improductivas: ${totalH}h. Distribución registrada en ${hi.length} entrada(s).`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, afterTable + 8, 180, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, afterTable + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis, 35, afterTable + 14, { maxWidth: 152 });

  addPageFooter(doc);
}

// ─── Page 7: Retorno por Tipo + Incidencias Admin ─────────────────────────────

function page7RetornoTipo(doc: jsPDF, params: ReportParams, logo: string | null) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '7. ANÁLISIS DE RETORNO POR TIPO MENSUAL', 31);
  y += 2;

  const retornos = params.controlCalidad.filter(r => r.tipo_cq === 'RETORNO ATRIBUIBLE');
  const tipoMap: Record<string, number> = {};
  retornos.forEach(r => { tipoMap[r.tipo_cq] = (tipoMap[r.tipo_cq] || 0) + 1; });
  const total = retornos.length;

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'TIPO DE RETORNO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'CANTIDAD', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: '%', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: Object.keys(tipoMap).length > 0
      ? Object.entries(tipoMap).map(([tipo, cnt]) => [tipo, String(cnt), pct(total > 0 ? (cnt / total) * 100 : 0)])
      : [['Sin retornos este mes.', '', '']],
    styles: { fontSize: 9, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    margin: { left: 10, right: 10 },
  });

  const afterRetorno = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Clasificación de retornos por categoría. Permite identificar los tipos de trabajo con mayor tasa de re-intervención.', 10, afterRetorno, { maxWidth: 180 });

  const analysis1 = retornos.length === 0
    ? 'No se han registrado retornos este mes, lo que confirma una alta efectividad en la ejecución.'
    : `Se han registrado ${retornos.length} retornos. Mantener seguimiento en los tipos con mayor recurrencia.`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, afterRetorno + 6, 180, 10, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, afterRetorno + 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis1, 35, afterRetorno + 11, { maxWidth: 152 });

  // Section 8: Incidencias Administrativas
  const s8y = afterRetorno + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK_BLUE);
  doc.text('8. DETALLE INCIDENCIAS ADMINISTRATIVAS', 10, s8y);

  const adminInc = params.incidencias.filter(r =>
    r.incidencia.includes('LLAMADA') || r.incidencia.includes('FICHA') || r.incidencia.includes('REUNIÓN')
  );

  autoTable(doc, {
    startY: s8y + 4,
    head: [[
      { content: 'FECHA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'TIPO', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'DESCRIPCIÓN', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'PUNTOS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: adminInc.length > 0
      ? adminInc.map(r => [r.fecha, r.incidencia, r.observaciones ?? '', String(r.puntos)])
      : [['Sin incidencias administrativas.', '', '', '']],
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    margin: { left: 10, right: 10 },
  });

  const afterAdmin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Registro de incidencias relacionadas con gestión administrativa: llamadas, reuniones y documentación.', 10, afterAdmin, { maxWidth: 180 });

  const analysis2 = adminInc.length === 0
    ? 'Sin incidencias administrativas registradas. El operario muestra un correcto seguimiento de los procedimientos.'
    : `${adminInc.length} incidencias administrativas registradas. Revisar los procedimientos de llamadas y fichaje.`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, afterAdmin + 6, 180, 10, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, afterAdmin + 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis2, 35, afterAdmin + 11, { maxWidth: 152 });

  addPageFooter(doc);
}

// ─── Page 8: Incidencias Calidad + Informes Trimestrales ─────────────────────

function page8CalidadTrimestral(doc: jsPDF, params: ReportParams, logo: string | null) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  let y = sectionTitle(doc, '9. DETALLE INCIDENCIAS CALIDAD OPERARIO', 31);
  y += 2;

  const calInc = params.controlCalidad;

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'FECHA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'INCIDENCIA', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'PUNTOS', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
      { content: 'OBSERVACIONES', styles: { fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: calInc.length > 0
      ? calInc.map(r => [r.fecha, r.tipo_cq, String(r.total_cq), r.descripcion])
      : [['Sin incidencias de calidad.', '', '', '']],
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BLUE },
    margin: { left: 10, right: 10 },
  });

  const afterCalidad = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Detalle de incidencias de calidad operativa. Cada punto de penalización afecta directamente al KPI de calidad.', 10, afterCalidad, { maxWidth: 180 });

  const analysis = calInc.length === 0
    ? 'Sin incidencias de calidad registradas. Excelente desempeño operativo.'
    : `${calInc.length} incidencias de calidad registradas. Revisar procedimientos para reducir recurrencia.`;

  doc.setFillColor(255, 249, 230);
  doc.roundedRect(10, afterCalidad + 6, 180, 10, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 100, 0);
  doc.text('Análisis:', 13, afterCalidad + 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(analysis, 35, afterCalidad + 11, { maxWidth: 152 });

  // Section 10: Informes Trimestrales
  const s10y = afterCalidad + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK_BLUE);
  doc.text('10. INFORMES TRIMESTRALES', 10, s10y);

  const trimestre = Math.ceil(params.mes / 3);
  const mesInicio = (trimestre - 1) * 3 + 1;
  const mesFin = Math.min(trimestre * 3, params.mes);

  // Trim totals from Supabase data (incidencias in the quarter)
  const incTrim = params.incidencias;
  const totalIncTrim = incTrim.length;
  const puntosIncTrim = incTrim.reduce((s, r) => s + (r.puntos || 0), 0);
  const puntosDocTrim = puntosIncTrim;
  const costoRetTrim = params.controlCalidad
    .filter(r => r.tipo_cq === 'RETORNO ATRIBUIBLE')
    .reduce((s, r) => s + (r.total_cq || 0), 0);

  autoTable(doc, {
    startY: s10y + 4,
    head: [[
      { content: '10.1 ACUMULADO INCIDENCIAS CQ', colSpan: 2, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [
      ['Total incidencias trimestre', String(totalIncTrim)],
      ['Puntos acumulados', String(puntosIncTrim)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 85,
    margin: { left: 10 },
  });

  autoTable(doc, {
    startY: s10y + 4,
    head: [[
      { content: '10.2 ACUMULADO PUNTOS CONTROL DOCUMENTAL', colSpan: 2, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [
      ['Total puntos documentales', String(puntosDocTrim)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 85,
    margin: { left: 110 },
  });

  const afterTrim1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: afterTrim1,
    head: [[
      { content: '10.3 ACUMULADO COSTE RETORNOS ATRIBUIBLES', colSpan: 2, styles: { halign: 'center', fillColor: MID_BLUE, textColor: [255,255,255], fontStyle: 'bold' } },
    ]],
    body: [
      ['Coste total trimestre', fmt(costoRetTrim)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    tableWidth: 85,
    margin: { left: 110 },
  });

  const afterAll = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Visión consolidada del T${trimestre} (meses ${MESES[mesInicio - 1]}–${MESES[mesFin - 1]}).`, 10, afterAll, { maxWidth: 180 });

  addPageFooter(doc);
}

// ─── Page 9: Análisis Global ──────────────────────────────────────────────────

function page9Analisis(doc: jsPDF, params: ReportParams, logo: string | null, rows: ReturnType<typeof calcRows>) {
  doc.addPage();
  addPageHeader(doc, params.operario, params.mes, params.año, logo);

  const mesRow = rows[params.mes - 1];
  const totalKpi = mesRow.cobrar;
  const totalInc = params.incidencias.length;
  const totalRet = params.controlCalidad.filter(r => r.tipo_cq === 'RETORNO ATRIBUIBLE').length;
  const avgLimp = params.limpieza.length > 0
    ? (params.limpieza.reduce((s, r) => s + (r.vestuario_h + r.limpieza_vh + r.seguridad_t + r.herramientas) / 4, 0) / params.limpieza.length).toFixed(2)
    : 'N/A';

  let y = 34;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_BLUE);
  doc.text(`ANÁLISIS GLOBAL DE RENDIMIENTO — ${MESES[params.mes - 1]} ${params.año}`, 10, y);
  y += 3;
  doc.setDrawColor(...MID_BLUE);
  doc.line(10, y, 200, y);
  y += 6;

  // Operario
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Operario: `, 10, y);
  doc.setFont('helvetica', 'bold');
  doc.text(params.operario.toUpperCase(), 28, y);
  y += 8;

  // Summary blocks
  const blocks = [
    { label: 'Total KPI Cobrar', value: fmt(totalKpi), color: [0, 100, 0] as [number,number,number] },
    { label: 'Incidencias Doc.', value: String(totalInc), color: totalInc > 0 ? [160, 0, 0] as [number,number,number] : [0, 100, 0] as [number,number,number] },
    { label: 'Retornos', value: String(totalRet), color: totalRet > 0 ? [160, 0, 0] as [number,number,number] : [0, 100, 0] as [number,number,number] },
    { label: 'Avg Limpieza', value: avgLimp === 'N/A' ? 'N/A' : `${avgLimp}/10`, color: [30, 60, 120] as [number,number,number] },
  ];

  blocks.forEach((b, i) => {
    const bx = 10 + i * 48;
    doc.setFillColor(240, 245, 255);
    doc.roundedRect(bx, y, 44, 16, 2, 2, 'F');
    doc.setDrawColor(...MID_BLUE);
    doc.roundedRect(bx, y, 44, 16, 2, 2, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(b.label, bx + 22, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...b.color);
    doc.text(b.value, bx + 22, y + 13, { align: 'center' });
  });

  y += 22;

  const sections = [
    {
      title: 'RESUMEN EJECUTIVO',
      text: `En ${MESES[params.mes - 1]} de ${params.año}, el rendimiento global del operario ${params.operario} ha resultado en un incentivo de ${fmt(totalKpi)}, ${totalKpi >= 250 ? 'alcanzando' : 'quedando por debajo de'} el objetivo de 250€.`,
    },
    {
      title: 'PUNTOS FUERTES',
      text: [
        totalInc === 0 ? 'Sin incidencias documentales este mes — cumplimiento óptimo de gestión documental.' : null,
        totalRet === 0 ? 'Sin retornos atribuibles — alta calidad en la ejecución de trabajos.' : null,
        mesRow.md.herr_pct >= 100 ? 'Herramientas en estado correcto.' : null,
        mesRow.md.vehic_pct >= 100 ? 'Vehículo en estado correcto.' : null,
        mesRow.md.aseo_pct >= 100 ? 'Aseo personal correcto.' : null,
      ].filter(Boolean).join(' ') || 'Revisar todas las áreas para identificar puntos de mejora.',
    },
    {
      title: 'ÁREAS DE MEJORA',
      text: [
        totalInc > 0 ? `${totalInc} incidencias documentales registradas (${params.incidencias.reduce((s, r) => s + r.puntos, 0)} puntos).` : null,
        totalRet > 0 ? `${totalRet} retornos atribuibles registrados.` : null,
        mesRow.md.herr_pct < 100 ? 'Estado de herramientas no óptimo.' : null,
        mesRow.md.vehic_pct < 100 ? 'Estado de vehículo no óptimo.' : null,
      ].filter(Boolean).join(' ') || 'No se identifican áreas de mejora significativas. Mantener el nivel actual.',
    },
    {
      title: 'RECOMENDACIONES',
      text: totalKpi >= 250
        ? `${params.operario} ha alcanzado o superado el objetivo mensual. Mantener las buenas prácticas actuales.`
        : `Revisar los indicadores con menor puntuación para identificar oportunidades de mejora y alcanzar el objetivo de 250€.`,
    },
  ];

  sections.forEach(s => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK_BLUE);
    doc.text(s.title, 10, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(s.text, 180) as string[];
    doc.text(lines, 10, y);
    y += lines.length * 4 + 4;
  });

  addPageFooter(doc);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

async function buildDoc(params: ReportParams): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const logo = await urlToBase64('https://i.imgur.com/FIay1SB.png');
  const rows = calcRows(params.kpiData, params.kpiRef);

  page1Kpi(doc, params, logo, rows);
  page2CtrlDoc(doc, params, logo);
  page3Visitas(doc, params, logo);
  page4Retornos(doc, params, logo, rows);
  page5Limpieza(doc, params, logo);
  page6HorasImprod(doc, params, logo);
  page7RetornoTipo(doc, params, logo);
  page8CalidadTrimestral(doc, params, logo);
  page9Analisis(doc, params, logo, rows);

  return doc;
}

export async function generateKpiPdf(params: ReportParams): Promise<void> {
  const doc = await buildDoc(params);
  const mesName = MESES[params.mes - 1].toLowerCase();
  doc.save(`informe_${params.operario.toLowerCase().replace(/\s+/g, '_')}_${mesName}_${params.año}.pdf`);
}

export async function previewKpiPdf(params: ReportParams): Promise<string> {
  const doc = await buildDoc(params);
  return doc.output('datauristring') as string;
}
