import { redirect } from 'next/navigation';

type SearchParams = { [key: string]: string | string[] | undefined };

const getParam = (value?: string | string[]) => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
};

export default function TeacherSignupRedirect({ searchParams }: { searchParams: SearchParams }) {
  const inviteCode = getParam(searchParams.inviteCode) || getParam(searchParams.invite);
  const email = getParam(searchParams.email);

  const query = new URLSearchParams();
  if (inviteCode) query.set('invite', inviteCode);
  if (email) query.set('email', email);

  redirect(`/sign-up/teacher${query.toString() ? `?${query.toString()}` : ''}`);
}
