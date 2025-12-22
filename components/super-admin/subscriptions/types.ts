/**
 * Types for Super Admin Subscriptions
 * Extracted from app/screens/super-admin-subscriptions.tsx
 */

export interface School {
  id: string;
  name: string;
  tenant_slug: string | null;
  subscription_tier: string | null;
  email: string | null;
}

export interface Subscription {
  id: string;
  school_id: string;
  plan_id: string;
  status: string;
  seats_total: number;
  seats_used: number;
  billing_frequency: string;
  start_date: string;
  end_date: string;
  created_at: string;
  metadata?: Record<string, any>;
  school?: School;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual?: number;
  max_teachers: number;
  max_students: number;
}

export interface CreateSubscriptionForm {
  school_id: string;
  plan_tier: string;
  plan_id: string;
  billing_frequency: string;
  seats_total: string;
}

export type SubscriptionFilter = 'all' | 'active' | 'pending_payment' | 'cancelled' | 'expired';

export interface SubscriptionState {
  loading: boolean;
  refreshing: boolean;
  subscriptions: Subscription[];
  schools: School[];
  plans: SubscriptionPlan[];
  filter: SubscriptionFilter | string;
  showCreateModal: boolean;
  creating: boolean;
  createForm: CreateSubscriptionForm;
  showPlanChangeModal: boolean;
  selectedSubscriptionForChange: Subscription | null;
  selectedSchoolForChange: School | null;
}

export interface SubscriptionActions {
  fetchData: () => Promise<void>;
  onRefresh: () => Promise<void>;
  updateSubscriptionStatus: (id: string, status: 'active' | 'cancelled' | 'expired') => Promise<void>;
  createSubscription: () => Promise<void>;
  deleteSubscription: (id: string, schoolName: string) => void;
  handleManualActivation: (subscription: Subscription) => void;
  openPlanChangeModal: (subscription: Subscription) => void;
  closePlanChangeModal: () => void;
  setFilter: (filter: string) => void;
  setShowCreateModal: (show: boolean) => void;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateSubscriptionForm>>;
}

export interface UseSubscriptionsResult extends SubscriptionState, SubscriptionActions {
  availableSchools: School[];
  handlePlanChangeSuccess: () => Promise<void>;
}
