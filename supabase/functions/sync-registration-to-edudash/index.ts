/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference lib="deno.ns" />

// Sync Registration to EduDash
// Creates parent account with generated password and sends welcome email
// Called when principal approves a registration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderEduDashProEmail } from '../_shared/edudashproEmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationRequest {
  id: string;
  organization_id: string | null;
  preschool_id?: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  parent_first_name?: string | null;
  parent_last_name?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_date_of_birth: string | null;
  student_grade: string | null;
  student_allergies: string | null;
  student_medical_conditions: string | null;
  child_first_name?: string | null;
  child_last_name?: string | null;
  child_date_of_birth?: string | null;
  child_grade?: string | null;
  child_allergies?: string | null;
  child_medical_conditions?: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  registration_fee_amount?: number | string | null;
  registration_fee_paid?: boolean | null;
  payment_verified?: boolean | null;
  payment_date?: string | null;
  status: string;
  edusite_id?: string | null;
  edudash_student_id?: string | null;
  edudash_parent_id?: string | null;
}

// Generate a readable, memorable password
// Format: Word + 3 digits + special char (e.g., Welcome2024!)
function generateReadablePassword(): string {
  const words = [
    'Welcome', 'Parent', 'Family', 'School', 'Learn', 'Grow',
    'Happy', 'Bright', 'Smart', 'Eagle', 'Star', 'Shine'
  ];
  const specialChars = ['!', '@', '#', '$'];
  
  const word = words[Math.floor(Math.random() * words.length)];
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 100);
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  return `${word}${year}${randomNum.toString().padStart(2, '0')}${specialChar}`;
}

// Generate a secure random password for fallback
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$';
  let password = '';
  
  // 8 random chars
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // Add a number and special char to ensure complexity
  password += Math.floor(Math.random() * 100).toString().padStart(2, '0');
  password += special[Math.floor(Math.random() * special.length)];
  
  return password;
}

const STUDENT_ID_SEQUENCE_LENGTH = 4;
const STUDENT_ID_MAX_ATTEMPTS = 6;

interface PostgrestErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

interface ProfileLinkResult {
  linked: boolean;
  organizationId?: string;
  error?: string;
}

interface ProfileLinkRow {
  id: string;
  organization_id: string | null;
  preschool_id: string | null;
}

interface ParentCandidate {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  source: 'guardian' | 'parent';
}

interface ParentAccountResult extends ParentCandidate {
  userId: string | null;
  accountCreated: boolean;
  generatedPassword?: string | null;
  profileLinked: boolean;
}

interface ClassRow {
  id: string;
  age_min?: number | null;
  age_max?: number | null;
  age_group?: string | null;
  grade_level?: string | null;
  grade?: string | null;
  active?: boolean | null;
}

interface FeeStructureRow {
  id: string;
  age_group?: string | null;
  grade_level?: string | null;
  amount_cents?: number | null;
  fee_category?: string | null;
  is_active?: boolean | null;
  due_day_of_month?: number | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOrgCode(value: string | null | undefined): string {
  const cleaned = (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  if (cleaned.length > 0) return cleaned.padEnd(3, 'X');
  return 'STU';
}

function normalizeDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const datePart = raw.split('T')[0];
  const isoMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return datePart;

  const altMatch = datePart.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (altMatch) {
    const day = Number(altMatch[1]);
    const month = Number(altMatch[2]);
    const year = Number(altMatch[3]);
    if (!day || !month || !year) return null;
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  return null;
}

function calculateAgeYears(dobIso: string, referenceDate = new Date()): number | null {
  const [yearStr, monthStr, dayStr] = dobIso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();

  let age = refYear - year;
  if (refMonth < month || (refMonth === month && refDay < day)) {
    age -= 1;
  }
  return age;
}

function parseAgeRange(value?: string | null): { min: number; max: number } | null {
  if (!value) return null;
  const tokens: number[] = [];
  const regex = /(\d+(?:\.\d+)?)(?:\s*(months?|mos?|m|yrs?|years?|y))?/gi;
  for (const match of value.matchAll(regex)) {
    const raw = Number(match[1]);
    if (!Number.isFinite(raw)) continue;
    const unit = (match[2] || '').toLowerCase();
    const years = unit.startsWith('m') ? raw / 12 : raw;
    tokens.push(years);
  }
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    return { min: tokens[0], max: tokens[0] };
  }
  return { min: Math.min(tokens[0], tokens[1]), max: Math.max(tokens[0], tokens[1]) };
}

function normalizeGrade(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.toString().trim().toUpperCase();
  if (!cleaned) return null;
  const withoutGrade = cleaned.replace(/GRADE\s+/g, '').trim();
  return withoutGrade || cleaned;
}

function getNextMonthDueDate(day = 7): string {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const dueDay = Math.min(day, lastDay);
  const dueDate = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), dueDay));
  return dueDate.toISOString().split('T')[0];
}

function selectClassByAge(classes: ClassRow[], ageYears: number): ClassRow | null {
  const candidates = classes.filter((cls) => {
    const min = cls.age_min ?? null;
    const max = cls.age_max ?? null;
    if (typeof min === 'number' && typeof max === 'number') {
      return ageYears >= min && ageYears <= max;
    }
    const range = parseAgeRange(cls.age_group);
    if (range) {
      return ageYears >= range.min && ageYears <= range.max;
    }
    return false;
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const aMin = a.age_min ?? parseAgeRange(a.age_group)?.min ?? 0;
    const aMax = a.age_max ?? parseAgeRange(a.age_group)?.max ?? 99;
    const bMin = b.age_min ?? parseAgeRange(b.age_group)?.min ?? 0;
    const bMax = b.age_max ?? parseAgeRange(b.age_group)?.max ?? 99;
    const aRange = aMax - aMin;
    const bRange = bMax - bMin;
    if (aRange !== bRange) return aRange - bRange;
    return aMin - bMin;
  });
  return candidates[0];
}

function selectClassByGrade(classes: ClassRow[], grade: string): ClassRow | null {
  const normalized = normalizeGrade(grade);
  if (!normalized) return null;
  const match = classes.find((cls) => {
    const clsGrade = normalizeGrade(cls.grade_level || cls.grade || '');
    return clsGrade === normalized;
  });
  return match || null;
}

function selectFeeStructureByAge(fees: FeeStructureRow[], ageYears: number): FeeStructureRow | null {
  const candidates = fees.filter((fee) => {
    const range = parseAgeRange(fee.age_group);
    if (!range) return false;
    return ageYears >= range.min && ageYears <= range.max;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const aRange = parseAgeRange(a.age_group)?.max ?? 99;
    const bRange = parseAgeRange(b.age_group)?.max ?? 99;
    return aRange - bRange;
  });
  return candidates[0];
}

function selectFeeStructureByGrade(fees: FeeStructureRow[], grade: string): FeeStructureRow | null {
  const normalized = normalizeGrade(grade);
  if (!normalized) return null;
  return fees.find((fee) => normalizeGrade(fee.grade_level) === normalized) || null;
}

async function getLastStudentSequence(
  supabase: ReturnType<typeof createClient>,
  prefix: string
): Promise<number> {
  const { data: lastStudent } = await supabase
    .from('students')
    .select('student_id')
    .like('student_id', `${prefix}%`)
    .order('student_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastStudent?.student_id) {
    const match = lastStudent.student_id.match(
      new RegExp(`^${escapeRegExp(prefix)}(\\d{${STUDENT_ID_SEQUENCE_LENGTH}})$`)
    );
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .like('student_id', `${prefix}%`);

  return count ?? 0;
}

function isDuplicateStudentIdError(error: PostgrestErrorLike | null): boolean {
  if (!error) return false;
  if (error.code != '23505') return false;
  return (error.message || error.details || '').includes('students_student_id_key');
}

async function ensureParentProfileLinked(
  supabase: ReturnType<typeof createClient>,
  parentId: string,
  organizationId: string
): Promise<ProfileLinkResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        organization_id: organizationId,
        preschool_id: organizationId,
        role: 'parent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentId)
      .select('id, organization_id, preschool_id')
      .maybeSingle();

    if (error) {
      console.error('[sync-registration] Parent profile link update failed:', error);
      return { linked: false, organizationId, error: error.message };
    }

    const linkedProfile = data as ProfileLinkRow | null;
    const linked =
      !!linkedProfile?.organization_id &&
      linkedProfile.organization_id === organizationId &&
      linkedProfile.preschool_id === organizationId;

    return { linked, organizationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sync-registration] Parent profile link exception:', message);
    return { linked: false, organizationId, error: message };
  }
}

function buildParentCandidates(registration: RegistrationRequest): ParentCandidate[] {
  const candidates: ParentCandidate[] = [];
  const guardianEmail = registration.guardian_email?.trim().toLowerCase() || '';
  const parentEmail = registration.parent_email?.trim().toLowerCase() || '';

  if (guardianEmail) {
    candidates.push({
      email: guardianEmail,
      firstName: registration.guardian_first_name || registration.parent_first_name || null,
      lastName: registration.guardian_last_name || registration.parent_last_name || null,
      phone: registration.guardian_phone || registration.parent_phone || null,
      isPrimary: true,
      source: 'guardian',
    });
  }

  if (parentEmail) {
    candidates.push({
      email: parentEmail,
      firstName: registration.parent_first_name || registration.guardian_first_name || null,
      lastName: registration.parent_last_name || registration.guardian_last_name || null,
      phone: registration.parent_phone || registration.guardian_phone || null,
      isPrimary: !guardianEmail,
      source: 'parent',
    });
  }

  const uniqueMap = new Map<string, ParentCandidate>();
  for (const candidate of candidates) {
    const existing = uniqueMap.get(candidate.email);
    if (!existing) {
      uniqueMap.set(candidate.email, candidate);
    } else {
      uniqueMap.set(candidate.email, {
        ...existing,
        isPrimary: existing.isPrimary || candidate.isPrimary,
        firstName: existing.firstName || candidate.firstName,
        lastName: existing.lastName || candidate.lastName,
        phone: existing.phone || candidate.phone,
      });
    }
  }

  return Array.from(uniqueMap.values());
}

async function resolveParentAccount(
  supabase: ReturnType<typeof createClient>,
  candidate: ParentCandidate,
  organizationId: string
): Promise<ParentAccountResult> {
  let userId: string | null = null;
  let accountCreated = false;
  let generatedPassword: string | null = null;
  let profileLinked = false;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', candidate.email)
    .maybeSingle();

  if (existingProfile?.id) {
    userId = existingProfile.id;
  }

  if (!userId) {
    try {
      const { data: existingAuth } = await supabase.auth.admin.getUserByEmail(candidate.email);
      if (existingAuth?.user?.id) {
        userId = existingAuth.user.id;
      }
    } catch (authLookupError) {
      console.warn('[sync-registration] Parent auth lookup failed:', authLookupError);
    }
  }

  if (!userId) {
    generatedPassword = generateReadablePassword();
    accountCreated = true;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: candidate.email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        first_name: candidate.firstName,
        last_name: candidate.lastName,
        phone: candidate.phone,
        role: 'parent',
      },
    });

    if (authError || !authData.user) {
      const errorMessage = authError?.message || 'Unknown error';
      if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('exists')) {
        const { data: existingAuth } = await supabase.auth.admin.getUserByEmail(candidate.email);
        if (existingAuth?.user?.id) {
          userId = existingAuth.user.id;
          accountCreated = false;
        }
      }

      if (!userId) {
        console.error('[sync-registration] Error creating parent account:', authError);
        return {
          ...candidate,
          userId: null,
          accountCreated: false,
          generatedPassword: null,
          profileLinked: false,
        };
      }
    } else {
      userId = authData.user.id;
    }
  }

  if (userId && !existingProfile?.id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: candidate.email,
        first_name: candidate.firstName,
        last_name: candidate.lastName,
        phone: candidate.phone,
        role: 'parent',
        preschool_id: organizationId,
        organization_id: organizationId,
      });

    if (profileError) {
      console.error('[sync-registration] Error creating profile:', profileError);
    }
  }

  if (userId) {
    const linkResult = await ensureParentProfileLinked(supabase, userId, organizationId);
    profileLinked = linkResult.linked;
    if (!profileLinked) {
      console.warn('[sync-registration] Parent profile not fully linked:', linkResult);
    }
  }

  return {
    ...candidate,
    userId,
    accountCreated,
    generatedPassword,
    profileLinked,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'EduDash Pro <support@edudashpro.org.za>';
    const supportEmail = Deno.env.get('SUPPORT_EMAIL') || 'support@edudashpro.org.za';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { registration_id } = await req.json();

    if (!registration_id) {
      return new Response(
        JSON.stringify({ error: 'registration_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-registration] Processing registration: ${registration_id}`);

    // Fetch registration from EduDashPro database
    const { data: registrationData, error: fetchError } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('id', registration_id)
      .single();

    const registration = registrationData as RegistrationRequest | null;

    if (fetchError || !registration) {
      console.error('[sync-registration] Registration not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Registration not found', details: fetchError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process approved registrations
    if (registration.status !== 'approved') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Registration is not approved yet',
          status: registration.status 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = registration.organization_id || registration.preschool_id;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parentCandidates = buildParentCandidates(registration);
    if (parentCandidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Parent email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedDob = normalizeDateValue(
      registration.student_date_of_birth ||
      registration.student_dob ||
      registration.child_date_of_birth
    );
    const normalizedGrade = normalizeGrade(registration.student_grade || registration.child_grade);

    const parentAccounts: ParentAccountResult[] = [];
    for (const candidate of parentCandidates) {
      const result = await resolveParentAccount(supabase, candidate, organizationId);
      parentAccounts.push(result);
    }

    const failedParents = parentAccounts.filter((parent) => !parent.userId);
    if (failedParents.length > 0) {
      console.warn('[sync-registration] Some parent accounts could not be resolved:', failedParents.map((p) => p.email));
    }

    const primaryParent = parentAccounts.find((parent) => parent.isPrimary && parent.userId)
      || parentAccounts.find((parent) => parent.userId)
      || null;
    const parentUserId = primaryParent?.userId ?? null;
    const secondaryParentId = parentAccounts.find(
      (parent) => parent.userId && parent.userId !== parentUserId
    )?.userId ?? null;
    const parentProfileLinked = primaryParent?.profileLinked ?? false;
    const parentAccountCreated = parentAccounts.some((parent) => parent.accountCreated);

    if (!parentUserId) {
      console.error('[sync-registration] No primary parent account could be resolved');
      return new Response(
        JSON.stringify({ error: 'Failed to create parent account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Create student record
    const studentFirstName = registration.student_first_name || registration.child_first_name;
    const studentLastName = registration.student_last_name || registration.child_last_name;
    const trimmedFirstName = studentFirstName?.trim() || studentFirstName || '';
    const trimmedLastName = studentLastName?.trim() || studentLastName || '';
    
    // Check if student already exists
    let studentId: string | null = null;
    let studentCreated = false;

    // Prefer explicit student ID from registration if available
    if (registration.edudash_student_id) {
      const { data: studentById } = await supabase
        .from('students')
        .select('id')
        .eq('id', registration.edudash_student_id)
        .maybeSingle();
      
      if (studentById?.id) {
        studentId = studentById.id;
      }
    }

    // Fallback: find existing student by name within the preschool
    if (!studentId) {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .ilike('first_name', `${trimmedFirstName}%`)
        .ilike('last_name', `${trimmedLastName}%`)
        .eq('preschool_id', organizationId)
        .maybeSingle();

      if (existingStudent?.id) {
        studentId = existingStudent.id;
      }
    }

    let studentClassId: string | null = null;
    let classResolved = false;
    if (organizationId) {
      const { data: classRows } = await supabase
        .from('classes')
        .select('id, age_min, age_max, age_group, grade_level, grade, active')
        .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
        .eq('active', true);

      const classes = (classRows || []) as ClassRow[];
      const ageYears = normalizedDob ? calculateAgeYears(normalizedDob) : null;
      let selectedClass: ClassRow | null = null;
      if (normalizedGrade) {
        selectedClass = selectClassByGrade(classes, normalizedGrade);
      }
      if (!selectedClass && ageYears !== null) {
        selectedClass = selectClassByAge(classes, ageYears);
      }
      if (selectedClass?.id) {
        studentClassId = selectedClass.id;
        classResolved = true;
      }
    }

    if (studentId) {
      // Update parent link, DOB, grade, class, and payment status from registration
      const studentUpdate: Record<string, unknown> = {
        registration_fee_amount: registration.registration_fee_amount || null,
        registration_fee_paid: registration.registration_fee_paid || false,
        payment_verified: registration.payment_verified || false,
        payment_date: registration.payment_date || null,
      };

      if (normalizedDob) {
        studentUpdate.date_of_birth = normalizedDob;
      }
      if (normalizedGrade) {
        studentUpdate.grade = normalizedGrade;
      }
      if (classResolved && studentClassId) {
        studentUpdate.class_id = studentClassId;
      }
      if (parentUserId) {
        studentUpdate.parent_id = parentUserId;
        studentUpdate.guardian_id = secondaryParentId || parentUserId;
      }

      await supabase
        .from('students')
        .update(studentUpdate)
        .eq('id', studentId);
      
      console.log('[sync-registration] Updated existing student with payment status:', {
        studentId,
        registration_fee_paid: registration.registration_fee_paid,
        payment_verified: registration.payment_verified,
      });
    } else {
      // Generate student ID code
      const { data: org } = await supabase
        .from('preschools')
        .select('name')
        .eq('id', organizationId)
        .single();

      const orgCode = normalizeOrgCode(org?.name);
      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `${orgCode}${year}`;
      const lastSequence = await getLastStudentSequence(supabase, prefix);
      let studentError: PostgrestErrorLike | null = null;

      for (let attempt = 1; attempt <= STUDENT_ID_MAX_ATTEMPTS; attempt += 1) {
        const studentIdCode = `${prefix}${String(lastSequence + attempt).padStart(
          STUDENT_ID_SEQUENCE_LENGTH,
          '0'
        )}`;

        const { data: newStudent, error } = await supabase
          .from('students')
          .insert({
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            date_of_birth: normalizedDob,
            grade: normalizedGrade,
            parent_id: parentUserId,
            guardian_id: secondaryParentId || parentUserId,
            preschool_id: organizationId,
            class_id: studentClassId,
            student_id: studentIdCode,
            emergency_contact_name: registration.emergency_contact_name,
            emergency_contact_phone: registration.emergency_contact_phone,
            emergency_contact_relation: registration.emergency_contact_relation,
            allergies: registration.student_allergies || registration.child_allergies,
            medical_conditions: registration.student_medical_conditions || registration.child_medical_conditions,
            is_active: true,
            status: 'active',
            enrollment_date: new Date().toISOString(),
            // Carry over payment status from registration so parent dashboard shows correct status
            registration_fee_amount: registration.registration_fee_amount || null,
            registration_fee_paid: registration.registration_fee_paid || false,
            payment_verified: registration.payment_verified || false,
            payment_date: registration.payment_date || null,
          })
          .select('id')
          .single();

        if (!error) {
          studentId = newStudent?.id;
          studentCreated = true;
          studentError = null;
          break;
        }

        const typedError = error as PostgrestErrorLike | null;
        if (!isDuplicateStudentIdError(typedError)) {
          studentError = typedError;
          break;
        }
      }

      if (studentError) {
        console.error('[sync-registration] Error creating student:', studentError);
      } else if (studentCreated) {
        console.log('[sync-registration] Student created with payment status:', {
          registration_fee_paid: registration.registration_fee_paid,
          payment_verified: registration.payment_verified,
        });
      }
    }

    // Step 3: Create guardian-student relationship(s)
    if (studentId) {
      for (const parent of parentAccounts) {
        if (!parent.userId) continue;
        const isPrimary = parent.userId === parentUserId || parent.isPrimary;
        await supabase
          .from('student_parent_relationships')
          .upsert({
            parent_id: parent.userId,
            student_id: studentId,
            relationship_type: 'parent',
            is_primary: isPrimary,
          }, { onConflict: 'parent_id,student_id' });
      }
    }

    // Step 3.5: Ensure correct tuition fee for next month based on age/grade
    if (studentId && organizationId) {
      try {
        const { data: feeRows, error: feeRowsError } = await supabase
          .from('school_fee_structures')
          .select('id, age_group, grade_level, amount_cents, fee_category, is_active, due_day_of_month')
          .eq('preschool_id', organizationId)
          .eq('is_active', true)
          .eq('fee_category', 'tuition');

        if (feeRowsError) {
          console.warn('[sync-registration] Failed to load fee structures:', feeRowsError.message);
        }

        const feeStructures = (feeRows || []) as FeeStructureRow[];
        const ageYears = normalizedDob ? calculateAgeYears(normalizedDob) : null;
        let selectedFee: FeeStructureRow | null = null;
        if (normalizedGrade) {
          selectedFee = selectFeeStructureByGrade(feeStructures, normalizedGrade);
        }
        if (!selectedFee && ageYears !== null) {
          selectedFee = selectFeeStructureByAge(feeStructures, ageYears);
        }
        if (!selectedFee && feeStructures.length === 1) {
          selectedFee = feeStructures[0];
        }

        if (selectedFee?.id && selectedFee.amount_cents) {
          const dueDay = selectedFee.due_day_of_month || 7;
          const nextDueDate = getNextMonthDueDate(dueDay);
          const amount = Number(selectedFee.amount_cents) / 100;
          const [yearStr, monthStr] = nextDueDate.split('-');
          const startOfMonth = `${yearStr}-${monthStr}-01`;
          const nextMonthDate = new Date(Date.UTC(Number(yearStr), Number(monthStr), 1));
          const endOfMonth = new Date(nextMonthDate);
          const endMonthStr = endOfMonth.toISOString().split('T')[0];

          const { data: existingFees } = await supabase
            .from('student_fees')
            .select('id, amount_paid, status, due_date, fee_structure_id')
            .eq('student_id', studentId)
            .gte('due_date', startOfMonth)
            .lt('due_date', endMonthStr);

          const existingFee = (existingFees || []).find((fee: any) => fee.fee_structure_id === selectedFee.id)
            || (existingFees || [])[0];

          if (existingFee?.id) {
            const shouldUpdate = ['pending', 'overdue', 'partially_paid'].includes(String(existingFee.status || 'pending'));
            if (shouldUpdate) {
              const outstanding = Math.max(amount - Number(existingFee.amount_paid || 0), 0);
              await supabase
                .from('student_fees')
                .update({
                  fee_structure_id: selectedFee.id,
                  amount,
                  final_amount: amount,
                  amount_outstanding: outstanding,
                  due_date: nextDueDate,
                })
                .eq('id', existingFee.id);
            }
          } else {
            await supabase
              .from('student_fees')
              .insert({
                student_id: studentId,
                fee_structure_id: selectedFee.id,
                amount,
                final_amount: amount,
                due_date: nextDueDate,
                status: 'pending',
                amount_outstanding: amount,
              });
          }
        } else {
          console.warn('[sync-registration] No fee structure matched for student', studentId);
        }
      } catch (feeError) {
        console.error('[sync-registration] Fee assignment error:', feeError);
      }
    }

    // Step 4: Update registration with created IDs
    const regUpdate: Record<string, unknown> = {
      edudash_student_id: studentId,
      synced_at: new Date().toISOString(),
    };

    if (parentUserId) {
      regUpdate.edudash_parent_id = parentUserId;
    }

    await supabase
      .from('registration_requests')
      .update(regUpdate)
      .eq('id', registration_id);

    // Step 5: Send welcome email with login credentials (if new account)
    const newParentAccounts = parentAccounts.filter(
      (parent) => parent.accountCreated && parent.generatedPassword
    );
    if (newParentAccounts.length > 0 && resendApiKey) {
      // Get school name once
      const { data: school } = await supabase
        .from('preschools')
        .select('name')
        .eq('id', organizationId)
        .single();

      const schoolName = school?.name || 'Young Eagles';
      const childFullName = `${studentFirstName} ${studentLastName}`.trim();

      for (const parent of newParentAccounts) {
        const parentFullName = `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Parent';
        const bodyHtml = `
<p>Hi ${parentFullName},</p>
<p>Great news! <strong>${childFullName}</strong>'s registration at <strong>${schoolName}</strong> has been approved.</p>
<p>Your parent account is ready so you can track progress, homework, and messages in EduDash Pro.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;">Your login details</p>
  <p style="margin:0 0 6px 0;"><strong>Email:</strong> ${parent.email}</p>
  <p style="margin:0;"><strong>Temporary password:</strong> ${parent.generatedPassword}</p>
</div>
<p>Please change your password after your first login for security.</p>
<p>If you have questions, contact ${schoolName} or reply to this email.</p>
        `.trim();

        const emailHtml = renderEduDashProEmail({
          title: `Registration approved at ${schoolName}`,
          subtitle: `${childFullName} is now enrolled`,
          preheader: `Registration approved for ${childFullName}`,
          bodyHtml,
          cta: { label: 'Login to EduDash Pro', url: 'https://edudashpro.org.za/sign-in' },
          supportEmail,
        });

        try {
          console.log('[sync-registration] Sending welcome email to:', parent.email);
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [parent.email],
              subject: `✅ Registration Approved - Welcome to ${schoolName}!`,
              html: emailHtml,
              reply_to: supportEmail,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error('[sync-registration] Email send failed:', errorText);
          } else {
            console.log('[sync-registration] Welcome email sent successfully');
          }
        } catch (emailError) {
          console.error('[sync-registration] Error sending welcome email:', emailError);
          // Don't fail the whole operation if email fails
        }
      }
    }

    // Step 6: Update EduSitePro if this was synced from there
    if (registration.edusite_id) {
      try {
        const edusiteUrl = Deno.env.get('EDUSITE_SUPABASE_URL');
        const edusiteServiceKey = Deno.env.get('EDUSITE_SUPABASE_SERVICE_ROLE_KEY');
        
        if (edusiteUrl && edusiteServiceKey) {
          const edusiteClient = createClient(edusiteUrl, edusiteServiceKey);
          
          await edusiteClient
            .from('registration_requests')
            .update({
              synced_to_edudash: true,
              synced_at: new Date().toISOString(),
              edudash_student_id: studentId,
              edudash_parent_id: parentUserId,
            })
            .eq('id', registration.edusite_id);
          
          console.log('[sync-registration] Updated EduSitePro with sync status');
        }
      } catch (edusiteError) {
        console.error('[sync-registration] Error updating EduSitePro:', edusiteError);
        // Don't fail - this is just for tracking
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: parentAccountCreated 
          ? 'Registration synced successfully. Welcome email sent with login credentials.' 
          : 'Registration synced successfully. Parent account already existed.',
        data: {
          parent_user_id: parentUserId,
          parent_account_created: parentAccountCreated,
          parent_profile_linked: parentProfileLinked,
          student_id: studentId,
          student_created: studentCreated,
          email_sent: newParentAccounts.length > 0 && !!resendApiKey,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-registration] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
