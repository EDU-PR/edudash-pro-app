// Types for Principal Excursions

export interface Excursion {
  id: string;
  title: string;
  description: string;
  destination: string;
  excursion_date: string;
  departure_time?: string;
  return_time?: string;
  estimated_cost_per_child: number;
  learning_objectives: string[];
  items_to_bring: string[];
  consent_required: boolean;
  consent_deadline?: string;
  status: ExcursionStatus;
  created_at: string;
}

export type ExcursionStatus = 'draft' | 'pending_approval' | 'approved' | 'cancelled' | 'completed';

export interface ExcursionFormData {
  title: string;
  description: string;
  destination: string;
  excursion_date: Date;
  estimated_cost_per_child: string;
  learning_objectives: string;
  items_to_bring: string;
  consent_required: boolean;
}

export const STATUS_COLORS: Record<ExcursionStatus, string> = {
  draft: '#6b7280',
  pending_approval: '#f59e0b',
  approved: '#10b981',
  cancelled: '#ef4444',
  completed: '#3b82f6',
};

export const STATUS_LABELS: Record<ExcursionStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const getInitialExcursionFormData = (): ExcursionFormData => ({
  title: '',
  description: '',
  destination: '',
  excursion_date: new Date(),
  estimated_cost_per_child: '0',
  learning_objectives: '',
  items_to_bring: '',
  consent_required: true,
});

export const excursionToFormData = (excursion: Excursion): ExcursionFormData => ({
  title: excursion.title,
  description: excursion.description || '',
  destination: excursion.destination,
  excursion_date: new Date(excursion.excursion_date),
  estimated_cost_per_child: String(excursion.estimated_cost_per_child || 0),
  learning_objectives: excursion.learning_objectives?.join(', ') || '',
  items_to_bring: excursion.items_to_bring?.join(', ') || '',
  consent_required: excursion.consent_required,
});
