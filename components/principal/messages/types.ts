// Types for Principal Messages

export type RecipientType = 'all_parents' | 'all_teachers' | 'all_staff' | 'class';

export interface RecipientOption {
  id: RecipientType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface MessageHistory {
  id: string;
  subject: string;
  message: string;
  recipient_type: string;
  class_id: string | null;
  class_name?: string;
  sent_at: string;
  sent_count?: number;
}

export interface RecipientCounts {
  parents: number;
  teachers: number;
  staff: number;
}

export interface MessageFormData {
  recipientType: RecipientType;
  selectedClass: string | null;
  subject: string;
  message: string;
}

export const RECIPIENT_OPTIONS: RecipientOption[] = [
  { 
    id: 'all_parents', 
    label: 'All Parents', 
    icon: 'people', 
    color: '#10B981',
    description: 'Send to all parents in your school'
  },
  { 
    id: 'all_teachers', 
    label: 'All Teachers', 
    icon: 'school', 
    color: '#3B82F6',
    description: 'Send to all teachers in your school'
  },
  { 
    id: 'all_staff', 
    label: 'All Staff', 
    icon: 'briefcase', 
    color: '#8B5CF6',
    description: 'Send to teachers, admins, and staff'
  },
  { 
    id: 'class', 
    label: 'Specific Class', 
    icon: 'layers', 
    color: '#F59E0B',
    description: 'Send to parents of a specific class'
  },
];

export const getRecipientCount = (
  recipientType: RecipientType,
  counts: RecipientCounts,
  selectedClass: string | null
): number => {
  switch (recipientType) {
    case 'all_parents':
      return counts.parents;
    case 'all_teachers':
      return counts.teachers;
    case 'all_staff':
      return counts.staff;
    case 'class':
      return selectedClass ? counts.parents : 0;
    default:
      return 0;
  }
};
