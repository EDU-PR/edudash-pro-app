'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface TeacherClassCodeRow {
  id: string;
  code: string;
  active: boolean;
  created_at: string;
}

const STAFF_ROLES = ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateCode = (length: number = 8): string => {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * CODE_ALPHABET.length);
    output += CODE_ALPHABET[randomIndex];
  }
  return output;
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function TeacherClassCodesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [codes, setCodes] = useState<TeacherClassCodeRow[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [creatingCode, setCreatingCode] = useState(false);
  const [updatingCodeId, setUpdatingCodeId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/sign-in');
        return;
      }

      setUserId(user.id);
      setAuthLoading(false);
    };

    void initAuth();
  }, [router, supabase]);

  const role = String(profile?.role || '').toLowerCase();
  const canManageCodes = STAFF_ROLES.includes(role);
  const organizationId = profile?.organizationId || profile?.preschoolId || null;

  const loadCodes = useCallback(async () => {
    if (!userId) {
      setCodes([]);
      setLoadingCodes(false);
      return;
    }

    setLoadingCodes(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('teacher_class_codes')
        .select('id, code, active, created_at')
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes((data || []) as TeacherClassCodeRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load class codes.';
      setErrorMessage(message);
      setCodes([]);
    } finally {
      setLoadingCodes(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  const createNewCode = async () => {
    if (!userId) return;
    if (!canManageCodes) {
      setErrorMessage('Your role cannot manage class codes.');
      return;
    }

    setCreatingCode(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const nextCode = generateCode();

      const { error: disableError } = await supabase
        .from('teacher_class_codes')
        .update({ active: false })
        .eq('teacher_id', userId)
        .eq('active', true);
      if (disableError) throw disableError;

      const { error: insertError } = await supabase
        .from('teacher_class_codes')
        .insert({
          teacher_id: userId,
          preschool_id: organizationId,
          code: nextCode,
          active: true,
        });
      if (insertError) throw insertError;

      setSuccessMessage(`New class code created: ${nextCode}`);
      await loadCodes();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create class code.';
      setErrorMessage(message);
    } finally {
      setCreatingCode(false);
    }
  };

  const setCodeActiveState = async (row: TeacherClassCodeRow, nextActive: boolean) => {
    if (!userId) return;
    if (!canManageCodes) {
      setErrorMessage('Your role cannot manage class codes.');
      return;
    }

    setUpdatingCodeId(row.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (nextActive) {
        const { error: disableError } = await supabase
          .from('teacher_class_codes')
          .update({ active: false })
          .eq('teacher_id', userId)
          .eq('active', true);
        if (disableError) throw disableError;
      }

      const { error } = await supabase
        .from('teacher_class_codes')
        .update({ active: nextActive })
        .eq('id', row.id)
        .eq('teacher_id', userId);
      if (error) throw error;

      setSuccessMessage(`Code ${row.code} is now ${nextActive ? 'active' : 'inactive'}.`);
      await loadCodes();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update class code.';
      setErrorMessage(message);
    } finally {
      setUpdatingCodeId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setSuccessMessage(`Copied ${code} to clipboard.`);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Could not copy code. Please copy manually.');
    }
  };

  const activeCode = codes.find((code) => code.active);
  const loading = authLoading || profileLoading || loadingCodes;
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!canManageCodes) {
    return (
      <TeacherShell
        tenantSlug={tenantSlug}
        userEmail={profile?.email}
        userName={profile?.firstName}
        preschoolName={profile?.preschoolName}
        hideHeader={true}
      >
        <div className="container">
          <div className="section">
            <div className="card p-md border border-amber-500/40 bg-amber-950/20 text-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <h1 className="text-lg font-semibold">Access Restricted</h1>
                  <p className="text-sm mt-1">
                    Only teachers and school admins can view or manage teacher class codes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      hideHeader={true}
    >
      <div className="container">
        <div className="section">
          <div className="card p-md border border-indigo-500/35 bg-gradient-to-r from-indigo-900/25 to-slate-900/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Teacher Class Codes</h1>
                <p className="text-sm text-gray-300 mt-1">
                  Generate and manage the invitation code families use to connect with your classroom.
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-indigo-200" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={createNewCode}
                disabled={creatingCode}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-400 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2"
              >
                {creatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate New Active Code
              </button>
              <button
                onClick={() => void loadCodes()}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold text-gray-100 border border-gray-700 inline-flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => router.push('/dashboard/teacher')}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold text-gray-100 border border-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        <div className="section">
          {errorMessage ? (
            <div className="card p-md border border-red-500/40 bg-red-950/20 text-red-200 mb-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="card p-md border border-emerald-500/40 bg-emerald-950/20 text-emerald-200 mb-3 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <div className="card p-md mb-3 border border-indigo-500/30 bg-indigo-950/20">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-indigo-200" />
              <h2 className="text-sm font-semibold text-indigo-100">Current Active Code</h2>
            </div>
            {activeCode ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="px-3 py-1 rounded-md bg-gray-950 border border-gray-700 text-indigo-100 text-lg tracking-wider">
                  {activeCode.code}
                </code>
                <button
                  onClick={() => void copyCode(activeCode.code)}
                  className="px-3 py-1 rounded-md bg-gray-900 hover:bg-gray-800 text-xs text-gray-100 border border-gray-700 inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-300">No active code yet. Generate one to start inviting families.</p>
            )}
          </div>

          <div className="card p-md">
            <h2 className="text-lg font-semibold text-white mb-3">Code History</h2>
            {codes.length === 0 ? (
              <p className="text-sm text-gray-400">No class codes found for this teacher yet.</p>
            ) : (
              <div className="space-y-2">
                {codes.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-base text-white tracking-wide">{row.code}</code>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            row.active
                              ? 'border-emerald-500/50 bg-emerald-900/30 text-emerald-200'
                              : 'border-gray-600 bg-gray-800 text-gray-300'
                          }`}
                        >
                          {row.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Created {formatTimestamp(row.created_at)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void copyCode(row.code)}
                        className="px-3 py-1.5 rounded-md bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs text-gray-100 inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                      <button
                        onClick={() => void setCodeActiveState(row, !row.active)}
                        disabled={updatingCodeId === row.id}
                        className="px-3 py-1.5 rounded-md bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-600/40 text-xs text-indigo-100 inline-flex items-center gap-1 disabled:opacity-60"
                      >
                        {updatingCodeId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {row.active ? 'Deactivate' : 'Make Active'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
