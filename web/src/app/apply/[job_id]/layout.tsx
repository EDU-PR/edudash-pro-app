import type { Metadata } from 'next';
import { buildJobApplyMetadata } from '@/lib/metadata/jobPosting';

export async function generateMetadata({
  params,
}: {
  params: { job_id: string };
}): Promise<Metadata> {
  return buildJobApplyMetadata(params.job_id);
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
