import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { getConfig, getPackages, getSpecialties, specialtiesToMap } from '@/lib/data';
import { buildPriceMatrix } from '@/lib/pricing/calc';
import { formatLives, formatPct } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const packageId = req.nextUrl.searchParams.get('packageId');
  const [packages, specialties, config] = await Promise.all([
    getPackages(),
    getSpecialties(),
    getConfig(),
  ]);
  const specMap = specialtiesToMap(specialties);
  const pkg = packages.find((p) => p.id === packageId) ?? packages[0];

  if (!pkg) {
    return new Response('Nenhum pacote disponível para exportar.', { status: 404 });
  }

  const matrix = buildPriceMatrix(pkg, specMap, config);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Starbem Precificação';
  wb.created = new Date();

  // --- Matrix sheet ---
  const ws = wb.addWorksheet('Matriz de Preço');
  ws.addRow([`Matriz de preço por vida/mês — ${pkg.name}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([`Recorrência: ${pkg.recurrence} consultas/mês`]);
  ws.addRow([]);

  const headerRow = ['Utilização \\ Volume', ...matrix.volumeBands.map((b) => b.label ?? formatLives(b.maxLives))];
  const hr = ws.addRow(headerRow);
  hr.font = { bold: true };
  hr.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  matrix.cells.forEach((row, ri) => {
    const values = [formatPct(matrix.utilizationBands[ri]), ...row.map((c) => c.price)];
    const r = ws.addRow(values);
    r.getCell(1).font = { bold: true };
    for (let ci = 2; ci <= values.length; ci++) {
      r.getCell(ci).numFmt = 'R$ #,##0.00';
      r.getCell(ci).alignment = { horizontal: 'right' };
    }
  });

  ws.addRow([]);
  ws.addRow(['Consulta excedente (base venda)', matrix.excedentePrice]).getCell(2).numFmt =
    'R$ #,##0.00';
  ws.getColumn(1).width = 26;
  matrix.volumeBands.forEach((_, i) => {
    ws.getColumn(i + 2).width = 16;
  });

  // --- Assumptions / margin sheet ---
  const ws2 = wb.addWorksheet('Premissas e Margem');
  ws2.columns = [
    { header: 'Item', key: 'k', width: 40 },
    { header: 'Valor', key: 'v', width: 20 },
  ];
  ws2.getRow(1).font = { bold: true };
  const rows: [string, string | number][] = [
    ['Consulta média (venda)', matrix.avgSellConsult],
    ['Consulta média (custo real)', matrix.avgRealConsult],
    ['Fator no-show', matrix.noShowFactor],
    ['Divisor (1 − margem − imposto)', matrix.divisor],
    ['Margem-alvo', formatPct(config.targetMargin)],
    ['Imposto', formatPct(config.taxRate)],
    ['No-show', formatPct(config.noShowRate)],
    ['Repasse no-show', formatPct(config.noShowRepassePct)],
  ];
  rows.forEach(([k, v]) => {
    const r = ws2.addRow({ k, v });
    if (typeof v === 'number' && k.startsWith('Consulta')) {
      r.getCell(2).numFmt = 'R$ #,##0.00';
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `matriz-preco-${pkg.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
