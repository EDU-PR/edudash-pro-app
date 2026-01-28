import { z } from 'zod';
import { assertSupabase } from '@/lib/supabase';
import type {
  BirthdayDonationDay,
  BirthdayDonationEntry,
  BirthdayDonationBirthdays,
  BirthdayDonationMonthSummary,
  RecordBirthdayDonationInput,
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

  static async getTodayBirthdays(organizationId: string, donationDate: string): Promise<BirthdayDonationBirthdays[]> {
    const supabase = assertSupabase();
    const [year, month, day] = donationDate.split('-');
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
        const date = new Date(student.date_of_birth);
        return date.getMonth() + 1 === monthInt && date.getDate() === dayInt;
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
      },
    });

    if (error || !data?.success || !data?.data) {
      throw new Error(error?.message || data?.error || 'Failed to record donation');
    }

    const dayParsed = DaySchema.safeParse(data.data);
    if (!dayParsed.success) {
      throw new Error('Invalid response from donation service');
    }

    return mapDay(dayParsed.data);
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
