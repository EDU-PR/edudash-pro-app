// ================================================
// InvoiceService — thin facade for backward compatibility
// Delegates to invoiceCrudService + invoiceOpsService
// ================================================

import * as crud from './invoiceCrudService';
import * as ops from './invoiceOpsService';

import type {
  Invoice,
  InvoicePayment,
  InvoiceTemplate,
  SchoolBranding,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  CreateInvoicePaymentRequest,
  CreateInvoiceTemplateRequest,
  UpdateSchoolBrandingRequest,
  InvoiceFilters,
  InvoiceListResponse,
  InvoiceStats,
  PaymentMethod,
} from '@/lib/types/invoice';

export class InvoiceService {
  // CRUD
  static createInvoice(data: CreateInvoiceRequest): Promise<Invoice> { return crud.createInvoice(data); }
  static updateInvoice(data: UpdateInvoiceRequest): Promise<Invoice> { return crud.updateInvoice(data); }
  static getInvoices(filters?: InvoiceFilters): Promise<InvoiceListResponse> { return crud.getInvoices(filters); }
  static getInvoiceById(id: string): Promise<Invoice> { return crud.getInvoiceById(id); }
  static deleteInvoice(id: string): Promise<void> { return crud.deleteInvoice(id); }

  // Payments
  static createPayment(data: CreateInvoicePaymentRequest): Promise<InvoicePayment> { return crud.createPayment(data); }
  static markAsPaid(id: string, method?: PaymentMethod, ref?: string): Promise<void> { return crud.markAsPaid(id, method, ref); }

  // Stats
  static getInvoiceStats(): Promise<InvoiceStats> { return ops.getInvoiceStats(); }

  // Templates
  static getTemplates(): Promise<InvoiceTemplate[]> { return ops.getTemplates(); }
  static createTemplate(data: CreateInvoiceTemplateRequest): Promise<InvoiceTemplate> { return ops.createTemplate(data); }

  // Branding
  static getSchoolBranding(): Promise<SchoolBranding | null> { return ops.getSchoolBranding(); }
  static updateSchoolBranding(data: UpdateSchoolBrandingRequest): Promise<SchoolBranding> { return ops.updateSchoolBranding(data); }

  // Utilities
  static sendInvoiceEmail(invoiceId: string, email?: string): Promise<void> { return ops.sendInvoiceEmail(invoiceId, email); }
  static generateQRCode(invoiceId: string): Promise<string> { return ops.generateQRCode(invoiceId); }
  static generateInvoicePDF(invoiceId: string): Promise<string> { return ops.generateInvoicePDF(invoiceId); }
}

export default InvoiceService;
