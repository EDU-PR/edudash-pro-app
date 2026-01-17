// Types for Seat Management

export interface Teacher {
  id: string;
  email: string;
  hasSeat: boolean;
}

export interface SeatInfo {
  used: number;
  total: number;
}

export interface SeatManagementState {
  effectiveSchoolId: string | null;
  subscriptionId: string | null;
  subscriptionLoaded: boolean;
  schoolLabel: string | null;
  teachers: Teacher[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  success: string | null;
  assigning: boolean;
  revoking: boolean;
  pendingTeacherId: string | null;
  canManageAI: boolean;
}

export interface SeatManagementActions {
  onRefresh: () => Promise<void>;
  onAssign: (email: string) => Promise<void>;
  onRevoke: (email: string) => Promise<void>;
  onAssignTeacher: (teacherId: string, email: string) => Promise<void>;
  onRevokeTeacher: (teacherId: string, email: string) => Promise<void>;
  onAssignAllTeachers: () => Promise<void>;
  onStartFreeTrial: () => Promise<void>;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}
