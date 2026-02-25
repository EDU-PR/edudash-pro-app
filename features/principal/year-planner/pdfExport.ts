// Year Plan PDF Export — generates HTML → PDF via expo-print + expo-sharing
// Produces a professional school-branded PDF of the generated year plan

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type {
  GeneratedYearPlan,
  YearPlanMonthlyBucket,
} from '@/components/principal/ai-planner/types';
import { getSAPublicHolidays } from './saHolidays';

const BUCKET_LABELS: Record<YearPlanMonthlyBucket, string> = {
  holidays_closures: 'Holidays & Closures',
  meetings_admin: 'Meetings & Admin',
  excursions_extras: 'Excursions & Extras',
  donations_fundraisers: 'Donations & Fundraisers',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSAHolidayDateSet(year: number): Set<string> {
  return new Set(getSAPublicHolidays(year).map((h) => h.date));
}

function buildTermOverviewHtml(plan: GeneratedYearPlan): string {
  const rows = plan.terms
    .map((term) => {
      const weekCount = term.weeklyThemes.length;
      const keyTheme = term.weeklyThemes[0]?.theme || '—';
      return `<tr>
        <td>${escapeHtml(term.name)}</td>
        <td>${escapeHtml(term.startDate)}</td>
        <td>${escapeHtml(term.endDate)}</td>
        <td>${weekCount}</td>
        <td>${escapeHtml(keyTheme)}</td>
      </tr>`;
    })
    .join('');

  return `
    <h2>Term Overview</h2>
    <table>
      <thead>
        <tr>
          <th>Term</th><th>Start</th><th>End</th><th>Weeks</th><th>Key Theme</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildMonthlyCalendarHtml(plan: GeneratedYearPlan): string {
  const saHolidayDates = buildSAHolidayDateSet(plan.academicYear);
  const bucketOrder: YearPlanMonthlyBucket[] = [
    'holidays_closures',
    'meetings_admin',
    'excursions_extras',
    'donations_fundraisers',
  ];

  const rows = Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    const entries = (plan.monthlyEntries || []).filter(
      (e) => e.monthIndex === month,
    );

    const cells = bucketOrder
      .map((bucket) => {
        const bucketEntries = entries.filter((e) => e.bucket === bucket);
        if (bucketEntries.length === 0) return '<td>—</td>';

        const items = bucketEntries
          .map((e) => {
            const isHoliday = saHolidayDates.has(e.startDate || '');
            const style = isHoliday ? ' class="sa-holiday"' : '';
            return `<span${style}>${escapeHtml(e.title)}</span>`;
          })
          .join('<br/>');
        return `<td>${items}</td>`;
      })
      .join('');

    return `<tr><td class="month-label">${MONTH_NAMES[idx]}</td>${cells}</tr>`;
  }).join('');

  return `
    <h2>Monthly Calendar</h2>
    <table class="monthly">
      <thead>
        <tr>
          <th>Month</th>
          ${bucketOrder.map((b) => `<th>${BUCKET_LABELS[b]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildWeeklyThemesHtml(plan: GeneratedYearPlan): string {
  const sections = plan.terms
    .map((term) => {
      const themeRows = term.weeklyThemes
        .map(
          (w) =>
            `<tr>
              <td>W${w.week}</td>
              <td>${escapeHtml(w.theme)}</td>
              <td>${escapeHtml(w.activities.slice(0, 3).join(', ') || '—')}</td>
            </tr>`,
        )
        .join('');

      return `
        <h3>${escapeHtml(term.name)} — Weekly Themes</h3>
        <table>
          <thead><tr><th>#</th><th>Theme</th><th>Activities</th></tr></thead>
          <tbody>${themeRows}</tbody>
        </table>`;
    })
    .join('');

  return `<h2>Weekly Themes per Term</h2>${sections}`;
}

function buildGoalsAndBudgetHtml(plan: GeneratedYearPlan): string {
  const goals = plan.annualGoals
    .map((g) => `<li>${escapeHtml(g)}</li>`)
    .join('');

  return `
    <h2>Annual Goals</h2>
    <ul>${goals || '<li>No goals specified</li>'}</ul>
    <h2>Budget Estimate</h2>
    <p><strong>${escapeHtml(plan.budgetEstimate)}</strong></p>`;
}

function buildFullHtml(plan: GeneratedYearPlan, schoolName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 20mm 15mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.4; }
    .header { background: #7C3AED; color: #fff; padding: 18px 24px; border-radius: 8px; margin-bottom: 18px; }
    .header h1 { margin: 0 0 4px 0; font-size: 20px; }
    .header p { margin: 0; font-size: 12px; opacity: 0.9; }
    h2 { color: #7C3AED; font-size: 15px; border-bottom: 2px solid #7C3AED; padding-bottom: 4px; margin-top: 22px; }
    h3 { color: #4C1D95; font-size: 13px; margin-top: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
    th { background: #F5F3FF; color: #4C1D95; text-align: left; padding: 6px 8px; border: 1px solid #ddd; }
    td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
    .month-label { font-weight: 700; white-space: nowrap; }
    .sa-holiday { color: #047857; font-weight: 600; }
    .monthly td { font-size: 9px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; }
    .footer { text-align: center; font-size: 9px; color: #888; margin-top: 28px; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(schoolName)}</h1>
    <p>Academic Year Plan ${plan.academicYear} — Generated by EduDash Pro</p>
  </div>

  <p><em>${escapeHtml(plan.schoolVision)}</em></p>

  ${buildTermOverviewHtml(plan)}
  ${buildMonthlyCalendarHtml(plan)}
  ${buildWeeklyThemesHtml(plan)}
  ${buildGoalsAndBudgetHtml(plan)}

  <div class="footer">
    &copy; ${plan.academicYear} ${escapeHtml(schoolName)} &bull; Powered by EduDash Pro
  </div>
</body>
</html>`;
}

/**
 * Generate a PDF file from the year plan.
 * Returns the local file URI of the generated PDF.
 */
export async function exportYearPlanAsPDF(
  plan: GeneratedYearPlan,
  schoolName: string,
): Promise<string> {
  const html = buildFullHtml(plan, schoolName);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Share a previously generated PDF file using the native share sheet.
 */
export async function shareYearPlanPDF(fileUri: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share Year Plan PDF',
  });
}
