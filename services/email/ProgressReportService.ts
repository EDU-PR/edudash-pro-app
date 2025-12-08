/**
 * Progress Report Service
 *
 * Handles progress report generation, persistence, and delivery.
 * Extracted from services/EmailTemplateService.ts per WARP.md standards.
 */

import { supabase } from '@/lib/supabase';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import type { ProgressReport, EmailSendResponse } from '@/types/email';
import { getTemplates, renderTemplate, sendEmail } from './EmailTemplateCore';
import { generateProgressReportPDFHTML } from './ProgressReportPDFGenerator';

/**
 * Generate subjects table HTML for email templates
 */
const generateSubjectsTableHtml = (
  subjectsPerformance?: Record<string, { grade: string; comments: string }>
): string => {
  if (!subjectsPerformance) {
    return '<tr><td colspan="3" style="padding: 8px;">No subject data available</td></tr>';
  }

  const rows = Object.entries(subjectsPerformance)
    .map(
      ([subject, data]) =>
        `<tr><td style="padding: 8px; border: 1px solid #ddd;">${subject}</td><td style="padding: 8px; border: 1px solid #ddd;">${data.grade}</td><td style="padding: 8px; border: 1px solid #ddd;">${data.comments}</td></tr>`
    )
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Subject</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Grade</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Comments</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Generate progress report email HTML
 */
export const generateProgressReportEmail = async (
  report: ProgressReport,
  studentName: string,
  parentName: string,
  teacherName: string,
  preschoolName: string
): Promise<{ subject: string; html: string; text: string }> => {
  // Get progress report template
  const templates = await getTemplates(report.preschool_id, 'progress_report');
  const template = templates[0];

  // If no template exists, use professional PDF HTML as fallback
  if (!template) {
    if (__DEV__) {
      console.log('[ProgressReportService] No template found, using PDF HTML fallback');
    }
    const html = generateProgressReportPDFHTML({
      report,
      studentName,
      parentName,
      teacherName,
      preschoolName,
    });
    const subject = `Progress Report for ${studentName} - ${report.report_period}`;
    return { subject, html, text: '' };
  }

  // Generate subjects table
  const subjectsTableHtml = generateSubjectsTableHtml(report.subjects_performance);

  // Variables for template
  const variables = {
    student_name: studentName,
    parent_name: parentName,
    report_period: report.report_period,
    overall_grade: report.overall_grade || 'N/A',
    teacher_comments: report.teacher_comments || 'No comments provided',
    subjects_table: subjectsTableHtml,
    teacher_name: teacherName,
    preschool_name: preschoolName,
    strengths: report.strengths || '',
    areas_for_improvement: report.areas_for_improvement || '',
  };

  const subject = renderTemplate(template.subject_template, variables);
  const html = renderTemplate(template.body_html, variables);
  const text = template.body_text ? renderTemplate(template.body_text, variables) : '';

  return { subject, html, text };
};

/**
 * Send progress report email to parent
 */
export const sendProgressReport = async (
  report: ProgressReport,
  parentEmail: string,
  studentName: string,
  parentName: string,
  teacherName: string,
  preschoolName: string
): Promise<EmailSendResponse> => {
  try {
    const { subject, html } = await generateProgressReportEmail(
      report,
      studentName,
      parentName,
      teacherName,
      preschoolName
    );

    const result = await sendEmail({
      to: parentEmail,
      subject,
      body: html,
      is_html: true,
      confirmed: true,
    });

    // Update report with email tracking info
    if (result.success && report.id) {
      await supabase
        .from('progress_reports')
        .update({
          email_sent_at: new Date().toISOString(),
          email_message_id: result.message_id,
        })
        .eq('id', report.id);
    }

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ProgressReportService] Failed to send progress report:', error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Generate progress report as PDF file
 */
export const generateProgressReportPDF = async (
  report: ProgressReport,
  studentName: string,
  parentName: string,
  teacherName: string,
  preschoolName: string
): Promise<{ success: boolean; uri?: string; error?: string }> => {
  try {
    const html = generateProgressReportPDFHTML({
      report,
      studentName,
      parentName,
      teacherName,
      preschoolName,
    });

    // Generate PDF from HTML
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (!uri) {
      return { success: false, error: 'Failed to generate PDF' };
    }

    // Move file to permanent location
    const fileName = `progress_report_${studentName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.moveAsync({
      from: uri,
      to: filePath,
    });

    return { success: true, uri: filePath };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ProgressReportService] Failed to generate PDF:', error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Save progress report to database (upsert)
 */
export const saveProgressReport = async (
  report: Omit<ProgressReport, 'id'>
): Promise<ProgressReport | null> => {
  try {
    // Check if report exists for this student and period
    const { data: existing, error: fetchError } = await supabase
      .from('progress_reports')
      .select('id')
      .eq('student_id', report.student_id)
      .eq('report_period', report.report_period)
      .maybeSingle();

    if (fetchError) {
      console.error('[ProgressReportService] Failed to check existing report:', fetchError);
      return null;
    }

    // Update if exists
    if (existing) {
      const { data, error } = await supabase
        .from('progress_reports')
        .update({
          ...report,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[ProgressReportService] Failed to update progress report:', error);
        return null;
      }

      return data;
    }

    // Insert new report
    const { data, error } = await supabase
      .from('progress_reports')
      .insert(report)
      .select()
      .single();

    if (error) {
      console.error('[ProgressReportService] Failed to save progress report:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[ProgressReportService] Unexpected error saving progress report:', error);
    return null;
  }
};

/**
 * Get progress reports for a student
 */
export const getProgressReports = async (studentId: string): Promise<ProgressReport[]> => {
  const { data, error } = await supabase
    .from('progress_reports')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ProgressReportService] Failed to fetch progress reports:', error);
    return [];
  }

  return data || [];
};

/**
 * Get a single progress report by ID
 */
export const getProgressReport = async (reportId: string): Promise<ProgressReport | null> => {
  const { data, error } = await supabase
    .from('progress_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) {
    console.error('[ProgressReportService] Failed to fetch progress report:', error);
    return null;
  }

  return data;
};

/**
 * Export progress report data as CSV
 */
export const exportProgressReportCSV = async (
  report: ProgressReport,
  studentName: string,
  preschoolName: string
): Promise<{ success: boolean; csv?: string; uri?: string; error?: string }> => {
  try {
    const isSchoolReadiness = report.report_category === 'school_readiness';

    let csvContent = 'Field,Value\n';

    // Basic information
    csvContent += `"Student Name","${studentName}"\n`;
    csvContent += `"School","${preschoolName}"\n`;
    csvContent += `"Report Period","${report.report_period}"\n`;
    csvContent += `"Report Type","${report.report_type}"\n`;
    csvContent += `"Report Category","${report.report_category || 'general'}"\n`;
    csvContent += `"Overall Grade","${report.overall_grade || 'N/A'}"\n`;
    csvContent += `"Date Generated","${new Date().toISOString()}"\n`;
    csvContent += '\n';

    // Comments
    csvContent += `"Teacher Comments","${(report.teacher_comments || '').replace(/"/g, '""')}"\n`;
    csvContent += `"Strengths","${(report.strengths || '').replace(/"/g, '""')}"\n`;
    csvContent += `"Areas for Improvement","${(report.areas_for_improvement || '').replace(/"/g, '""')}"\n`;
    csvContent += '\n';

    // School readiness specific
    if (isSchoolReadiness) {
      csvContent += `"Transition Readiness Level","${report.transition_readiness_level || 'N/A'}"\n`;
      csvContent += `"Readiness Notes","${(report.readiness_notes || '').replace(/"/g, '""')}"\n`;
      csvContent += `"Recommendations","${(report.recommendations || '').replace(/"/g, '""')}"\n`;
      csvContent += '\n';

      if (report.school_readiness_indicators) {
        csvContent += '"Development Area","Rating","Notes"\n';
        Object.entries(report.school_readiness_indicators).forEach(([key, value]) => {
          const area = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          csvContent += `"${area}","${value.rating}/5","${(value.notes || '').replace(/"/g, '""')}"\n`;
        });
        csvContent += '\n';
      }

      if (report.developmental_milestones) {
        csvContent += '"Milestone","Achieved"\n';
        Object.entries(report.developmental_milestones).forEach(([key, achieved]) => {
          const milestone = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          csvContent += `"${milestone}","${achieved ? 'Yes' : 'No'}"\n`;
        });
      }
    } else if (report.subjects_performance) {
      csvContent += '"Subject","Grade","Comments"\n';
      Object.entries(report.subjects_performance).forEach(([subject, data]) => {
        csvContent += `"${subject}","${data.grade}","${(data.comments || '').replace(/"/g, '""')}"\n`;
      });
    }

    // Save to file
    const fileName = `progress_report_${studentName.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return { success: true, csv: csvContent, uri: filePath };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ProgressReportService] Failed to export CSV:', error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Bulk generate and send progress reports
 */
export const bulkGenerateProgressReports = async (
  reports: Array<{
    report: Omit<ProgressReport, 'id'>;
    studentName: string;
    parentEmail: string;
    parentName: string;
  }>,
  teacherName: string,
  preschoolName: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> => {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < reports.length; i++) {
    const { report, studentName, parentEmail, parentName } = reports[i];

    try {
      // Save report
      const savedReport = await saveProgressReport(report);
      if (!savedReport) {
        throw new Error('Failed to save report');
      }

      // Send email
      const result = await sendProgressReport(
        { ...savedReport, id: savedReport.id },
        parentEmail,
        studentName,
        parentName,
        teacherName,
        preschoolName
      );

      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${studentName}: ${result.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed++;
      errors.push(`${studentName}: ${errorMessage}`);
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, reports.length);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { success, failed, errors };
};
