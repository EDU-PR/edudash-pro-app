import { useState, useCallback, useEffect } from 'react';

import { assertSupabase } from '@/lib/supabase';

/**
 * Family Credits Hook
 *
 * Fetches available family credits for a parent+preschool and exposes
 * an `applyCredit()` method that calls the `apply_family_credit` RPC.
 *
 * Usage:
 * ```tsx
 * const { credits, totalAvailable, applyCredit, loading, refetch } = useFamilyCredits({
 *   parentId: profile.id,
 *   preschoolId: school.id,
 * });
 * ```
 */

export interface FamilyCredit {
  id: string;
  parent_id: string;
  student_id: string | null;
  preschool_id: string;
  category_code: string;
  amount: number;
  remaining_amount: number;
  origin_payment_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApplyCreditResult {
  success: boolean;
  applied_amount?: number;
  credit_remaining?: number;
  credit_status?: string;
  fee_paid?: number;
  fee_outstanding?: number;
  fee_status?: string;
  error?: string;
}

interface UseFamilyCreditsOptions {
  parentId: string | null | undefined;
  preschoolId: string | null | undefined;
  /** If true, fetches on mount. Defaults to true. */
  autoFetch?: boolean;
}

interface UseFamilyCreditsReturn {
  credits: FamilyCredit[];
  totalAvailable: number;
  loading: boolean;
  error: string | null;
  applyCredit: (
    creditId: string,
    studentFeeId: string,
    amount: number,
    notes?: string,
  ) => Promise<ApplyCreditResult>;
  refetch: () => Promise<void>;
}

export function useFamilyCredits({
  parentId,
  preschoolId,
  autoFetch = true,
}: UseFamilyCreditsOptions): UseFamilyCreditsReturn {
  const [credits, setCredits] = useState<FamilyCredit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!parentId || !preschoolId) {
      setCredits([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = assertSupabase();
      const { data, error: fetchErr } = await supabase
        .from('family_credits')
        .select('*')
        .eq('parent_id', parentId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'available')
        .gt('remaining_amount', 0)
        .order('created_at', { ascending: true });

      if (fetchErr) {
        setError(fetchErr.message);
        setCredits([]);
      } else {
        setCredits((data as FamilyCredit[]) || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCredits([]);
    } finally {
      setLoading(false);
    }
  }, [parentId, preschoolId]);

  useEffect(() => {
    if (autoFetch) {
      fetchCredits();
    }
  }, [autoFetch, fetchCredits]);

  const totalAvailable = credits.reduce((sum, c) => sum + (c.remaining_amount || 0), 0);

  const applyCredit = useCallback(
    async (
      creditId: string,
      studentFeeId: string,
      amount: number,
      notes?: string,
    ): Promise<ApplyCreditResult> => {
      try {
        const supabase = assertSupabase();

        const { data, error: rpcErr } = await supabase.rpc('apply_family_credit', {
          p_credit_id: creditId,
          p_student_fee_id: studentFeeId,
          p_amount: amount,
          p_notes: notes || null,
        });

        if (rpcErr) {
          return { success: false, error: rpcErr.message };
        }

        const result = data as Record<string, unknown>;

        if (!result?.success) {
          return { success: false, error: (result?.error as string) || 'Unknown error' };
        }

        // Refetch credits after successful application
        await fetchCredits();

        return {
          success: true,
          applied_amount: result.applied_amount as number,
          credit_remaining: result.credit_remaining as number,
          credit_status: result.credit_status as string,
          fee_paid: result.fee_paid as number,
          fee_outstanding: result.fee_outstanding as number,
          fee_status: result.fee_status as string,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [fetchCredits],
  );

  return {
    credits,
    totalAvailable,
    loading,
    error,
    applyCredit,
    refetch: fetchCredits,
  };
}
