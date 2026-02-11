export interface CandidateProfileRow {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  is_public: boolean;
  location: string | null;
  location_city: string | null;
  location_province: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_source: 'gps' | 'manual' | null;
  preferred_radius_km: number | null;
  location_updated_at: string | null;
  preferred_location_lat: number | null;
  preferred_location_lng: number | null;
  willing_to_commute_km: number | null;
}

export interface RatingSummaryRow {
  candidate_profile_id: string | null;
  teacher_user_id: string | null;
  rating_count: number | null;
  avg_rating: number | null;
  avg_communication: number | null;
  avg_classroom: number | null;
  avg_planning: number | null;
  avg_professionalism: number | null;
  avg_parent_engagement: number | null;
  avg_reliability: number | null;
  last_rating_at: string | null;
}

export interface TeacherReferenceRow {
  id: string;
  candidate_profile_id: string;
  teacher_user_id: string | null;
  organization_id: string;
  principal_id: string;
  rating_overall: number;
  rating_communication: number | null;
  rating_classroom: number | null;
  rating_planning: number | null;
  rating_professionalism: number | null;
  rating_parent_engagement: number | null;
  rating_reliability: number | null;
  title: string | null;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface ReferenceViewModel extends TeacherReferenceRow {
  school_name: string;
  principal_name: string | null;
}

export interface ProfileBasicsRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export const STAFF_ROLES = ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

export const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const starRows = (rating: number | null): boolean[] => {
  const rounded = rating ? Math.round(rating) : 0;
  return Array.from({ length: 5 }).map((_, idx) => idx < rounded);
};

export const formatReferenceDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-ZA');
};

export const getInsights = (summary: RatingSummaryRow | null): string => {
  if (!summary || (summary.rating_count || 0) < 2) {
    return 'Collect more references to unlock detailed insights.';
  }

  const categories = [
    { key: 'Communication', value: summary.avg_communication },
    { key: 'Classroom Management', value: summary.avg_classroom },
    { key: 'Planning', value: summary.avg_planning },
    { key: 'Professionalism', value: summary.avg_professionalism },
    { key: 'Parent Engagement', value: summary.avg_parent_engagement },
    { key: 'Reliability', value: summary.avg_reliability },
  ].filter((item): item is { key: string; value: number } => typeof item.value === 'number');

  if (categories.length === 0) {
    return 'Add more detailed ratings to see improvement tips.';
  }

  const lowest = categories.reduce((acc, curr) => (curr.value < acc.value ? curr : acc));
  const tips: Record<string, string> = {
    Communication: 'Share weekly updates and set clear expectations with families.',
    'Classroom Management': 'Adopt consistent routines and reinforce positive behavior.',
    Planning: 'Prepare lesson outlines one week ahead and align objectives.',
    Professionalism: 'Document parent interactions and follow up promptly.',
    'Parent Engagement': 'Offer quick check-ins and invite parent participation.',
    Reliability: 'Communicate early about schedule changes and keep routines consistent.',
  };

  return `Focus area: ${lowest.key}. Tip: ${tips[lowest.key] || 'Keep improving with structured feedback.'}`;
};
