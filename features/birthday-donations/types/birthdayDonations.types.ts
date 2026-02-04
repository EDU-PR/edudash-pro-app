export interface BirthdayDonationDay {
  id: string;
  organizationId: string;
  donationDate: string;
  birthdayCount: number;
  expectedAmount: number;
  totalReceived: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BirthdayDonationEntry {
  id: string;
  organizationId: string;
  donationDate: string;
  amount: number;
  paymentMethod?: string | null;
  note?: string | null;
  recordedBy?: string | null;
  payerStudentId?: string | null;
  birthdayStudentId?: string | null;
  classId?: string | null;
  createdAt: string;
}

export interface BirthdayDonationBirthdays {
  id: string;
  firstName: string;
  lastName: string;
  className?: string | null;
  dateOfBirth?: string | null;
}

export interface RecordBirthdayDonationInput {
  donationDate: string;
  amount: number;
  paymentMethod?: string;
  note?: string;
  payerStudentId?: string;
  birthdayStudentId?: string;
  classId?: string;
  celebrationMode?: boolean;
}

export interface BirthdayDonationMonthSummary {
  totalExpected: number;
  totalReceived: number;
  daysWithBirthdays: number;
}

export interface RecordBirthdayDonationReminderInput {
  donationDate: string;
  birthdayStudentId: string;
  payerStudentId?: string | null;
  recipientUserId: string;
  classId?: string | null;
  sentBy?: string | null;
}
