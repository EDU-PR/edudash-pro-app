/**
 * Generates a PDF report from principal analytics data using expo-print + expo-sharing.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { AnalyticsData } from '@/hooks/principal-analytics';
import { formatCurrency, getStatusColor } from '@/hooks/principal-analytics';

function row(label: string, value: string | number, color?: string): string {
  const valStyle = color ? `color:${color};font-weight:700` : 'font-weight:600';
  return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${label}</td>
    <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;${valStyle}">${value}</td></tr>`;
}

function section(title: string, rows: string): string {
  return `<h2 style="margin:18px 0 6px;color:#1a1a2e;font-size:16px">${title}</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">${rows}</table>`;
}

export async function exportAnalyticsPdf(
  data: AnalyticsData,
  schoolName?: string,
): Promise<void> {
  const { enrollment: e, attendance: a, finance: f, staff: s } = data;
  const date = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a2e}
    h1{font-size:20px;margin-bottom:4px} .sub{color:#666;font-size:12px;margin-bottom:16px}
    table{font-size:13px}</style></head><body>
    <h1>${schoolName || 'School'} — Analytics Report</h1>
    <p class="sub">Generated ${date}</p>

    ${section('Enrollment', [
      row('Total Students', e.totalStudents),
      row('New Enrolments (30d)', e.newEnrollments),
      row('Withdrawals', e.withdrawals),
      row('Retention Rate', `${e.retentionRate.toFixed(1)}%`, getStatusColor(e.retentionRate, 80, 90)),
      ...e.ageGroupDistribution.map((g) => row(`  ${g.ageGroup}`, g.count)),
    ].join(''))}

    ${section('Attendance', [
      row('Average Attendance', `${a.averageAttendance.toFixed(1)}%`, getStatusColor(a.averageAttendance, 80, 90)),
      row("Today's Attendance", `${a.todayAttendance.toFixed(1)}%`),
      row('Low-attendance Days (7d)', a.lowAttendanceAlerts),
      ...a.weeklyTrend.map((d) => row(`  ${d.day}`, `${d.rate}%`)),
    ].join(''))}

    ${section('Finance', [
      row('Monthly Revenue', formatCurrency(f.monthlyRevenue)),
      row('Outstanding Fees', formatCurrency(f.outstandingFees)),
      row('Payment Rate', `${f.paymentRate.toFixed(1)}%`, getStatusColor(f.paymentRate, 70, 85)),
    ].join(''))}

    ${section('Staff', [
      row('Total Staff', s.totalStaff),
      row('Active Teachers', s.activeTeachers),
      row('Student:Teacher Ratio', `${s.studentTeacherRatio.toFixed(1)}:1`),
    ].join(''))}

    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
