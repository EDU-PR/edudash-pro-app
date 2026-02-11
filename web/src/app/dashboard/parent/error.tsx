'use client';

import DashboardError from '../error';

export default function ParentDashboardError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError {...props} />;
}
