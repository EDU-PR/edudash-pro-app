import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { DisplayRow } from './types';
import { escapeHtml } from './types';
import { hasAssignedBackNumber, normalizeBackNumber } from './numbering';

export async function exportUniformPdf(params: {
  filtered: DisplayRow[];
  sizeSummary: Record<string, number>;
  missingByClass: { name: string; count: number }[];
  showAlert: (opts: any) => void;
}): Promise<void> {
  const { filtered, sizeSummary, missingByClass, showAlert } = params;

  if (!filtered.length) {
    showAlert({ title: 'Nothing to export', message: 'No uniform records to export.', buttons: [{ text: 'OK' }] });
    return;
  }

  const generatedAt = new Date().toLocaleString('en-ZA');
  const sizeChips = Object.entries(sizeSummary)
    .map(([size, count]) => '<span class="chip"><span>' + escapeHtml(size) + '</span><strong>' + count + '</strong></span>')
    .join('');
  const classChips = missingByClass
    .map(({ name, count }) => '<span class="chip"><span>' + escapeHtml(name) + '</span><strong>' + count + '</strong></span>')
    .join('');

  const sortedRows = [...filtered].sort((a, b) => a.childName.localeCompare(b.childName));

  const rows = sortedRows.map((row) => {
    const statusLabel = row.paymentStatus === 'paid' ? 'PAID' : 'UNPAID';
    const statusClass = row.paymentStatus === 'paid' ? 'payment-paid' : 'payment-unpaid';
    return '<tr>' +
      '<td>' + escapeHtml(row.childName || '-') + '</td>' +
      '<td>' + escapeHtml(row.ageYears ?? '-') + '</td>' +
      '<td>' + escapeHtml(row.tshirtSize || '-') + '</td>' +
      '<td>' + escapeHtml(row.tshirtQuantity ?? '-') + '</td>' +
      '<td>' + escapeHtml(row.shortsQuantity ?? '-') + '</td>' +
      '<td>' + escapeHtml(hasAssignedBackNumber(row.tshirtNumber) ? normalizeBackNumber(row.tshirtNumber) : '-') + '</td>' +
      '<td>' + (row.sampleSupplied ? 'YES' : 'NO') + '</td>' +
      '<td><span class="payment-chip ' + statusClass + '">' + statusLabel + '</span></td>' +
      '</tr>';
  }).join('');

  const css = '@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;color:#111827}' +
    'h1{font-size:20px;margin:0 0 4px}.subtitle{font-size:12px;color:#6b7280;margin-bottom:16px}' +
    '.section{margin-bottom:16px}.chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.chip{display:inline-flex;gap:6px;align-items:center;padding:4px 8px;border-radius:999px;background:#f3f4f6;font-size:11px}' +
    '.chip strong{font-size:11px;color:#111827}table{width:100%;border-collapse:collapse;font-size:11px}' +
    'th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f9fafb;font-weight:700}' +
    'thead{display:table-header-group}' +
    '.payment-chip{display:inline-block;padding:3px 8px;border-radius:999px;font-weight:700;font-size:10px;letter-spacing:0.2px}' +
    '.payment-paid{color:#166534;background:#dcfce7;border:1px solid #86efac}' +
    '.payment-unpaid{color:#991b1b;background:#fee2e2;border:1px solid #fca5a5}' +
    '.footer{margin-top:16px;font-size:10px;color:#6b7280;text-align:right}';

  const headers = '<th>CHILD</th><th>AGE</th><th>SIZE</th><th># T-SHIRT(S)</th>' +
    '<th># SHORT(S)</th><th>BACK #</th><th>SAMPLE-SUPPLIED</th><th>PAYMENT</th>';

  const html = '<html><head><meta charset="utf-8"/><style>' + css + '</style></head><body>' +
    '<h1>Uniform Sizes</h1>' +
    '<div class="subtitle">Generated ' + escapeHtml(generatedAt) + '</div>' +
    '<div class="section"><div style="font-weight:700;font-size:12px;margin-bottom:6px">Size Summary</div>' +
    '<div class="chips">' + (sizeChips || '<span class="chip">No submissions yet</span>') + '</div></div>' +
    '<div class="section"><div style="font-weight:700;font-size:12px;margin-bottom:6px">Missing by Class</div>' +
    '<div class="chips">' + (classChips || '<span class="chip">No missing submissions</span>') + '</div></div>' +
    '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="footer">EduDash Pro &bull; Uniform Sizes</div></body></html>';

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export uniform sizes (PDF)',
      UTI: 'com.adobe.pdf',
    });
  } else {
    showAlert({ title: 'PDF Generated', message: 'The uniform sizes PDF has been generated.', buttons: [{ text: 'OK' }] });
  }
}
