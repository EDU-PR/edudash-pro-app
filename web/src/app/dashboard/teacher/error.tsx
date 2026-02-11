'use client';

import DashboardError from '../error';

export default function TeacherDashboardError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError {...props} />;
}
