/**
 * Progress Report PDF Generator
 *
 * Generates professional PDF-quality HTML for progress reports.
 * Extracted from services/EmailTemplateService.ts per WARP.md standards.
 */

import type { ProgressReport, SchoolReadinessIndicators } from '@/types/email';

/**
 * Generate radar chart SVG for school readiness indicators
 */
export const generateRadarChartSVG = (
  indicators: Record<string, { rating: number; notes: string }>
): string => {
  const size = 500;
  const center = size / 2;
  const maxRadius = 130;
  const numAxes = Object.keys(indicators).length;
  const angleStep = (2 * Math.PI) / numAxes;

  // Calculate points for the polygon
  const points = Object.values(indicators)
    .map((indicator, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const radius = (indicator.rating / 5) * maxRadius;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(' ');

  // Generate axis lines and labels
  const axes = Object.keys(indicators)
    .map((key, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x2 = center + maxRadius * Math.cos(angle);
      const y2 = center + maxRadius * Math.sin(angle);
      const labelDistance = maxRadius + 60;
      const labelX = center + labelDistance * Math.cos(angle);
      const labelY = center + labelDistance * Math.sin(angle);
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      let textAnchor = 'middle';
      if (labelX < center - 20) textAnchor = 'end';
      else if (labelX > center + 20) textAnchor = 'start';

      return `
        <line x1="${center}" y1="${center}" x2="${x2}" y2="${y2}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" dominant-baseline="middle" font-size="11" fill="#374151" font-weight="600">${label}</text>
      `;
    })
    .join('');

  // Generate concentric circles for scale
  const circles = [1, 2, 3, 4, 5]
    .map((level) => {
      const radius = (level / 5) * maxRadius;
      return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="1" />`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
      ${circles}
      ${axes}
      <polygon points="${points}" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" stroke-width="2" />
      <circle cx="${center}" cy="${center}" r="4" fill="#3b82f6" />
      <text x="${center}" y="${size - 20}" text-anchor="middle" font-size="11" fill="#6b7280">Rating Scale: 1 (Center) to 5 (Outer)</text>
    </svg>
  `;
};

/**
 * Calculate milestone progress percentage
 */
export const calculateMilestoneProgress = (
  milestones: Record<string, boolean>
): { achieved: number; total: number; percentage: number } => {
  const total = Object.keys(milestones).length;
  const achieved = Object.values(milestones).filter(Boolean).length;
  const percentage = total > 0 ? Math.round((achieved / total) * 100) : 0;
  return { achieved, total, percentage };
};

/**
 * Generate QR code placeholder SVG
 */
export const generateQRCodePlaceholder = (_reportId: string): string => {
  return `
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" rx="4" fill="#f3f4f6"/>
      <rect x="10" y="10" width="25" height="25" rx="2" fill="#1f2937"/>
      <rect x="45" y="10" width="25" height="25" rx="2" fill="#1f2937"/>
      <rect x="10" y="45" width="25" height="25" rx="2" fill="#1f2937"/>
      <rect x="15" y="15" width="15" height="15" rx="1" fill="#f3f4f6"/>
      <rect x="50" y="15" width="15" height="15" rx="1" fill="#f3f4f6"/>
      <rect x="15" y="50" width="15" height="15" rx="1" fill="#f3f4f6"/>
      <rect x="45" y="45" width="10" height="10" fill="#1f2937"/>
      <rect x="58" y="45" width="12" height="12" fill="#1f2937"/>
      <rect x="45" y="58" width="12" height="12" fill="#1f2937"/>
      <text x="40" y="75" font-size="8" fill="#6b7280" text-anchor="middle">Scan Me</text>
    </svg>
  `;
};

/**
 * Generate next steps timeline based on readiness level
 */
export const generateNextStepsTimeline = (readinessLevel: string): string => {
  const timelines: Record<string, string[]> = {
    not_ready: [
      'Focus on developing basic self-care skills (using toilet, washing hands)',
      'Practice following simple 2-3 step instructions at home',
      'Read together daily to build vocabulary and listening skills',
      'Arrange regular playdates to develop social interaction',
      'Work on recognizing letters and numbers through play',
      'Schedule follow-up assessment in 3-4 months',
    ],
    developing: [
      'Continue building on strengths identified in this report',
      'Practice writing name and basic letter formation',
      'Encourage counting and simple addition/subtraction during daily activities',
      'Support independence in dressing and personal care',
      'Maintain consistent bedtime and morning routines',
      'Plan school visits to build familiarity and confidence',
    ],
    ready: [
      'Maintain current routines and continue supporting learning at home',
      'Visit the new school together to meet teachers and see classrooms',
      'Practice the new school routine (wake-up time, packing bag)',
      'Read books about starting "big school" to build excitement',
      'Continue developing reading and writing skills through fun activities',
      'Ensure all school registration paperwork is complete',
    ],
    exceeds_expectations: [
      'Challenge your child with age-appropriate advanced activities',
      'Consider enrichment programs or additional learning opportunities',
      'Prepare for potential placement in advanced learning groups',
      'Continue fostering love of learning through exploration and discovery',
      'Maintain balance between academic activities and play',
      'Connect with the new school about gifted/talented programs if available',
    ],
  };

  const steps = timelines[readinessLevel] || timelines.developing;
  return steps.map((step) => `<li style="margin-bottom: 8px;">${step}</li>`).join('');
};

/**
 * Generate subjects performance table HTML
 */
const generateSubjectsTableHTML = (
  subjectsPerformance: Record<string, { grade: string; comments: string }>
): string => {
  const subjectRows = Object.entries(subjectsPerformance)
    .map(
      ([subject, data]) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${subject}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #059669;">${data.grade || 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${data.comments || '-'}</td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="margin: 30px 0;">
      <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Subject Performance</h2>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Subject</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Grade</th>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Comments</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
        </tbody>
      </table>
    </div>
  `;
};

/**
 * Generate school readiness indicators HTML
 */
const generateReadinessIndicatorsHTML = (
  indicators: SchoolReadinessIndicators,
  milestones?: Record<string, boolean>
): string => {
  const indicatorRows = Object.entries(indicators)
    .map(([key, value]) => {
      const stars = '★'.repeat(value?.rating || 0) + '☆'.repeat(5 - (value?.rating || 0));
      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #f59e0b; font-size: 18px;">${stars}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${value?.notes || '-'}</td>
      </tr>
    `;
    })
    .join('');

  const milestonesHTML = milestones
    ? Object.entries(milestones)
        .map(
          ([key, achieved]) => `
          <li style="padding: 8px 0; color: ${achieved ? '#059669' : '#6b7280'};">
            <span style="display: inline-block; width: 20px; font-weight: bold;">${achieved ? '✓' : '○'}</span>
            ${key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </li>
        `
        )
        .join('')
    : '';

  return `
    <div style="margin: 30px 0;">
      <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">School Readiness Assessment</h2>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Development Area</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Rating</th>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${indicatorRows}
        </tbody>
      </table>
      ${
        milestonesHTML
          ? `
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">Developmental Milestones</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${milestonesHTML}
          </ul>
        </div>
      `
          : ''
      }
    </div>
  `;
};

/**
 * Progress Report PDF HTML Generator Options
 */
export interface PDFGeneratorOptions {
  report: ProgressReport;
  studentName: string;
  parentName: string;
  teacherName: string;
  preschoolName: string;
}

/**
 * Generate professional PDF-quality HTML for progress reports
 */
export const generateProgressReportPDFHTML = (options: PDFGeneratorOptions): string => {
  const { report, studentName, parentName, teacherName, preschoolName } = options;

  const isSchoolReadiness = report.report_category === 'school_readiness';
  const currentDate = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Generate components
  const radarChartSVG =
    isSchoolReadiness && report.school_readiness_indicators
      ? generateRadarChartSVG(report.school_readiness_indicators as any)
      : '';

  const milestoneProgress =
    isSchoolReadiness && report.developmental_milestones
      ? calculateMilestoneProgress(report.developmental_milestones)
      : null;

  const qrCodeURL = generateQRCodePlaceholder(report.id || 'preview');

  const subjectsHTML =
    !isSchoolReadiness && report.subjects_performance
      ? generateSubjectsTableHTML(report.subjects_performance)
      : '';

  const readinessHTML =
    isSchoolReadiness && report.school_readiness_indicators
      ? generateReadinessIndicatorsHTML(
          report.school_readiness_indicators as any,
          report.developmental_milestones
        )
      : '';

  const transitionReadinessLabel = report.transition_readiness_level
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  // Generate the full HTML document
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Progress Report - ${studentName}</title>
  <style>
    @page { 
      margin: 20mm;
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: #6b7280;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      position: relative;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72px;
      font-weight: bold;
      color: rgba(59, 130, 246, 0.05);
      z-index: -1;
      pointer-events: none;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 30px;
      position: relative;
    }
    .school-name { font-size: 28px; font-weight: 700; color: #1f2937; margin: 0; }
    .report-title { font-size: 20px; color: #6b7280; margin: 8px 0 0 0; }
    .qr-code { position: absolute; top: 0; right: 0; width: 80px; height: 80px; }
    .student-info {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      page-break-inside: avoid;
    }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-label { font-weight: 600; opacity: 0.9; }
    .section {
      margin: 30px 0;
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      page-break-inside: avoid;
    }
    .section-title {
      color: #1f2937;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 8px;
    }
    .chart-container { width: 100%; max-width: 500px; margin: 20px auto; page-break-inside: avoid; }
    .progress-bar { width: 100%; height: 30px; background: #e5e7eb; border-radius: 15px; overflow: hidden; }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #059669 0%, #10b981 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    .signature-section { display: flex; justify-content: space-between; margin-top: 60px; gap: 40px; page-break-inside: avoid; }
    .signature-box { flex: 1; min-width: 200px; }
    .signature-label { font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; }
    .signature-line { border-bottom: 2px solid #1f2937; height: 60px; margin-bottom: 8px; }
    .signature-name { font-size: 14px; color: #1f2937; font-weight: 500; }
    .signature-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    .approval-badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge-approved { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .signature-img { max-width: 200px; max-height: 80px; margin: 10px 0; border: 1px solid #e5e7eb; padding: 8px; background: white; border-radius: 4px; }
    @media print {
      body { margin: 0; padding: 10mm; }
      .section { box-shadow: none; border: 1px solid #e5e7eb; }
    }
  </style>
</head>
<body>
  <div class="watermark">OFFICIAL DOCUMENT</div>
  <div class="header">
    <h1 class="school-name">${preschoolName}</h1>
    <p class="report-title">${isSchoolReadiness ? '🎓 School Readiness Report' : '📚 Student Progress Report'}</p>
    ${
      report.status
        ? `
      <div style="margin-top: 12px;">
        <span class="approval-badge ${report.status === 'approved' ? 'badge-approved' : report.status === 'pending_review' ? 'badge-pending' : report.status === 'rejected' ? 'badge-rejected' : ''}">
          ${report.status === 'approved' ? '✓ Approved' : report.status === 'pending_review' ? '⏳ Pending Review' : report.status === 'rejected' ? '✗ Needs Revision' : report.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>
    `
        : ''
    }
    <div class="qr-code">${qrCodeURL}</div>
  </div>

  <div class="student-info">
    <div class="info-row"><span class="info-label">Student:</span><span>${studentName}</span></div>
    <div class="info-row"><span class="info-label">Parent/Guardian:</span><span>${parentName}</span></div>
    <div class="info-row"><span class="info-label">Report Period:</span><span>${report.report_period}</span></div>
    <div class="info-row"><span class="info-label">Date Issued:</span><span>${currentDate}</span></div>
    ${
      report.overall_grade
        ? `
    <div class="info-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.3);">
      <span class="info-label">Overall Grade:</span>
      <span style="font-size: 24px; font-weight: 700;">${report.overall_grade}</span>
    </div>
    `
        : ''
    }
    ${
      isSchoolReadiness && transitionReadinessLabel
        ? `
    <div class="info-row">
      <span class="info-label">Overall Readiness Level:</span>
      <span style="font-weight: 600;">${transitionReadinessLabel}</span>
    </div>
    `
        : ''
    }
  </div>

  ${
    report.teacher_comments
      ? `
  <div class="section">
    <h2 class="section-title">Teacher's Comments</h2>
    <p style="color: #374151; margin: 0; white-space: pre-wrap;">${report.teacher_comments}</p>
  </div>
  `
      : ''
  }

  ${
    report.strengths
      ? `
  <div class="section">
    <h2 class="section-title">Strengths</h2>
    <p style="color: #059669; margin: 0; white-space: pre-wrap;">${report.strengths}</p>
  </div>
  `
      : ''
  }

  ${
    report.areas_for_improvement
      ? `
  <div class="section">
    <h2 class="section-title">Areas for Improvement</h2>
    <p style="color: #f59e0b; margin: 0; white-space: pre-wrap;">${report.areas_for_improvement}</p>
  </div>
  `
      : ''
  }

  ${subjectsHTML}
  
  ${
    isSchoolReadiness && radarChartSVG
      ? `
  <div class="section">
    <h2 class="section-title">Development Areas Overview</h2>
    <div class="chart-container">${radarChartSVG}</div>
  </div>
  `
      : ''
  }
  
  ${readinessHTML}
  
  ${
    milestoneProgress
      ? `
  <div class="section">
    <h2 class="section-title">Milestone Progress</h2>
    <div style="margin: 15px 0;">
      <p style="margin: 0 0 10px 0; color: #374151; font-weight: 600;">
        ${milestoneProgress.achieved} of ${milestoneProgress.total} milestones achieved
      </p>
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width: ${milestoneProgress.percentage}%;">
          ${milestoneProgress.percentage}%
        </div>
      </div>
    </div>
  </div>
  `
      : ''
  }

  ${
    report.readiness_notes && isSchoolReadiness
      ? `
  <div class="section">
    <h2 class="section-title">Readiness Notes</h2>
    <p style="color: #374151; margin: 0; white-space: pre-wrap;">${report.readiness_notes}</p>
  </div>
  `
      : ''
  }

  ${
    report.recommendations && isSchoolReadiness
      ? `
  <div class="section">
    <h2 class="section-title">Recommendations</h2>
    <p style="color: #374151; margin: 0; white-space: pre-wrap;">${report.recommendations}</p>
  </div>
  <div style="page-break-before: avoid;">
    <h3 style="color: #1f2937; margin-top: 30px;">Next Steps Timeline</h3>
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        ${generateNextStepsTimeline(report.transition_readiness_level || 'developing')}
      </ul>
    </div>
  </div>
  `
      : ''
  }
  
  <div class="signature-section">
    <div class="signature-box">
      <p class="signature-label">Teacher/Preparer</p>
      ${
        report.teacher_signature || report.teacher_signature_data
          ? `<img src="${report.teacher_signature || report.teacher_signature_data}" alt="Teacher Signature" class="signature-img" />`
          : '<div class="signature-line"></div>'
      }
      <p class="signature-name">${teacherName}</p>
      <p class="signature-date">Signed: ${
        report.teacher_signed_at
          ? new Date(report.teacher_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
          : currentDate
      }</p>
    </div>
    <div class="signature-box">
      <p class="signature-label">Principal/Head - ${report.status === 'approved' ? 'Approved' : 'Approval'}</p>
      ${
        report.principal_signature_data && report.status === 'approved'
          ? `
        <img src="${report.principal_signature_data}" alt="Principal Signature" class="signature-img" />
        <p class="signature-name">${report.reviewer_name || 'Principal'}</p>
        <p class="signature-date">Approved: ${
          report.principal_signed_at
            ? new Date(report.principal_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'Date unavailable'
        }</p>
        ${report.review_notes ? `<p style="margin-top: 8px; font-size: 12px; color: #6b7280; font-style: italic;">Note: ${report.review_notes}</p>` : ''}
      `
          : `
        <div class="signature-line"></div>
        <p class="signature-name">___________________________</p>
        <p class="signature-date">Date: __________________</p>
      `
      }
    </div>
  </div>

  <div class="footer">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      <div style="text-align: left;">
        <p style="margin: 0; font-weight: 600;">Prepared by: ${teacherName}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px;">Teacher Signature: ${
          report.teacher_signed_at
            ? new Date(report.teacher_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'Pending'
        }</p>
      </div>
      ${
        report.status === 'approved' && report.reviewed_by
          ? `
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: 600;">Approved by: ${report.reviewer_name || 'Principal'}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">Approval Date: ${
            report.principal_signed_at
              ? new Date(report.principal_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })
              : 'N/A'
          }</p>
        </div>
      `
          : ''
      }
    </div>
    <p style="margin: 0;">Generated by EduDash Pro - ${preschoolName}</p>
    <p style="margin: 4px 0 0 0;">Document ID: ${report.id || 'Preview'} | Generated: ${currentDate}</p>
    ${
      report.status
        ? `<p style="margin: 8px 0 0 0; font-size: 11px;">Status: ${
            report.status === 'approved'
              ? 'Approved & Finalized'
              : report.status === 'pending_review'
                ? 'Awaiting Principal Approval'
                : report.status === 'rejected'
                  ? 'Returned for Revision'
                  : report.status.toUpperCase()
          }</p>`
        : ''
    }
    <p style="margin: 12px 0 0 0; font-size: 10px; font-style: italic;">
      This document is confidential and intended solely for the named parent/guardian. Unauthorized distribution is prohibited.
    </p>
  </div>
</body>
</html>
  `;
};
