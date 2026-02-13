import { AnnouncementsCard } from './AnnouncementsCard';
import { ScheduleCard } from './ScheduleCard';
import { AssignmentsCard } from './AssignmentsCard';
import { GradesCard } from './GradesCard';
import { FixturesCard } from './FixturesCard';
import { CertificationsCard } from './CertificationsCard';

export { DashboardCard } from './DashboardCard';
export { AnnouncementsCard, ScheduleCard, AssignmentsCard, GradesCard, FixturesCard, CertificationsCard };

// Widget key to component mapping
export const WIDGET_COMPONENTS = {
  announcements: AnnouncementsCard,
  schedule: ScheduleCard,
  assignments: AssignmentsCard,
  grades: GradesCard,
  fixtures: FixturesCard,
  certifications: CertificationsCard,
  // TODO: Add remaining widgets as they're implemented
  // chat: ChatCard,
  // attendance: AttendanceCard,
  // progress_report: ProgressReportCard,
  // training_modules: TrainingModulesCard,
  // performance_metrics: PerformanceMetricsCard,
} as const;

export type WidgetKey = keyof typeof WIDGET_COMPONENTS;
