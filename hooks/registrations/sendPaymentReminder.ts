/**
 * Build and send a payment-reminder email for a registration.
 *
 * Fetches school banking details, constructs an HTML email,
 * and dispatches via the send-email Edge Function.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

import type { Registration, ShowAlert } from './types';

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function buildPaymentReminderHtml(params: {
  studentName: string;
  schoolName: string;
  feeAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentReference: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  swiftCode: string;
  popUploadUrl: string;
}): string {
  const {
    studentName,
    schoolName,
    feeAmount,
    discountAmount,
    finalAmount,
    paymentReference,
    bankName,
    accountName,
    accountNumber,
    branchCode,
    swiftCode,
    popUploadUrl,
  } = params;

  const discountRow =
    discountAmount > 0
      ? `<tr>
            <td style="padding: 8px 0;">Discount:</td>
            <td style="padding: 8px 0; text-align: right; color: #10B981;">-R${discountAmount.toFixed(2)}</td>
          </tr>`
      : '';

  const branchRow = branchCode
    ? `<tr><td style="padding:6px 0;">Branch Code:</td><td style="padding:6px 0;text-align:right;font-weight:600;">${branchCode}</td></tr>`
    : '';

  const swiftRow = swiftCode
    ? `<tr><td style="padding:6px 0;">SWIFT Code:</td><td style="padding:6px 0;text-align:right;font-weight:600;">${swiftCode}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="padding:30px;">
      <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
        This is a friendly reminder that we have not yet received proof of payment for
        <strong>${studentName}</strong>'s registration at ${schoolName}.
      </p>

      <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 15px;font-size:16px;color:#333;">Payment Details</h3>
        <table style="width:100%;font-size:14px;color:#555;">
          <tr><td style="padding:8px 0;">Student Name:</td><td style="padding:8px 0;text-align:right;font-weight:600;">${studentName}</td></tr>
          <tr><td style="padding:8px 0;">Registration Fee:</td><td style="padding:8px 0;text-align:right;">R${feeAmount.toFixed(2)}</td></tr>
          ${discountRow}
          <tr style="border-top:2px solid #ddd;">
            <td style="padding:12px 0;font-weight:700;color:#333;">Amount Due:</td>
            <td style="padding:12px 0;text-align:right;font-weight:700;color:#333;font-size:18px;">R${finalAmount.toFixed(2)}</td>
          </tr>
          <tr><td style="padding:8px 0;">Payment Reference:</td><td style="padding:8px 0;text-align:right;font-weight:600;">${paymentReference}</td></tr>
        </table>
      </div>

      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 15px;font-size:16px;color:#333;">School Banking Details</h3>
        <table style="width:100%;font-size:14px;color:#555;">
          <tr><td style="padding:6px 0;">Bank:</td><td style="padding:6px 0;text-align:right;font-weight:600;">${bankName}</td></tr>
          <tr><td style="padding:6px 0;">Account Name:</td><td style="padding:6px 0;text-align:right;font-weight:600;">${accountName}</td></tr>
          <tr><td style="padding:6px 0;">Account Number:</td><td style="padding:6px 0;text-align:right;font-weight:600;">${accountNumber}</td></tr>
          ${branchRow}
          ${swiftRow}
        </table>
      </div>

      <p style="margin:20px 0;font-size:15px;color:#555;line-height:1.6;">
        Please upload your proof of payment via the EduDash Pro app or respond to this email with the payment receipt attached.
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${popUploadUrl}" style="display:inline-block;padding:12px 20px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Upload Proof of Payment
        </a>
        <p style="margin:10px 0 0;font-size:12px;color:#888;">
          If the button doesn't open, use your app and select Upload POP, then enter the reference above.
        </p>
      </div>

      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#856404;">
          <strong>⚠️ Important:</strong> Registration is only complete once payment has been received and verified.
        </p>
      </div>

      <p style="margin:20px 0 0;font-size:15px;color:#555;">
        If you have already made the payment, please disregard this message. For any questions, please contact us.
      </p>

      <p style="margin:30px 0 0;font-size:15px;color:#555;">
        Warm regards,<br><strong>${schoolName}</strong>
      </p>
    </div>
    <div style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#888;">This email was sent via EduDash Pro</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Fetch banking details (primary → active → payment method fallback)
// ---------------------------------------------------------------------------

interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  swiftCode: string;
}

async function fetchBankDetails(
  supabase: ReturnType<typeof assertSupabase>,
  organizationId: string,
  schoolName: string,
): Promise<BankDetails> {
  const { data: primaryBank } = await supabase
    .from('organization_bank_accounts')
    .select('bank_name, account_name, account_number, account_number_masked, branch_code, swift_code')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  let bankDetails = primaryBank;

  if (!bankDetails) {
    const { data: anyBank } = await supabase
      .from('organization_bank_accounts')
      .select('bank_name, account_name, account_number, account_number_masked, branch_code, swift_code')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(1);
    bankDetails = anyBank?.[0];
  }

  if (!bankDetails) {
    const { data: paymentMethod } = await supabase
      .from('organization_payment_methods')
      .select('bank_name, account_name, account_number, branch_code')
      .eq('organization_id', organizationId)
      .eq('method_name', 'bank_transfer')
      .maybeSingle();
    bankDetails = paymentMethod as typeof bankDetails;
  }

  return {
    bankName: bankDetails?.bank_name || 'Contact school',
    accountName: bankDetails?.account_name || schoolName,
    accountNumber:
      bankDetails?.account_number || bankDetails?.account_number_masked || 'Contact school',
    branchCode: bankDetails?.branch_code || '',
    swiftCode: (bankDetails as Record<string, unknown>)?.swift_code as string || '',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function sendPaymentReminder(
  registration: Registration,
  showAlert: ShowAlert,
  setSendingReminder: (id: string | null) => void,
  fetchRegistrations: () => void,
): void {
  showAlert({
    title: 'Send Payment Reminder',
    message: `Send a payment reminder email to ${registration.guardian_name} (${registration.guardian_email})?`,
    type: 'info',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Reminder',
        onPress: async () => {
          setSendingReminder(registration.id);
          try {
            const supabase = assertSupabase();

            // School name
            const { data: orgData } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', registration.organization_id)
              .single();
            const schoolName = orgData?.name || 'Our School';

            const feeAmount = registration.registration_fee_amount || 200;
            const discountAmount = registration.discount_amount || 0;
            const finalAmount = feeAmount - discountAmount;
            const paymentReference =
              registration.payment_reference ||
              `REG-${registration.id.slice(0, 8).toUpperCase()}`;

            const bank = await fetchBankDetails(supabase, registration.organization_id, schoolName);

            const appBaseUrl =
              process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://app.edudashpro.org.za';
            const popUploadUrl = `${appBaseUrl}/screens/parent-payments?tab=upload&ref=${encodeURIComponent(paymentReference)}&amount=${encodeURIComponent(finalAmount.toFixed(2))}`;

            const studentName = `${registration.student_first_name} ${registration.student_last_name}`;
            const emailBody = buildPaymentReminderHtml({
              studentName,
              schoolName,
              feeAmount,
              discountAmount,
              finalAmount,
              paymentReference,
              ...bank,
            popUploadUrl,
            });

            const { data, error } = await supabase.functions.invoke('send-email', {
              body: {
                to: registration.guardian_email,
                subject: `Payment Reminder: ${registration.student_first_name}'s Registration at ${schoolName}`,
                body: emailBody,
                is_html: true,
                confirmed: true,
              },
            });

            if (error) throw new Error(error.message || 'Failed to send email');
            if (!data?.success) throw new Error(data?.error || 'Email sending failed');

            // Log the reminder (non-fatal)
            try {
              await supabase
                .from('registration_requests')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', registration.id);
            } catch {
              // Non-fatal
            }

            showAlert({
              title: 'Reminder Sent ✓',
              message: `Payment reminder email has been sent to ${registration.guardian_email}`,
              type: 'success',
            });
          } catch (err: unknown) {
            const error = err as { message?: string };
            logger.error('Registrations', 'Error sending payment reminder', error);
            showAlert({
              title: 'Error',
              message: error.message || 'Failed to send payment reminder',
              type: 'error',
            });
          } finally {
            setSendingReminder(null);
          }
        },
      },
    ],
  });
}
