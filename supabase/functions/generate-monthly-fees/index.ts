import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

/**
 * generate-monthly-fees Edge Function
 *
 * Called by pg_cron on the 1st of each month at 00:05 UTC.
 * For every active preschool, generates student_fees rows for all active
 * students who don't yet have a fee for the current billing month.
 *
 * Auth: CRON_SECRET or service_role JWT.
 *
 * Also auto-applies any available family credits after fee generation.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const CRON_SECRET = Deno.env.get('CRON_SECRET');
if (!CRON_SECRET) throw new Error('CRON_SECRET env var is required');
const FINANCE_MONTH_CUTOFF_DAY = parseInt(Deno.env.get('FINANCE_MONTH_CUTOFF_DAY') || '25', 10);

// ── Age matching (port of lib/utils/feeStructureSelector.ts) ──────────────

interface FeeCandidate {
  id: string;
  amount: number;
  name?: string | null;
  description?: string | null;
  fee_type?: string | null;
  grade_levels?: string[] | null;
  age_group?: string | null;
  grade_level?: string | null;
  effective_from?: string | null;
  created_at?: string | null;
}

interface StudentRow {
  id: string;
  date_of_birth?: string | null;
  enrollment_date?: string | null;
  class_name?: string | null;
  grade_level?: string | null;
  preschool_id: string;
}

type TuitionResolutionStatus = 'matched' | 'ambiguous' | 'unmatched';

interface TuitionResolution<T extends FeeCandidate = FeeCandidate> {
  status: TuitionResolutionStatus;
  fee?: T;
  reason: string;
  matches?: T[];
}

function computeAgeMonths(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return months < 0 ? null : months;
}

const rangePattern =
  /(\d+(?:\.\d+)?)\s*(m|mo|mos|month|months|yr|yrs|year|years)?\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(m|mo|mos|month|months|yr|yrs|year|years)?/i;

function normalizeUnit(val?: string | null): 'months' | 'years' | null {
  if (!val) return null;
  const u = val.toLowerCase();
  if (u.startsWith('m')) return 'months';
  if (u.startsWith('yr') || u.startsWith('yea')) return 'years';
  return null;
}

function toMonths(v: number, u: 'months' | 'years'): number {
  return u === 'months' ? v : v * 12;
}

function detectLabelUnit(text: string): 'months' | 'years' | null {
  const n = text.toLowerCase();
  if (/\bmonth|months|\bmo\b|\bmos\b/.test(n)) return 'months';
  if (/\byear|years|\byr\b|\byrs\b/.test(n)) return 'years';
  return null;
}

interface AgeRange { minMonths?: number; maxMonths?: number }

function parseAgeRange(text: string): AgeRange | null {
  const normalized = text.toLowerCase();
  const m = normalized.match(rangePattern);
  const labelUnit = detectLabelUnit(normalized);
  if (m) {
    const sv = Number(m[1]);
    const ev = Number(m[3]);
    if (!isNaN(sv) && !isNaN(ev)) {
      const su = normalizeUnit(m[2]) || normalizeUnit(m[4]) || labelUnit || 'years';
      const eu = normalizeUnit(m[4]) || normalizeUnit(m[2]) || labelUnit || 'years';
      const min = toMonths(Math.min(sv, ev), su);
      const max = toMonths(Math.max(sv, ev), eu);
      return { minMonths: Math.min(min, max), maxMonths: Math.max(min, max) };
    }
  }
  const nums = (normalized.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return null;
  if (nums.length >= 2) {
    const unit = labelUnit || 'years';
    return { minMonths: toMonths(Math.min(...nums), unit), maxMonths: toMonths(Math.max(...nums), unit) };
  }
  const v = nums[0];
  if (isNaN(v)) return null;
  const unit = labelUnit || 'years';
  const mv = toMonths(v, unit);
  if (/(plus|\+|and up|or more|above)/.test(normalized)) return { minMonths: mv };
  if (/(under|below|less than|<)/.test(normalized)) return { maxMonths: mv };
  return { minMonths: mv, maxMonths: mv };
}

function isAgeInRange(age: number, r: AgeRange): boolean {
  if (r.minMonths != null && age < r.minMonths) return false;
  if (r.maxMonths != null && age > r.maxMonths) return false;
  return true;
}

function buildLabels(fee: FeeCandidate): string[] {
  return [fee.name, fee.description, fee.age_group, fee.grade_level, ...(fee.grade_levels ?? [])]
    .filter((v): v is string => Boolean(v?.trim()));
}

function normalizeLabel(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return normalized || null;
}

function compareByRecency(a: FeeCandidate, b: FeeCandidate): number {
  const ae = a.effective_from ? new Date(a.effective_from).getTime() : 0;
  const be = b.effective_from ? new Date(b.effective_from).getTime() : 0;
  if (ae !== be) return be - ae;
  const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bc - ac;
}

function selectFee(structures: FeeCandidate[], student: StudentRow): TuitionResolution<FeeCandidate> {
  if (!structures.length) {
    return { status: 'unmatched', reason: 'no_active_tuition_structures' };
  }
  if (structures.length === 1) {
    return {
      status: 'matched',
      fee: structures[0],
      reason: 'single_active_tuition_structure',
      matches: [structures[0]],
    };
  }

  const normalizedGrade = normalizeLabel(student.grade_level);
  if (normalizedGrade) {
    const gradeMatches = structures.filter((fee) => {
      const levels = [
        normalizeLabel(fee.grade_level),
        ...((fee.grade_levels || []).map((level) => normalizeLabel(level))),
      ].filter((label): label is string => Boolean(label));
      return levels.includes(normalizedGrade);
    });
    if (gradeMatches.length === 1) {
      return {
        status: 'matched',
        fee: gradeMatches[0],
        reason: 'grade_level_exact',
        matches: gradeMatches,
      };
    }
    if (gradeMatches.length > 1) {
      return {
        status: 'ambiguous',
        reason: `multiple_grade_level_matches:${gradeMatches.length}`,
        matches: [...gradeMatches].sort(compareByRecency),
      };
    }
  }

  const normalizedClass = normalizeLabel(student.class_name);
  if (normalizedClass) {
    const classMatches = structures.filter((fee) => {
      const labels = buildLabels(fee)
        .map((label) => normalizeLabel(label))
        .filter((label): label is string => Boolean(label));
      return labels.includes(normalizedClass);
    });
    if (classMatches.length === 1) {
      return {
        status: 'matched',
        fee: classMatches[0],
        reason: 'class_label_exact',
        matches: classMatches,
      };
    }
    if (classMatches.length > 1) {
      return {
        status: 'ambiguous',
        reason: `multiple_class_label_matches:${classMatches.length}`,
        matches: [...classMatches].sort(compareByRecency),
      };
    }
  }

  const ageMonths = computeAgeMonths(student.date_of_birth);
  if (ageMonths != null) {
    const ageMatches = structures.filter((fee) => {
      const ranges = buildLabels(fee)
        .map(parseAgeRange)
        .filter((range): range is AgeRange => range !== null);
      return ranges.some((range) => isAgeInRange(ageMonths, range));
    });
    if (ageMatches.length === 1) {
      return {
        status: 'matched',
        fee: ageMatches[0],
        reason: 'age_range_match',
        matches: ageMatches,
      };
    }
    if (ageMatches.length > 1) {
      return {
        status: 'ambiguous',
        reason: `multiple_age_range_matches:${ageMatches.length}`,
        matches: [...ageMatches].sort(compareByRecency),
      };
    }
  }

  if (ageMonths == null && !normalizedClass && !normalizedGrade) {
    return {
      status: 'unmatched',
      reason: 'insufficient_context_missing_grade_class_and_age',
    };
  }

  return {
    status: 'unmatched',
    reason: 'no_deterministic_match',
  };
}

function normalizeStudentRow(row: any): StudentRow {
  const classRecord = Array.isArray(row.classes) ? row.classes[0] : row.classes;
  return {
    id: row.id,
    date_of_birth: row.date_of_birth || null,
    enrollment_date: row.enrollment_date || null,
    class_name: row.class_name || classRecord?.name || null,
    grade_level: row.grade_level || classRecord?.grade_level || null,
    preschool_id: row.preschool_id,
  };
}

function isTuitionFee(feeType?: string | null, name?: string | null, desc?: string | null): boolean {
  const t = (feeType || '').toLowerCase();
  const combined = ((name || '') + ' ' + (desc || '')).toLowerCase();
  return (
    ['tuition', 'school_fees', 'school_fee', 'monthly', 'monthly_fee'].includes(t) ||
    /tuition|school\s*fee|monthly\s*fee/.test(combined)
  );
}

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    const isCronJob = CRON_SECRET && token === CRON_SECRET;

    let isValidServiceRole = false;
    if (token && !isServiceRole && !isCronJob) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        isValidServiceRole = payload.role === 'service_role';
      } catch { /* ignore */ }
    }

    if (!isCronJob && !isServiceRole && !isValidServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional body for target_month override
    let targetMonth: Date;
    try {
      const body = await req.json().catch(() => ({}));
      if (body.target_month) {
        targetMonth = new Date(body.target_month);
      } else {
        targetMonth = new Date();
      }
    } catch {
      targetMonth = new Date();
    }

    // Billing month = 1st of the current month
    const billingMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const billingMonthStr = billingMonth.toISOString().split('T')[0];

    // ── Fetch all active preschools ────────────────────────────────────
    const { data: schools, error: schoolErr } = await supabase
      .from('preschools')
      .select('id, name')
      .eq('is_active', true);

    if (schoolErr) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch schools', details: schoolErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results: {
      school_id: string;
      school_name: string;
      fees_created: number;
      students_processed: number;
      credits_applied: number;
      errors: string[];
    }[] = [];

    for (const school of schools || []) {
      const schoolResult = {
        school_id: school.id,
        school_name: school.name || 'Unknown',
        fees_created: 0,
        students_processed: 0,
        credits_applied: 0,
        errors: [] as string[],
      };

      try {
        // ── Fetch active fee structures for this school ────────────────
        const { data: feeStructures, error: fsErr } = await supabase
          .from('fee_structures')
          .select('id, amount, fee_type, name, description, grade_levels, effective_from, created_at')
          .eq('preschool_id', school.id)
          .eq('is_active', true)
          .order('effective_from', { ascending: false })
          .order('created_at', { ascending: false });

        if (fsErr) {
          schoolResult.errors.push(`Fee structure fetch error: ${fsErr.message}`);
          results.push(schoolResult);
          continue;
        }

        const tuitionFees = (feeStructures || []).filter((fs) =>
          isTuitionFee(fs.fee_type, fs.name, fs.description)
        );

        if (!tuitionFees.length) {
          // Try school_fee_structures as fallback
          const { data: schoolFees } = await supabase
            .from('school_fee_structures')
            .select('id, amount_cents, fee_category, name, description, age_group, grade_level, created_at')
            .eq('preschool_id', school.id)
            .eq('is_active', true);

          const tuitionSchoolFees = (schoolFees || []).filter((sf) =>
            isTuitionFee(sf.fee_category, sf.name, sf.description)
          );

          if (!tuitionSchoolFees.length) {
            // No fee structures at all — skip this school
            results.push(schoolResult);
            continue;
          }

          // Map school_fee_structures to FeeCandidate format
          for (const sf of tuitionSchoolFees) {
            tuitionFees.push({
              id: sf.id,
              amount: sf.amount_cents / 100,
              fee_type: sf.fee_category,
              name: sf.name,
              description: sf.description,
              age_group: sf.age_group,
              grade_level: sf.grade_level,
              grade_levels: sf.grade_level ? [sf.grade_level] : null,
              effective_from: null,
              created_at: sf.created_at,
            });
          }
        }

        // ── Fetch active students ──────────────────────────────────────
        const { data: students, error: stErr } = await supabase
          .from('students')
          .select('id, date_of_birth, enrollment_date, class_name, grade_level, preschool_id, organization_id, classes!students_class_id_fkey(name, grade_level)')
          .or(`preschool_id.eq.${school.id},organization_id.eq.${school.id}`)
          .eq('is_active', true)
          .eq('status', 'active');

        if (stErr) {
          schoolResult.errors.push(`Student fetch error: ${stErr.message}`);
          results.push(schoolResult);
          continue;
        }

        if (!students?.length) {
          results.push(schoolResult);
          continue;
        }

        // ── Fetch existing fees for this month to avoid duplicates ─────
        const studentIds = students.map((s) => s.id);
        const { data: existingFees } = await supabase
          .from('student_fees')
          .select('student_id')
          .in('student_id', studentIds)
          .eq('billing_month', billingMonthStr);

        const studentsWithFees = new Set((existingFees || []).map((f) => f.student_id));

        // ── Generate fees for students without one ─────────────────────
        const feesToInsert: {
          student_id: string;
          fee_structure_id: string;
          amount: number;
          final_amount: number;
          due_date: string;
          billing_month: string;
          category_code: string;
          status: string;
          amount_paid: number;
          amount_outstanding: number;
        }[] = [];

        for (const student of students) {
          schoolResult.students_processed++;

          if (studentsWithFees.has(student.id)) {
            continue; // Already has a fee for this month
          }

          const normalizedStudent = normalizeStudentRow(student);
          const resolution = selectFee(tuitionFees as FeeCandidate[], normalizedStudent);
          if (resolution.status !== 'matched' || !resolution.fee) {
            const reason = `${resolution.status}:${resolution.reason}`;
            schoolResult.errors.push(`Student ${student.id} unresolved tuition (${reason})`);
            console.warn('[generate-monthly-fees] unresolved tuition', {
              schoolId: school.id,
              studentId: student.id,
              className: normalizedStudent.class_name,
              gradeLevel: normalizedStudent.grade_level,
              reason,
              matches: resolution.matches?.map((match) => ({
                id: match.id,
                amount: match.amount,
                name: match.name,
              })) || [],
            });
            continue;
          }
          const selected = resolution.fee;

          feesToInsert.push({
            student_id: student.id,
            fee_structure_id: selected.id,
            amount: selected.amount,
            final_amount: selected.amount,
            due_date: billingMonthStr,
            billing_month: billingMonthStr,
            category_code: 'tuition',
            status: 'pending',
            amount_paid: 0,
            amount_outstanding: selected.amount,
          });
        }

        if (feesToInsert.length > 0) {
          // Batch insert in chunks of 100
          for (let i = 0; i < feesToInsert.length; i += 100) {
            const chunk = feesToInsert.slice(i, i + 100);
            const { error: insertErr } = await supabase
              .from('student_fees')
              .insert(chunk);

            if (insertErr) {
              schoolResult.errors.push(`Fee insert error (batch ${Math.floor(i / 100)}): ${insertErr.message}`);
            } else {
              schoolResult.fees_created += chunk.length;
            }
          }
        }

        // ── Auto-apply available family credits ────────────────────────
        try {
          const { data: credits } = await supabase
            .from('family_credits')
            .select('id, parent_id, student_id, remaining_amount, origin_payment_id, category_code')
            .eq('preschool_id', school.id)
            .eq('status', 'available')
            .gt('remaining_amount', 0)
            .order('created_at', { ascending: true });

          if (credits?.length) {
            for (const credit of credits) {
              if (!credit.student_id) continue;

              // Find outstanding fees for this student this month
              const { data: outstandingFees } = await supabase
                .from('student_fees')
                .select('id, amount_outstanding, amount_paid, final_amount, amount, billing_month, category_code, status')
                .eq('student_id', credit.student_id)
                .eq('billing_month', billingMonthStr)
                .not('status', 'in', '("paid","waived")')
                .gt('amount_outstanding', 0)
                .order('due_date', { ascending: true });

              if (!outstandingFees?.length) continue;

              let creditRemaining = credit.remaining_amount;

              for (const fee of outstandingFees) {
                if (creditRemaining <= 0) break;

                const applyAmount = Math.min(creditRemaining, fee.amount_outstanding);
                if (applyAmount <= 0) continue;

                // Call the apply_family_credit RPC
                const { error: applyErr } = await supabase.rpc('apply_family_credit', {
                  p_credit_id: credit.id,
                  p_student_fee_id: fee.id,
                  p_amount: applyAmount,
                  p_notes: 'Auto-applied by monthly fee generation',
                });

                if (applyErr) {
                  schoolResult.errors.push(`Credit apply error: ${applyErr.message}`);
                } else {
                  creditRemaining -= applyAmount;
                  schoolResult.credits_applied++;
                }
              }
            }
          }
        } catch (creditErr) {
          schoolResult.errors.push(`Credit auto-apply error: ${String(creditErr)}`);
        }
      } catch (schoolErr) {
        schoolResult.errors.push(`School processing error: ${String(schoolErr)}`);
      }

      results.push(schoolResult);
    }

    const totalFeesCreated = results.reduce((s, r) => s + r.fees_created, 0);
    const totalCreditsApplied = results.reduce((s, r) => s + r.credits_applied, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        billing_month: billingMonthStr,
        cutoff_day: FINANCE_MONTH_CUTOFF_DAY,
        schools_processed: results.length,
        total_fees_created: totalFeesCreated,
        total_credits_applied: totalCreditsApplied,
        total_errors: totalErrors,
        results,
        completed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
