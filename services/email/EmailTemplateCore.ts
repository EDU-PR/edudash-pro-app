/**
 * Email Template Core Service
 *
 * Core template management and email sending functionality.
 * Extracted from services/EmailTemplateService.ts per WARP.md standards.
 */

import { supabase } from '@/lib/supabase';
import type { EmailTemplate, EmailSendRequest, EmailSendResponse } from '@/types/email';

/**
 * Get all templates for a preschool (including system templates)
 */
export const getTemplates = async (
  preschoolId: string,
  type?: string
): Promise<EmailTemplate[]> => {
  let query = supabase
    .from('email_templates')
    .select('*')
    .or(`preschool_id.eq.${preschoolId},is_system_template.eq.true`)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('template_type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[EmailTemplateService] Failed to fetch templates:', error);
    throw error;
  }

  return data || [];
};

/**
 * Get a specific template by ID
 */
export const getTemplate = async (templateId: string): Promise<EmailTemplate | null> => {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    console.error('[EmailTemplateService] Failed to fetch template:', error);
    return null;
  }

  return data;
};

/**
 * Create a custom template
 */
export const createTemplate = async (
  template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<EmailTemplate | null> => {
  const { data, error } = await supabase
    .from('email_templates')
    .insert(template)
    .select()
    .single();

  if (error) {
    console.error('[EmailTemplateService] Failed to create template:', error);
    return null;
  }

  return data;
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  templateId: string,
  updates: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>>
): Promise<EmailTemplate | null> => {
  const { data, error } = await supabase
    .from('email_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    console.error('[EmailTemplateService] Failed to update template:', error);
    return null;
  }

  return data;
};

/**
 * Delete (deactivate) a template
 */
export const deleteTemplate = async (templateId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', templateId);

  if (error) {
    console.error('[EmailTemplateService] Failed to delete template:', error);
    return false;
  }

  return true;
};

/**
 * Render template with variables (Mustache-style substitution)
 */
export const renderTemplate = (
  template: string,
  variables: Record<string, unknown>
): string => {
  let rendered = template;

  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    const value = variables[key] ?? '';
    rendered = rendered.replace(regex, String(value));
  });

  return rendered;
};

/**
 * Send email via Supabase Edge Function
 */
export const sendEmail = async (request: EmailSendRequest): Promise<EmailSendResponse> => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      ...request,
      is_html: request.is_html !== false,
      confirmed: true,
    },
  });

  if (error) {
    console.error('[EmailTemplateService] Failed to send email:', error);
    return { success: false, error: error.message };
  }

  return data as EmailSendResponse;
};

/**
 * Send email with template rendering
 */
export const sendTemplatedEmail = async (
  templateId: string,
  variables: Record<string, unknown>,
  to: string | string[],
  options?: {
    reply_to?: string;
    cc?: string[];
    bcc?: string[];
  }
): Promise<EmailSendResponse> => {
  const template = await getTemplate(templateId);
  
  if (!template) {
    return { success: false, error: 'Template not found' };
  }

  const subject = renderTemplate(template.subject_template, variables);
  const body = renderTemplate(template.body_html, variables);

  return sendEmail({
    to,
    subject,
    body,
    is_html: true,
    ...options,
  });
};
