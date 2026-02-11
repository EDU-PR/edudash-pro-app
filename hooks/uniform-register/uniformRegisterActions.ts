import { Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { UniformEntry, UniformRegisterSummary } from './types';

const TAG = 'UniformRegisterActions';

/** Escape HTML special chars to prevent XSS when interpolating user data into HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function verifyUniformPayment(studentId: string, preschoolId: string): Promise<void> {
  const supabase = assertSupabase();
  const { error } = await supabase
    .from('student_fees')
    .update({ payment_verified: true, paid_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('preschool_id', preschoolId)
    .or('fee_type.ilike.%uniform%,description.ilike.%uniform%,label.ilike.%uniform%');

  if (error) {
    logger.error(TAG, 'Failed to verify payment', error);
    throw new Error('Failed to verify uniform payment');
  }
}

export function generatePrintableHtml(
  entries: UniformEntry[],
  summary: UniformRegisterSummary,
  schoolName: string,
): string {
  const sorted = [...entries].sort((a, b) => a.student_name.localeCompare(b.student_name));
  const rows = sorted
    .map(
      (e, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:8px;border:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(e.student_name)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(e.parent_name || '—')}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(e.parent_phone || '—')}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${e.filled_out ? '✅ Yes' : '❌ No'}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">R${e.total_amount.toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">R${e.amount_paid.toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;color:${
          e.payment_status === 'paid' ? '#16a34a' : e.payment_status === 'partial' ? '#d97706' : '#dc2626'
        }">${e.payment_status.toUpperCase()}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Uniform Register</title>
<style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
th{background:#1e40af;color:#fff;padding:10px 8px;border:1px solid #1e40af;text-align:left;font-size:13px}
.summary{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
.stat{background:#f0f9ff;border-radius:8px;padding:12px 16px;min-width:140px}
.stat b{display:block;font-size:20px;color:#1e40af}</style></head><body>
<h1 style="color:#1e40af">📋 Uniform Register — ${escapeHtml(schoolName)}</h1>
<p style="color:#6b7280">Generated: ${new Date().toLocaleDateString('en-ZA')}</p>
<div class="summary">
  <div class="stat"><b>${summary.total_students}</b>Total Students</div>
  <div class="stat"><b>${summary.forms_filled}</b>Forms Filled</div>
  <div class="stat"><b>${summary.total_paid}</b>Fully Paid</div>
  <div class="stat"><b>${summary.total_partial}</b>Partial</div>
  <div class="stat"><b>${summary.total_unpaid}</b>Unpaid</div>
  <div class="stat"><b>R${summary.total_revenue.toFixed(2)}</b>Revenue</div>
  <div class="stat"><b>R${summary.total_outstanding.toFixed(2)}</b>Outstanding</div>
</div>
<table><thead><tr><th>#</th><th>Student</th><th>Parent</th><th>Phone</th>
<th>Form</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:24px;color:#9ca3af;font-size:12px">EduDash Pro — Uniform Register Report</p>
</body></html>`;
}

export async function printRegister(
  entries: UniformEntry[],
  summary: UniformRegisterSummary,
  schoolName: string,
): Promise<void> {
  const html = generatePrintableHtml(entries, summary, schoolName);
  try {
    await Print.printAsync({ html });
  } catch (err) {
    logger.error(TAG, 'Print failed', err);
    throw new Error('Failed to print uniform register');
  }
}

export async function shareRegisterPdf(
  entries: UniformEntry[],
  summary: UniformRegisterSummary,
  schoolName: string,
): Promise<void> {
  const html = generatePrintableHtml(entries, summary, schoolName);
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Uniform Register — ${schoolName}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (err) {
    logger.error(TAG, 'Share PDF failed', err);
    throw new Error('Failed to share uniform register');
  }
}

export async function sendListViaShare(
  entries: UniformEntry[],
  summary: UniformRegisterSummary,
  schoolName: string,
): Promise<void> {
  const sorted = [...entries].sort((a, b) => a.student_name.localeCompare(b.student_name));
  const lines = [
    `📋 *Uniform Register — ${schoolName}*`,
    `📅 ${new Date().toLocaleDateString('en-ZA')}`,
    '',
    `👥 Total: ${summary.total_students} | ✅ Paid: ${summary.total_paid} | ⏳ Partial: ${summary.total_partial} | ❌ Unpaid: ${summary.total_unpaid}`,
    `📝 Forms: ${summary.forms_filled}/${summary.total_students}`,
    `💰 Collected: R${summary.total_revenue.toFixed(2)} | Outstanding: R${summary.total_outstanding.toFixed(2)}`,
    '',
    '— Student List —',
  ];
  sorted.forEach((e, i) => {
    const icon = e.payment_status === 'paid' ? '✅' : e.payment_status === 'partial' ? '⏳' : '❌';
    lines.push(`${i + 1}. ${e.student_name} — ${icon} R${e.amount_paid.toFixed(2)}/R${e.total_amount.toFixed(2)}`);
  });

  try {
    await Share.share({ message: lines.join('\n'), title: `Uniform Register — ${schoolName}` });
  } catch (err) {
    logger.error(TAG, 'Share text failed', err);
    throw new Error('Failed to share uniform list');
  }
}
