/**
 * Types, interfaces, and utility functions for students-detail screen.
 * Extracted to keep screen under 500 non-SS lines.
 */

import type { AlertButton } from '@/components/ui/AlertModal';

export interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  grade: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalConditions?: string;
  allergies?: string;
  enrollmentDate: string;
  status: 'active' | 'inactive' | 'pending';
  profilePhoto?: string;
  attendanceRate: number;
  lastAttendance: string;
  assignedTeacher?: string;
  fees: {
    outstanding: number;
    lastPayment: string;
    paymentStatus: 'current' | 'overdue' | 'pending';
  };
  schoolId: string;
  classId?: string;
}

export interface FilterOptions {
  grade: string[];
  status: string[];
  teacher: string[];
  paymentStatus: string[];
  search: string;
}

export interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  buttons: AlertButton[];
}

export const DEFAULT_FILTERS: FilterOptions = {
  grade: [],
  status: ['active'],
  teacher: [],
  paymentStatus: [],
  search: '',
};

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#059669';
    case 'inactive': return '#DC2626';
    case 'pending': return '#EA580C';
    default: return '#6B7280';
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'current': return '#059669';
    case 'overdue': return '#DC2626';
    case 'pending': return '#EA580C';
    default: return '#6B7280';
  }
}
