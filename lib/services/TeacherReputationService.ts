import { assertSupabase } from '@/lib/supabase';
import {
  CreateTeacherReferenceSchema,
  TeacherMarketProfileSchema,
  TeacherMarketProfileUpdateSchema,
  TeacherRatingSummarySchema,
  TeacherReferenceSchema,
} from '@/types/teacher-reputation';
import type {
  TeacherMarketProfile,
  TeacherMarketProfileUpdate,
  TeacherRatingSummary,
  TeacherReference,
  CreateTeacherReferenceInput,
  TeacherReferenceRatings,
} from '@/types/teacher-reputation';

interface ProfileLookup {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  teaching_experience_years?: number | null;
  subjects_taught?: string[] | null;
  qualifications?: string[] | null;
}

interface SchoolNameRow {
  id: string;
  name?: string | null;
}

interface PrincipalNameRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface TeacherReferenceRow {
  id: string;
  candidate_profile_id: string;
  teacher_user_id: string | null;
  organization_id: string;
  principal_id: string;
  rating_overall: number;
  rating_communication: number | null;
  rating_classroom: number | null;
  rating_planning: number | null;
  rating_professionalism: number | null;
  rating_parent_engagement: number | null;
  rating_reliability: number | null;
  title: string | null;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
}

interface TeacherRatingSummaryRow {
  candidate_profile_id: string | null;
  teacher_user_id: string | null;
  rating_count: number | null;
  avg_rating: number | null;
  avg_communication: number | null;
  avg_classroom: number | null;
  avg_planning: number | null;
  avg_professionalism: number | null;
  avg_parent_engagement: number | null;
  avg_reliability: number | null;
  last_rating_at: string | null;
}

interface CandidateProfileRow {
  id: string;
  user_id?: string | null;
  email: string;
  first_name: string;
  last_name: string;
  is_public?: boolean | null;
  location?: string | null;
  location_city?: string | null;
  location_province?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_source?: string | null;
  preferred_radius_km?: number | null;
  location_updated_at?: string | null;
  preferred_location_lat?: number | null;
  preferred_location_lng?: number | null;
  willing_to_commute_km?: number | null;
}

const EMPTY_SUMMARY: TeacherRatingSummary = {
  rating_count: 0,
  avg_rating: null,
  avg_communication: null,
  avg_classroom: null,
  avg_planning: null,
  avg_professionalism: null,
  avg_parent_engagement: null,
  avg_reliability: null,
};

export class TeacherReputationService {
  static async getMarketProfile(userId: string): Promise<TeacherMarketProfile | null> {
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.mapMarketProfile(data as CandidateProfileRow);
  }

  static async ensureMarketProfile(userId: string): Promise<TeacherMarketProfile> {
    const existing = await this.getMarketProfile(userId);
    if (existing) return existing;

    const supabase = assertSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, teaching_experience_years, subjects_taught, qualifications')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const typedProfile = profile as ProfileLookup;
    const subjects = Array.isArray(typedProfile.subjects_taught) ? typedProfile.subjects_taught : [];
    const qualifications = Array.isArray(typedProfile.qualifications) ? typedProfile.qualifications : [];
    const { data, error } = await supabase
      .from('candidate_profiles')
      .insert({
        user_id: userId,
        email: typedProfile.email || '',
        first_name: typedProfile.first_name || '',
        last_name: typedProfile.last_name || '',
        phone: typedProfile.phone,
        experience_years: typedProfile.teaching_experience_years ?? 0,
        skills: subjects,
        qualifications,
        is_public: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return this.mapMarketProfile(data as CandidateProfileRow);
  }

  static async upsertMarketProfile(userId: string, update: TeacherMarketProfileUpdate): Promise<TeacherMarketProfile> {
    const existing = await this.ensureMarketProfile(userId);
    const parsedUpdate = TeacherMarketProfileUpdateSchema.safeParse(update);
    if (!parsedUpdate.success) {
      const message = parsedUpdate.error.issues[0]?.message || 'Invalid hiring profile data.';
      throw new Error(message);
    }

    const safeUpdate = parsedUpdate.data;
    const supabase = assertSupabase();

    const nextCity = safeUpdate.location_city ?? existing.location_city ?? null;
    const nextProvince = safeUpdate.location_province ?? existing.location_province ?? null;
    const nextLocation =
      safeUpdate.location ??
      (nextCity || nextProvince ? [nextCity, nextProvince].filter(Boolean).join(', ') : existing.location ?? null);

    const rawLat = safeUpdate.location_lat ?? existing.location_lat ?? null;
    const rawLng = safeUpdate.location_lng ?? existing.location_lng ?? null;

    let nextSource = safeUpdate.location_source ?? existing.location_source ?? null;
    if (!nextSource) {
      if (rawLat !== null && rawLng !== null) {
        nextSource = 'gps';
      } else if (nextLocation) {
        nextSource = 'manual';
      }
    }

    const resolvedLat = nextSource === 'gps' ? rawLat : null;
    const resolvedLng = nextSource === 'gps' ? rawLng : null;
    const nextRadius =
      safeUpdate.preferred_radius_km ?? existing.preferred_radius_km ?? existing.willing_to_commute_km ?? null;

    const { data, error } = await supabase
      .from('candidate_profiles')
      .update({
        is_public: safeUpdate.is_public ?? existing.is_public,
        location_city: nextCity,
        location_province: nextProvince,
        location_lat: resolvedLat,
        location_lng: resolvedLng,
        location_source: nextSource,
        preferred_radius_km: nextRadius,
        location_updated_at: safeUpdate.location_updated_at ?? existing.location_updated_at ?? null,
        location: nextLocation,
        preferred_location_lat: resolvedLat,
        preferred_location_lng: resolvedLng,
        willing_to_commute_km: nextRadius,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return this.mapMarketProfile(data as CandidateProfileRow);
  }

  static async getRatingSummaryByTeacherUserId(teacherUserId: string): Promise<TeacherRatingSummary> {
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('teacher_rating_summary')
      .select('*')
      .eq('teacher_user_id', teacherUserId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ...EMPTY_SUMMARY, teacher_user_id: teacherUserId };
    return this.mapRatingSummary(data as TeacherRatingSummaryRow);
  }

  static async getRatingSummaryByCandidateProfileId(candidateProfileId: string): Promise<TeacherRatingSummary> {
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('teacher_rating_summary')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ...EMPTY_SUMMARY, candidate_profile_id: candidateProfileId };
    return this.mapRatingSummary(data as TeacherRatingSummaryRow);
  }

  static async getRatingSummariesByTeacherIds(teacherIds: string[]): Promise<Record<string, TeacherRatingSummary>> {
    if (teacherIds.length === 0) return {};

    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('teacher_rating_summary')
      .select('*')
      .in('teacher_user_id', teacherIds);

    if (error) throw error;

    const summaries: Record<string, TeacherRatingSummary> = {};
    (data as TeacherRatingSummaryRow[] | null)?.forEach((row) => {
      if (!row.teacher_user_id) return;
      summaries[row.teacher_user_id] = this.mapRatingSummary(row);
    });

    return summaries;
  }

  static async getReferencesByCandidateProfileId(candidateProfileId: string): Promise<TeacherReference[]> {
    return this.getReferences({ candidateProfileId });
  }

  static async getReferencesByTeacherUserId(teacherUserId: string): Promise<TeacherReference[]> {
    return this.getReferences({ teacherUserId });
  }

  static async createReference(input: CreateTeacherReferenceInput): Promise<TeacherReference> {
    const supabase = assertSupabase();

    const parsedInput = CreateTeacherReferenceSchema.safeParse(input);
    if (!parsedInput.success) {
      const message = parsedInput.error.issues[0]?.message || 'Invalid reference payload.';
      throw new Error(message);
    }

    const safeInput = parsedInput.data;
    const payload = {
      candidate_profile_id: safeInput.candidate_profile_id,
      teacher_user_id: safeInput.teacher_user_id ?? null,
      organization_id: safeInput.organization_id,
      principal_id: safeInput.principal_id,
      rating_overall: safeInput.rating_overall,
      rating_communication: safeInput.ratings?.communication ?? null,
      rating_classroom: safeInput.ratings?.classroom ?? null,
      rating_planning: safeInput.ratings?.planning ?? null,
      rating_professionalism: safeInput.ratings?.professionalism ?? null,
      rating_parent_engagement: safeInput.ratings?.parent_engagement ?? null,
      rating_reliability: safeInput.ratings?.reliability ?? null,
      title: safeInput.title?.trim() || null,
      comment: safeInput.comment?.trim() || null,
      is_anonymous: safeInput.is_anonymous ?? false,
    };

    const { data, error } = await supabase
      .from('teacher_references')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    const reference = data as TeacherReferenceRow;
    return this.mapReference(reference, undefined, undefined);
  }

  private static async getReferences(params: { candidateProfileId?: string; teacherUserId?: string }): Promise<TeacherReference[]> {
    const supabase = assertSupabase();

    let candidateProfileId = params.candidateProfileId;

    if (!candidateProfileId && params.teacherUserId) {
      const { data: candidate, error } = await supabase
        .from('candidate_profiles')
        .select('id')
        .eq('user_id', params.teacherUserId)
        .maybeSingle();

      if (error) throw error;
      candidateProfileId = candidate?.id ?? undefined;
    }

    if (!candidateProfileId && !params.teacherUserId) return [];

    let query = supabase
      .from('teacher_references')
      .select('*')
      .order('created_at', { ascending: false });

    if (candidateProfileId) {
      query = query.eq('candidate_profile_id', candidateProfileId);
    } else if (params.teacherUserId) {
      query = query.eq('teacher_user_id', params.teacherUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as TeacherReferenceRow[];
    if (rows.length === 0) return [];

    const orgIds = Array.from(new Set(rows.map((row) => row.organization_id)));
    const principalIds = Array.from(new Set(rows.filter((row) => !row.is_anonymous).map((row) => row.principal_id)));

    const [schoolMap, principalMap] = await Promise.all([
      this.fetchSchoolNames(orgIds),
      this.fetchPrincipalNames(principalIds),
    ]);

    return rows.map((row) => this.mapReference(row, schoolMap, principalMap));
  }

  private static mapMarketProfile(row: CandidateProfileRow): TeacherMarketProfile {
    const rawLocation = row.location?.trim() || null;
    const locationParts = rawLocation ? rawLocation.split(',').map((part) => part.trim()) : [];
    const locationCity = row.location_city ?? locationParts[0] ?? null;
    const locationProvince = row.location_province ?? locationParts[1] ?? null;

    const rawLat = row.location_lat ?? row.preferred_location_lat ?? null;
    const rawLng = row.location_lng ?? row.preferred_location_lng ?? null;
    const locationLat = rawLat !== null && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
    const locationLng = rawLng !== null && rawLng >= -180 && rawLng <= 180 ? rawLng : null;

    const rawRadius = row.preferred_radius_km ?? row.willing_to_commute_km ?? null;
    const preferredRadius = rawRadius && rawRadius > 0 ? rawRadius : null;

    const derivedLocation =
      rawLocation || [locationCity, locationProvince].filter(Boolean).join(', ') || null;

    const sourceRaw = row.location_source;
    const normalizedSource = sourceRaw === 'gps' || sourceRaw === 'manual' ? sourceRaw : null;
    const locationSource =
      normalizedSource ?? (locationLat !== null && locationLng !== null ? 'gps' : derivedLocation ? 'manual' : null);

    const mapped = {
      id: row.id,
      user_id: row.user_id ?? null,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      is_public: row.is_public ?? false,
      location: derivedLocation,
      location_city: locationCity,
      location_province: locationProvince,
      location_lat: locationLat,
      location_lng: locationLng,
      location_source: locationSource,
      preferred_radius_km: preferredRadius,
      location_updated_at: row.location_updated_at ?? null,
      preferred_location_lat: row.preferred_location_lat ?? locationLat,
      preferred_location_lng: row.preferred_location_lng ?? locationLng,
      willing_to_commute_km: row.willing_to_commute_km ?? preferredRadius,
    };

    return TeacherMarketProfileSchema.parse(mapped);
  }

  private static mapRatingSummary(row: TeacherRatingSummaryRow): TeacherRatingSummary {
    const mapped = {
      candidate_profile_id: row.candidate_profile_id,
      teacher_user_id: row.teacher_user_id,
      rating_count: row.rating_count ?? 0,
      avg_rating: row.avg_rating,
      avg_communication: row.avg_communication,
      avg_classroom: row.avg_classroom,
      avg_planning: row.avg_planning,
      avg_professionalism: row.avg_professionalism,
      avg_parent_engagement: row.avg_parent_engagement,
      avg_reliability: row.avg_reliability,
      last_rating_at: row.last_rating_at,
    };
    return TeacherRatingSummarySchema.parse(mapped);
  }

  private static mapReference(
    row: TeacherReferenceRow,
    schoolMap?: Map<string, string>,
    principalMap?: Map<string, string>
  ): TeacherReference {
    const mapped = {
      id: row.id,
      candidate_profile_id: row.candidate_profile_id,
      teacher_user_id: row.teacher_user_id,
      organization_id: row.organization_id,
      principal_id: row.principal_id,
      rating_overall: row.rating_overall,
      title: row.title,
      comment: row.comment,
      is_anonymous: row.is_anonymous,
      created_at: row.created_at,
      ratings: this.mapReferenceRatings(row),
      school_name: schoolMap?.get(row.organization_id) || null,
      principal_name: row.is_anonymous ? null : (principalMap?.get(row.principal_id) || null),
    };
    return TeacherReferenceSchema.parse(mapped);
  }

  private static mapReferenceRatings(row: TeacherReferenceRow): TeacherReferenceRatings {
    return {
      communication: row.rating_communication,
      classroom: row.rating_classroom,
      planning: row.rating_planning,
      professionalism: row.rating_professionalism,
      parent_engagement: row.rating_parent_engagement,
      reliability: row.rating_reliability,
    };
  }

  private static async fetchSchoolNames(orgIds: string[]): Promise<Map<string, string>> {
    if (orgIds.length === 0) return new Map();
    const supabase = assertSupabase();

    const [preschools, organizations] = await Promise.all([
      supabase.from('preschools').select('id, name').in('id', orgIds),
      supabase.from('organizations').select('id, name').in('id', orgIds),
    ]);

    const map = new Map<string, string>();
    (preschools.data as SchoolNameRow[] | null)?.forEach((row) => {
      if (row.id && row.name) map.set(row.id, row.name);
    });
    (organizations.data as SchoolNameRow[] | null)?.forEach((row) => {
      if (row.id && row.name && !map.has(row.id)) map.set(row.id, row.name);
    });

    return map;
  }

  private static async fetchPrincipalNames(principalIds: string[]): Promise<Map<string, string>> {
    if (principalIds.length === 0) return new Map();
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', principalIds);

    if (error) throw error;

    const map = new Map<string, string>();
    (data as PrincipalNameRow[] | null)?.forEach((row) => {
      if (!row.id) return;
      const name = `${row.first_name || ''} ${row.last_name || ''}`.trim();
      if (name) map.set(row.id, name);
    });

    return map;
  }
}
