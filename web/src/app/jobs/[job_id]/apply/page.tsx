import { redirect } from 'next/navigation';

type SearchParams = { [key: string]: string | string[] | undefined };

const getParam = (value?: string | string[]) => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
};

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
