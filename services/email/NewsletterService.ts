/**
 * Newsletter Service
 *
 * Handles newsletter generation, persistence, and delivery.
 * Extracted from services/EmailTemplateService.ts per WARP.md standards.
 */

import { supabase } from '@/lib/supabase';
import type { Newsletter, EmailSendResponse } from '@/types/email';
import { getTemplates, renderTemplate, sendEmail } from './EmailTemplateCore';

/**
 * Recipient data for newsletters
 */
export interface NewsletterRecipient {
  email: string;
  name: string;
  user_id?: string;
}

/**
 * Newsletter send result
 */
export interface NewsletterSendResult {
  success: boolean;
  sent: number;
  failed: number;
}

/**
 * Generate newsletter email HTML
 */
export const generateNewsletterEmail = async (
  newsletter: Newsletter,
  preschoolName: string
): Promise<{ subject: string; html: string; text: string }> => {
  // Get newsletter template
  const templates = await getTemplates(newsletter.preschool_id, 'newsletter');
  const template = templates[0];

  if (!template) {
    throw new Error('No newsletter template found');
  }

  // Extract month from title or use current
  const month = newsletter.title.includes(' - ')
    ? newsletter.title.split(' - ')[1]
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const variables = {
    preschool_name: preschoolName,
    month,
    content: newsletter.content_html,
  };

  const subject = renderTemplate(template.subject_template, variables);
  const html = renderTemplate(template.body_html, variables);
  const text = newsletter.content_text || renderTemplate(template.body_text || '', variables);

  return { subject, html, text };
};

/**
 * Save newsletter to database
 */
export const saveNewsletter = async (
  newsletter: Omit<Newsletter, 'id'>
): Promise<Newsletter | null> => {
  const { data, error } = await supabase
    .from('newsletters')
    .insert(newsletter)
    .select()
    .single();

  if (error) {
    console.error('[NewsletterService] Failed to save newsletter:', error);
    return null;
  }

  return data;
};

/**
 * Update newsletter
 */
export const updateNewsletter = async (
  newsletterId: string,
  updates: Partial<Omit<Newsletter, 'id'>>
): Promise<Newsletter | null> => {
  const { data, error } = await supabase
    .from('newsletters')
    .update(updates)
    .eq('id', newsletterId)
    .select()
    .single();

  if (error) {
    console.error('[NewsletterService] Failed to update newsletter:', error);
    return null;
  }

  return data;
};

/**
 * Get newsletters for a preschool
 */
export const getNewsletters = async (preschoolId: string): Promise<Newsletter[]> => {
  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('preschool_id', preschoolId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NewsletterService] Failed to fetch newsletters:', error);
    return [];
  }

  return data || [];
};

/**
 * Get a single newsletter by ID
 */
export const getNewsletter = async (newsletterId: string): Promise<Newsletter | null> => {
  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('id', newsletterId)
    .single();

  if (error) {
    console.error('[NewsletterService] Failed to fetch newsletter:', error);
    return null;
  }

  return data;
};

/**
 * Track individual newsletter recipient
 */
const trackNewsletterRecipient = async (
  newsletterId: string,
  recipient: NewsletterRecipient,
  status: 'sent' | 'failed',
  error?: string
): Promise<void> => {
  try {
    await supabase.from('newsletter_recipients').insert({
      newsletter_id: newsletterId,
      user_id: recipient.user_id,
      email: recipient.email,
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      error_message: error,
    });
  } catch (e) {
    console.error('[NewsletterService] Failed to track recipient:', e);
  }
};

/**
 * Send newsletter to recipients
 */
export const sendNewsletter = async (
  newsletter: Newsletter,
  recipients: NewsletterRecipient[],
  preschoolName: string
): Promise<NewsletterSendResult> => {
  try {
    const { subject, html } = await generateNewsletterEmail(newsletter, preschoolName);

    let sent = 0;
    let failed = 0;

    // Send to each recipient
    for (const recipient of recipients) {
      const result = await sendEmail({
        to: recipient.email,
        subject,
        body: html,
        is_html: true,
        confirmed: true,
      });

      if (result.success) {
        sent++;

        // Track individual send
        if (newsletter.id) {
          await trackNewsletterRecipient(newsletter.id, recipient, 'sent');
        }
      } else {
        failed++;

        // Track failed send
        if (newsletter.id) {
          await trackNewsletterRecipient(newsletter.id, recipient, 'failed', result.error);
        }
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update newsletter stats
    if (newsletter.id) {
      await supabase
        .from('newsletters')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          total_recipients: recipients.length,
          sent_count: sent,
          failed_count: failed,
        })
        .eq('id', newsletter.id);
    }

    return { success: true, sent, failed };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NewsletterService] Failed to send newsletter:', errorMessage);
    return { success: false, sent: 0, failed: recipients.length };
  }
};

/**
 * Schedule newsletter for future delivery
 */
export const scheduleNewsletter = async (
  newsletterId: string,
  scheduledFor: Date
): Promise<Newsletter | null> => {
  return updateNewsletter(newsletterId, {
    status: 'scheduled',
    scheduled_for: scheduledFor.toISOString(),
  });
};

/**
 * Cancel scheduled newsletter
 */
export const cancelScheduledNewsletter = async (
  newsletterId: string
): Promise<Newsletter | null> => {
  return updateNewsletter(newsletterId, {
    status: 'draft',
    scheduled_for: undefined,
  });
};

/**
 * Get newsletter analytics
 */
export const getNewsletterAnalytics = async (
  newsletterId: string
): Promise<{
  totalRecipients: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
}> => {
  const newsletter = await getNewsletter(newsletterId);

  if (!newsletter) {
    return { totalRecipients: 0, sent: 0, failed: 0, opened: 0, clicked: 0 };
  }

  return {
    totalRecipients: newsletter.total_recipients || 0,
    sent: newsletter.sent_count || 0,
    failed: newsletter.failed_count || 0,
    opened: newsletter.open_count || 0,
    clicked: newsletter.click_count || 0,
  };
};
