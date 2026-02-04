import { z } from 'zod';
import { assertSupabase } from '@/lib/supabase';
import type {
  BirthdayDonationDay,
  BirthdayDonationEntry,
  BirthdayDonationBirthdays,
  BirthdayDonationMonthSummary,
  RecordBirthdayDonationInput,
  RecordBirthdayDonationReminderInput,
} from '../types/birthdayDonations.types';

const DaySchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  donation_date: z.string(),
  birthday_count: z.number(),
  expected_amount: z.number(),
  total_received: z.number(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const DonationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  donation_date: z.string(),
  amount: z.number(),
  payment_method: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  recorded_by: z.string().nullable().optional(),
  payer_student_id: z.string().nullable().optional(),
  birthday_student_id: z.string().nullable().optional(),
  class_id: z.string().nullable().optional(),
  created_at: z.string(),
});

const BirthdaySchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string().nullable().optional(),
  classes: z
    .object({
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const RecordInputSchema = z.object({
  donationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),
  payerStudentId: z.string().uuid().optional(),
  birthdayStudentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  celebrationMode: z.boolean().optional(),
});

const UnrecordInputSchema = z.object({
  donationId: z.string().uuid(),
});

const ReminderInputSchema = z.object({
  donationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthdayStudentId: z.string().uuid(),
  payerStudentId: z.string().uuid().nullable().optional(),
  recipientUserId: z.string().uuid(),
  classId: z.string().uuid().nullable().optional(),
  sentBy: z.string().uuid().nullable().optional(),
});

const mapDay = (row: z.infer<typeof DaySchema>): BirthdayDonationDay => ({
  id: row.id,
  organizationId: row.organization_id,
  donationDate: row.donation_date,
  birthdayCount: row.birthday_count,
  expectedAmount: row.expected_amount,
  totalReceived: row.total_received,
  notes: row.notes ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapDonation = (row: z.infer<typeof DonationSchema>): BirthdayDonationEntry => ({
  id: row.id,
  organizationId: row.organization_id,
  donationDate: row.donation_date,
  amount: row.amount,
  paymentMethod: row.payment_method ?? null,
  note: row.note ?? null,
  recordedBy: row.recorded_by ?? null,
  payerStudentId: row.payer_student_id ?? null,
  birthdayStudentId: row.birthday_student_id ?? null,
  classId: row.class_id ?? null,
  createdAt: row.created_at,
});

const mapBirthday = (row: z.infer<typeof BirthdaySchema>): BirthdayDonationBirthdays => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  className: row.classes?.name ?? null,
  dateOfBirth: row.date_of_birth ?? null,
});

export class BirthdayDonationsService {
  static async getDaySummary(organizationId: string, donationDate: string): Promise<BirthdayDonationDay | null> {
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('birthday_donation_days')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('donation_date', donationDate)
      .maybeSingle();

    if (error || !data) return null;
    const parsed = DaySchema.safeParse(data);
    return parsed.success ? mapDay(parsed.data) : null;
  }

  static async getDonationsForDay(organizationId: string, donationDate: string): Promise<BirthdayDonationEntry[]> {
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('birthday_donations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('donation_date', donationDate)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    const parsed = z.array(DonationSchema).safeParse(data);
    return parsed.success ? parsed.data.map(mapDonation) : [];
  }

  static async getDonationsForBirthday(
    organizationId: string,
    donationDate: string,
    birthdayStudentId: string,
    classId?: string | null
  ): Promise<BirthdayDonationEntry[]> {
    const supabase = assertSupabase();
    let query = supabase
      .from('birthday_donations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('donation_date', donationDate)
      .eq('birthday_student_id', birthdayStudentId)
      .order('created_at', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    const parsed = z.array(DonationSchema).safeParse(data);
    return parsed.success ? parsed.data.map(mapDonation) : [];
  }

  static async getTodayBirthdays(organizationId: string, donationDate: string): Promise<BirthdayDonationBirthdays[]> {
    const supabase = assertSupabase();
    const [, month, day] = donationDate.split('-');
    const monthInt = Number(month);
    const dayInt = Number(day);
    if (!monthInt || !dayInt) return [];

    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, date_of_birth, classes(name)')
      .or(`organization_id.eq.${organizationId},preschool_id.eq.${organizationId}`)
      .eq('is_active', true)
      .not('date_of_birth', 'is', null);

    if (error || !data) return [];

    const parsed = z.array(BirthdaySchema).safeParse(data);
    if (!parsed.success) return [];

    return parsed.data
      .filter((student) => {
        if (!student.date_of_birth) return false;
        const datePart = student.date_of_birth.split('T')[0] || student.date_of_birth;
        const [dobYear, dobMonth, dobDay] = datePart.split('-').map((part) => Number(part));
        if (!dobYear || !dobMonth || !dobDay) return false;
        return dobMonth === monthInt && dobDay === dayInt;
      })
      .map(mapBirthday);
  }

  static async recordDonation(organizationId: string, input: RecordBirthdayDonationInput): Promise<BirthdayDonationDay> {
    const supabase = assertSupabase();
    const parsed = RecordInputSchema.parse(input);
    if (!organizationId) {
      throw new Error('Organization is required');
    }

    const { data, error } = await supabase.functions.invoke('birthday-donations', {
      body: {
        action: 'record',
        donationDate: parsed.donationDate,
        amount: parsed.amount,
        paymentMethod: parsed.paymentMethod,
        note: parsed.note,
        payerStudentId: parsed.payerStudentId,
        birthdayStudentId: parsed.birthdayStudentId,
        classId: parsed.classId,
        celebrationMode: parsed.celebrationMode ?? false,
      },
    });

    if (error || !data?.success || !data?.data) {
      let errorDetails: { error?: string; code?: string; details?: string; hint?: string } | null = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const url = supabaseUrl();
        if (accessToken && url) {
          const response = await fetch(`${url}/functions/v1/birthday-donations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              action: 'record',
              donationDate: parsed.donationDate,
              amount: parsed.amount,
              paymentMethod: parsed.paymentMethod,
              note: parsed.note,
              payerStudentId: parsed.payerStudentId,
              birthdayStudentId: parsed.birthdayStudentId,
              classId: parsed.classId,
              celebrationMode: parsed.celebrationMode ?? false,
            }),
          });
          const json = await response.json().catch(() => null);
          if (json && typeof json === 'object') {
            errorDetails = {
              error: (json as any).error,
              code: (json as any).code,
              details: (json as any).details,
              hint: (json as any).hint,
            };
          }
        }
      } catch {
        // ignore secondary fetch errors
      }

      console.error('[BirthdayDonations] recordDonation failed', {
        error,
        data,
        errorDetails,
        payload: parsed,
        organizationId,
      });
      const detail = errorDetails?.details ? ` (${errorDetails.details})` : '';
      const hint = errorDetails?.hint ? ` ${errorDetails.hint}` : '';
      throw new Error(
        errorDetails?.error ||
        error?.message ||
        data?.error ||
        `Failed to record donation${detail}${hint}`
      );
    }

    const dayParsed = DaySchema.safeParse(data.data);
    if (!dayParsed.success) {
      throw new Error('Invalid response from donation service');
    }

    return mapDay(dayParsed.data);
  }

  static async unrecordDonation(organizationId: string, donationId: string): Promise<BirthdayDonationDay | null> {
    const supabase = assertSupabase();
    const parsed = UnrecordInputSchema.parse({ donationId });
    if (!organizationId) {
      throw new Error('Organization is required');
    }

    const { data, error } = await supabase.functions.invoke('birthday-donations', {
      body: {
        action: 'unrecord',
        donationId: parsed.donationId,
      },
    });

    if (error || !data?.success) {
      const detail = data?.error ? ` (${data.error})` : '';
      throw new Error(error?.message || `Failed to remove donation${detail}`);
    }

    if (!data?.data) return null;
    const dayParsed = DaySchema.safeParse(data.data);
    if (!dayParsed.success) {
      throw new Error('Invalid response from donation service');
    }

    return mapDay(dayParsed.data);
  }

  static async recordDonationReminders(
    organizationId: string,
    reminders: RecordBirthdayDonationReminderInput[]
  ): Promise<void> {
    if (!organizationId || reminders.length === 0) return;
    const supabase = assertSupabase();
    const parsed = z.array(ReminderInputSchema).parse(reminders);
    const rows = parsed.map((reminder) => ({
      organization_id: organizationId,
      donation_date: reminder.donationDate,
      birthday_student_id: reminder.birthdayStudentId,
      payer_student_id: reminder.payerStudentId ?? null,
      recipient_user_id: reminder.recipientUserId,
      class_id: reminder.classId ?? null,
      sent_by: reminder.sentBy ?? null,
    }));

    const { error } = await supabase
      .from('birthday_donation_reminders')
      .insert(rows);
    if (error) {
      throw new Error(error.message);
    }
  }

  static async getMonthSummary(organizationId: string, monthStart: string, monthEnd: string): Promise<BirthdayDonationMonthSummary> {
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('birthday_donation_days')
      .select('expected_amount, total_received')
      .eq('organization_id', organizationId)
      .gte('donation_date', monthStart)
      .lt('donation_date', monthEnd);

    if (error || !data) {
      return { totalExpected: 0, totalReceived: 0, daysWithBirthdays: 0 };
    }

    const rows = z.array(
      z.object({
        expected_amount: z.number(),
        total_received: z.number(),
      })
    ).safeParse(data);

    if (!rows.success) {
      return { totalExpected: 0, totalReceived: 0, daysWithBirthdays: 0 };
    }

    const totalExpected = rows.data.reduce((sum, row) => sum + row.expected_amount, 0);
    const totalReceived = rows.data.reduce((sum, row) => sum + row.total_received, 0);
    return { totalExpected, totalReceived, daysWithBirthdays: rows.data.length };
  }
}

function supabaseUrl(): string | null {
  try {
    const Constants = require('expo-constants');
    const extra = Constants?.expoConfig?.extra || {};
    return extra.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || null;
  } catch {
    return process.env.EXPO_PUBLIC_SUPABASE_URL || null;
  }
}
