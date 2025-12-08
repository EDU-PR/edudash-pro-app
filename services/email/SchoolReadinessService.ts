/**
 * School Readiness Email Service
 *
 * Generates school readiness report emails for Grade R transition.
 * Extracted from services/EmailTemplateService.ts per WARP.md standards.
 */

import type { ProgressReport } from '@/types/email';

/**
 * Readiness level color mapping
 */
const READINESS_LEVEL_COLORS: Record<string, string> = {
  not_ready: '#DC2626',
  developing: '#F59E0B',
  ready: '#059669',
  exceeds_expectations: '#7C3AED',
};

/**
 * Readiness level text mapping
 */
const READINESS_LEVEL_TEXT: Record<string, string> = {
  not_ready: 'Not Ready',
  developing: 'Developing',
  ready: 'Ready for School',
  exceeds_expectations: 'Exceeds Expectations',
};

/**
 * Generate readiness indicators table HTML
 */
const generateReadinessTableHtml = (
  indicators: Record<string, { rating: number; notes: string }>
): string => {
  if (!indicators || Object.keys(indicators).length === 0) {
    return '<tr><td colspan="3" style="padding: 8px;">No readiness data available</td></tr>';
  }

  const rows = Object.entries(indicators)
    .map(([indicator, data]) => {
      const ratingStars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
      const indicatorLabel = indicator
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return `<tr>
        <td style="padding: 12px; border: 1px solid #ddd;">${indicatorLabel}</td>
        <td style="padding: 12px; border: 1px solid #ddd; color: #F59E0B;">${ratingStars}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${data.notes || 'N/A'}</td>
      </tr>`;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Development Area</th>
          <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Rating</th>
          <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Generate milestones checklist HTML
 */
const generateMilestonesHtml = (milestones?: Record<string, boolean>): string => {
  if (!milestones || Object.keys(milestones).length === 0) {
    return '<li>No milestones tracked</li>';
  }

  return Object.entries(milestones)
    .map(([milestone, achieved]) => {
      const icon = achieved ? '✅' : '⏳';
      const milestoneLabel = milestone
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return `<li style="padding: 4px 0;"><span style="font-size: 16px;">${icon}</span> ${milestoneLabel}</li>`;
    })
    .join('');
};

/**
 * Generate school readiness report email
 * Specialized template for Grade R students transitioning to formal school
 */
export const generateSchoolReadinessEmail = async (
  report: ProgressReport,
  studentName: string,
  parentName: string,
  teacherName: string,
  preschoolName: string
): Promise<{ subject: string; html: string; text: string }> => {
  const readinessLevel = report.transition_readiness_level || 'developing';
  const readinessLevelColor = READINESS_LEVEL_COLORS[readinessLevel] || READINESS_LEVEL_COLORS.developing;
  const readinessLevelText = READINESS_LEVEL_TEXT[readinessLevel] || READINESS_LEVEL_TEXT.developing;

  // Generate readiness table
  const readinessTableHtml = report.school_readiness_indicators
    ? generateReadinessTableHtml(report.school_readiness_indicators)
    : '<p>No readiness data available</p>';

  // Generate milestones checklist
  const milestonesHtml = generateMilestonesHtml(report.developmental_milestones);

  const currentDate = new Date().toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Build HTML email body
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>School Readiness Report - ${studentName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
    <h1 style="margin: 0; font-size: 28px;">🎓 School Readiness Report</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${preschoolName}</p>
  </div>

  <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
    <p style="margin: 0;">Dear ${parentName},</p>
    <p>This report assesses <strong>${studentName}'s</strong> readiness for transitioning to formal schooling for the period: <strong>${report.report_period}</strong></p>
  </div>

  <div style="background: ${readinessLevelColor}15; border-left: 4px solid ${readinessLevelColor}; padding: 20px; margin-bottom: 20px; border-radius: 5px;">
    <h2 style="margin: 0 0 10px 0; color: ${readinessLevelColor};">Overall Readiness Level</h2>
    <p style="font-size: 24px; font-weight: bold; margin: 0; color: ${readinessLevelColor};">${readinessLevelText}</p>
  </div>

  <div style="margin-bottom: 30px;">
    <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Development Areas Assessment</h2>
    ${readinessTableHtml}
  </div>

  <div style="margin-bottom: 30px;">
    <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Developmental Milestones</h2>
    <ul style="list-style: none; padding: 0;">
      ${milestonesHtml}
    </ul>
  </div>

  ${
    report.strengths
      ? `
  <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
    <h3 style="margin: 0 0 10px 0; color: #059669;">💪 Strengths</h3>
    <p style="margin: 0;">${report.strengths}</p>
  </div>
  `
      : ''
  }

  ${
    report.areas_for_improvement
      ? `
  <div style="background: #fef3c7; border-left: 4px solid #F59E0B; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
    <h3 style="margin: 0 0 10px 0; color: #F59E0B;">🎯 Areas for Growth</h3>
    <p style="margin: 0;">${report.areas_for_improvement}</p>
  </div>
  `
      : ''
  }

  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
    <h3 style="margin: 0 0 10px 0; color: #3b82f6;">📝 Teacher's Notes</h3>
    <p style="margin: 0;">${report.readiness_notes || 'No additional notes'}</p>
  </div>

  <div style="background: #faf5ff; border-left: 4px solid #7c3aed; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
    <h3 style="margin: 0 0 10px 0; color: #7c3aed;">💡 Recommendations</h3>
    <p style="margin: 0;">${report.recommendations || "Continue supporting your child's learning at home."}</p>
  </div>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280;">
    <p style="margin: 5px 0;"><strong>Prepared by:</strong> ${teacherName}</p>
    <p style="margin: 5px 0;"><strong>Date:</strong> ${currentDate}</p>
    <p style="margin: 15px 0 5px 0; font-size: 12px;">This report is confidential and intended for parent/guardian review.</p>
  </div>
</body>
</html>
  `;

  const subject = `School Readiness Report - ${studentName} (${report.report_period})`;
  const text = `School Readiness Report for ${studentName}\n\nOverall Readiness: ${readinessLevelText}\n\nTeacher: ${teacherName}\n${preschoolName}`;

  return { subject, html, text };
};
