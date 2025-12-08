/**
 * Email Services - Index Re-exports
 *
 * This file provides backwards-compatible exports for all email services.
 * Refactored from original 1569-line EmailTemplateService.ts into modular components.
 *
 * Architecture:
 * - types/email.ts: Type definitions
 * - services/email/EmailTemplateCore.ts: Template CRUD and email sending
 * - services/email/ProgressReportService.ts: Progress report operations
 * - services/email/ProgressReportPDFGenerator.ts: PDF HTML generation
 * - services/email/NewsletterService.ts: Newsletter operations
 * - services/email/SchoolReadinessService.ts: School readiness emails
 */

// Re-export all types
export type {
  EmailTemplate,
  ProgressReport,
  Newsletter,
  EmailSendRequest,
  EmailSendResponse,
  SchoolReadinessIndicators,
  StudentData,
  SchoolData,
  TeacherData,
  RecipientData,
  ProgressReportEmailVariables,
  NewsletterEmailVariables,
} from '@/types/email';

// Re-export template core functions
export {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
  sendEmail,
  sendTemplatedEmail,
} from './EmailTemplateCore';

// Re-export progress report functions
export {
  generateProgressReportEmail,
  sendProgressReport,
  generateProgressReportPDF,
  saveProgressReport,
  getProgressReports,
  getProgressReport,
  exportProgressReportCSV,
  bulkGenerateProgressReports,
} from './ProgressReportService';

// Re-export PDF generator functions
export {
  generateProgressReportPDFHTML,
  generateRadarChartSVG,
  calculateMilestoneProgress,
  generateQRCodePlaceholder,
  generateNextStepsTimeline,
  type PDFGeneratorOptions,
} from './ProgressReportPDFGenerator';

// Re-export newsletter functions
export {
  generateNewsletterEmail,
  saveNewsletter,
  updateNewsletter,
  getNewsletters,
  getNewsletter,
  sendNewsletter,
  scheduleNewsletter,
  cancelScheduledNewsletter,
  getNewsletterAnalytics,
  type NewsletterRecipient,
  type NewsletterSendResult,
} from './NewsletterService';

// Re-export school readiness functions
export { generateSchoolReadinessEmail } from './SchoolReadinessService';

/**
 * Legacy EmailTemplateService class wrapper for backwards compatibility
 * Wraps all modular functions to maintain existing API
 */
import * as EmailTemplateCore from './EmailTemplateCore';
import * as ProgressReportService from './ProgressReportService';
import * as NewsletterService from './NewsletterService';
import * as SchoolReadinessService from './SchoolReadinessService';
import * as PDFGenerator from './ProgressReportPDFGenerator';
import type { EmailTemplate, ProgressReport, Newsletter, EmailSendRequest } from '@/types/email';

class EmailTemplateService {
  // Template methods
  getTemplates = EmailTemplateCore.getTemplates;
  getTemplate = EmailTemplateCore.getTemplate;
  createTemplate = EmailTemplateCore.createTemplate;
  renderTemplate = EmailTemplateCore.renderTemplate;
  sendEmail = EmailTemplateCore.sendEmail;

  // Progress report methods
  generateProgressReportEmail = ProgressReportService.generateProgressReportEmail;
  sendProgressReport = ProgressReportService.sendProgressReport;
  generateProgressReportPDF = ProgressReportService.generateProgressReportPDF;
  saveProgressReport = ProgressReportService.saveProgressReport;
  getProgressReports = ProgressReportService.getProgressReports;
  exportProgressReportCSV = ProgressReportService.exportProgressReportCSV;
  bulkGenerateProgressReports = ProgressReportService.bulkGenerateProgressReports;

  // Newsletter methods
  generateNewsletterEmail = NewsletterService.generateNewsletterEmail;
  saveNewsletter = NewsletterService.saveNewsletter;
  getNewsletters = NewsletterService.getNewsletters;
  sendNewsletter = NewsletterService.sendNewsletter;

  // School readiness methods
  generateSchoolReadinessEmail = SchoolReadinessService.generateSchoolReadinessEmail;

  // PDF generation (private methods now public for compatibility)
  private generateProfessionalPDFHTML = PDFGenerator.generateProgressReportPDFHTML;
  private generateRadarChartSVG = PDFGenerator.generateRadarChartSVG;
  private calculateMilestoneProgress = PDFGenerator.calculateMilestoneProgress;
  private generateQRCodePlaceholder = PDFGenerator.generateQRCodePlaceholder;
  private generateNextStepsTimeline = PDFGenerator.generateNextStepsTimeline;
}

export const emailTemplateService = new EmailTemplateService();
export default emailTemplateService;
