import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildJobApplyMetadata } from '@/lib/metadata/jobPosting';

type SearchParams = { [key: string]: string | string[] | undefined };

const getParam = (value?: string | string[]) => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
};

export async function generateMetadata({
  params,
}: {
  params: { job_id: string };
}): Promise<Metadata> {
  return buildJobApplyMetadata(params.job_id);
}

export default function JobApplyRedirect({
  params,
  searchParams,
}: {
  params: { job_id: string };
  searchParams: SearchParams;
}) {
  const jobId = params.job_id;
  const query = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    const v = getParam(value);
    if (v) query.set(key, v);
  });

  redirect(`/apply/${jobId}${query.toString() ? `?${query.toString()}` : ''}`);
}
