/**
 * Send a POP (Proof of Payment) upload link via email or WhatsApp.
 *
 * Only available for EduSite (website) registrations.
 */

import { Linking } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { convertToE164 } from '@/lib/utils/phoneUtils';
import { logger } from '@/lib/logger';

import type { Registration, ShowAlert } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPopUploadLink(registrationId: string, recipientEmail?: string): string {
  const baseUrl =
    process.env.EXPO_PUBLIC_WEBSITE_URL ||
    process.env.EXPO_PUBLIC_WEB_URL ||
    'https://www.edudashpro.org.za';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const emailParam = recipientEmail ? `&email=${encodeURIComponent(recipientEmail)}` : '';
  return `${cleanBaseUrl}/registration/pop-upload?registration_id=${encodeURIComponent(registrationId)}${emailParam}`;
}

interface WhatsAppTarget {
  label: string;
  e164: string;
  display: string;
}

function getWhatsAppTargets(registration: Registration): WhatsAppTarget[] {
  const targets: WhatsAppTarget[] = [];
  const seen = new Set<string>();

  const candidates = [
    { label: 'Parent', phone: registration.parent_phone },
    { label: 'Guardian', phone: registration.guardian_phone },
  ].filter((entry) => !!entry.phone);

  for (const candidate of candidates) {
    const result = convertToE164(candidate.phone || '');
    if (result.isValid && result.e164 && !seen.has(result.e164)) {
      seen.add(result.e164);
      targets.push({
        label: candidate.label,
        e164: result.e164,
        display: result.formatted || result.e164,
      });
    }
  }

  return targets;
}

async function openWhatsApp(
  phoneE164: string,
  message: string,
  showAlert: ShowAlert,
): Promise<void> {
  const digits = phoneE164.replace(/[^\d]/g, '');
  const encodedMessage = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${digits}&text=${encodedMessage}`;
  const webUrl = `https://wa.me/${digits}?text=${encodedMessage}`;

  try {
    const canOpenApp = await Linking.canOpenURL('whatsapp://send');
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  } catch (err) {
    logger.error('Registrations', 'Failed to open WhatsApp link', err);
    showAlert({
      title: 'WhatsApp Not Available',
      message: 'Unable to open WhatsApp on this device. Please try again or use email.',
      type: 'error',
    });
  }
}

// ---------------------------------------------------------------------------
// Email sender (internal)
// ---------------------------------------------------------------------------

async function handleSendEmail(
  registration: Registration,
  uniqueEmails: string[],
  showAlert: ShowAlert,
  setSendingPopLink: (id: string | null) => void,
): Promise<void> {
  if (uniqueEmails.length === 0) {
    showAlert({
      title: 'No Parent Email',
      message: 'No parent email address is available for this registration.',
      type: 'warning',
    });
    return;
  }

  setSendingPopLink(registration.id);
  try {
    const supabase = assertSupabase();
    const studentName = `${registration.student_first_name} ${registration.student_last_name}`.trim();
    const schoolName = registration.organization_name || 'your school';

    const results = await Promise.all(
      uniqueEmails.map(async (recipient) => {
        const uploadLink = buildPopUploadLink(registration.id, recipient);

        const emailBody = `
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
  <h2 style="color: #1d4ed8; margin-bottom: 8px;">Upload Proof of Payment</h2>
  <p>Dear Parent,</p>
  <p>We are finalizing <strong>${studentName}</strong>'s registration at <strong>${schoolName}</strong>.</p>
  <p>Please upload your proof of payment using the secure link below:</p>
  <p style="margin: 20px 0;">
    <a href="${uploadLink}" style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">
      Upload Proof of Payment
    </a>
  </p>
  <p>If the button does not work, copy and paste this link into your browser:</p>
  <p style="word-break: break-all; color: #475569;">${uploadLink}</p>
  <p style="font-size: 12px; color: #64748b; margin-top: 16px;">Do not share this link. It is intended only for the registered parent.</p>
</div>`.trim();

        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            to: recipient,
            subject: `Upload Proof of Payment - ${studentName}`,
            body: emailBody,
            confirmed: true,
            is_html: true,
          },
        });

        return { recipient, data, error };
      }),
    );

    const failures = results.filter((r) => r.error || r.data?.success === false);

    if (failures.length > 0) {
      logger.error('Registrations', 'POP link send failures', failures.map((f) => f.error || f.data));
      showAlert({
        title: 'Partial Success',
        message: 'POP upload link sent to some recipients, but at least one email failed.',
        type: 'warning',
      });
    } else {
      showAlert({
        title: 'POP Upload Link Sent',
        message: `POP upload link sent to ${uniqueEmails.join(', ')}.`,
        type: 'success',
      });
    }
  } catch (err: unknown) {
    const error = err as { message?: string };
    logger.error('Registrations', 'Error sending POP upload link', error);
    showAlert({
      title: 'Send Failed',
      message: error.message || 'Failed to send POP upload link',
      type: 'error',
    });
  } finally {
    setSendingPopLink(null);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function sendPopUploadLink(
  registration: Registration,
  showAlert: ShowAlert,
  setSendingPopLink: (id: string | null) => void,
): void {
  if (registration.source && registration.source !== 'edusite') {
    showAlert({
      title: 'POP Link Unavailable',
      message: 'POP upload links are only available for website registrations.',
      type: 'warning',
    });
    return;
  }

  const recipientEmails = [registration.guardian_email, registration.parent_email]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => !!email);
  const uniqueEmails = Array.from(new Set(recipientEmails));
  const whatsappTargets = getWhatsAppTargets(registration);

  if (uniqueEmails.length === 0 && whatsappTargets.length === 0) {
    showAlert({
      title: 'No Parent Contact',
      message: 'No parent email or WhatsApp number is available for this registration.',
      type: 'warning',
    });
    return;
  }

  const studentName = `${registration.student_first_name} ${registration.student_last_name}`.trim();
  const schoolName = registration.organization_name || 'your school';
  const defaultEmail = uniqueEmails[0];

  const handleSendWhatsApp = async () => {
    if (whatsappTargets.length === 0) {
      showAlert({
        title: 'No WhatsApp Number',
        message: 'No valid parent phone number is available for WhatsApp.',
        type: 'warning',
      });
      return;
    }

    const uploadLink = buildPopUploadLink(registration.id, defaultEmail);
    const message = `Hello! This is ${schoolName}.\n\nPlease upload proof of payment for ${studentName} using the secure link below:\n${uploadLink}\n\nIf you have any questions, reply to this message.`;

    const openForTarget = async (target: WhatsAppTarget) => {
      setSendingPopLink(registration.id);
      await openWhatsApp(target.e164, message, showAlert);
      setSendingPopLink(null);
    };

    if (whatsappTargets.length === 1) {
      await openForTarget(whatsappTargets[0]);
      return;
    }

    showAlert({
      title: 'Choose WhatsApp Recipient',
      message: 'Select which number should receive the POP upload link.',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        ...whatsappTargets.map((target) => ({
          text: `${target.label} (${target.display})`,
          onPress: () => {
            void openForTarget(target);
          },
        })),
      ],
    });
  };

  // Build the action picker
  const actionButtons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [
    { text: 'Cancel', style: 'cancel' },
  ];
  if (uniqueEmails.length > 0) {
    actionButtons.push({
      text: 'Email',
      onPress: () => void handleSendEmail(registration, uniqueEmails, showAlert, setSendingPopLink),
    });
  }
  if (whatsappTargets.length > 0) {
    actionButtons.push({ text: 'WhatsApp', onPress: handleSendWhatsApp });
  }

  const contactSummary = [
    uniqueEmails.length > 0 ? `Email: ${uniqueEmails.join(', ')}` : null,
    whatsappTargets.length > 0
      ? `WhatsApp: ${whatsappTargets.map((t) => `${t.label} ${t.display}`).join(', ')}`
      : null,
  ].filter(Boolean);

  showAlert({
    title: 'Send POP Upload Link',
    message:
      contactSummary.length > 0
        ? `Choose how to send the POP upload link.\n\n${contactSummary.join('\n')}`
        : 'Choose how to send the POP upload link.',
    type: 'info',
    buttons: actionButtons,
  });
}
