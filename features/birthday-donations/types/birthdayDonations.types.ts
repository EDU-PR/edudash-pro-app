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
}

export interface BirthdayDonationMonthSummary {
  totalExpected: number;
  totalReceived: number;
  daysWithBirthdays: number;
}
