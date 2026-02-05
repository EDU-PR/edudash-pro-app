/**
 * Parent Children Utilities
 * 
 * Centralized logic for fetching children linked to a parent.
 * Supports multiple parents per child via student_parent_relationships table.
 */

import { assertSupabase } from '@/lib/supabase';

export interface ChildBasicInfo {
  id: string;
  student_id?: string | null;
  first_name: string;
  last_name: string;
  enrollment_date?: string | null;
  avatar_url?: string | null;
  date_of_birth: string | null;
  age_group_id?: string | null;
  age_group_ref?: string | null;
  age_group?: {
    id: string;
    name: string | null;
    age_min: number | null;
    age_max: number | null;
    min_age_months: number | null;
    max_age_months: number | null;
  } | null;
  age_group_ref_data?: {
    id: string;
    name: string | null;
    age_min: number | null;
    age_max: number | null;
    min_age_months: number | null;
    max_age_months: number | null;
  } | null;
  grade: string | null;
  grade_level?: string | null;
  class_id: string | null;
  preschool_id: string | null;
  organization_id?: string | null;
  is_active: boolean;
  parent_id: string | null;
  guardian_id: string | null;
  registration_fee_amount?: number | null;
  registration_fee_paid?: boolean | null;
  payment_verified?: boolean | null;
  classes?: { id: string; name: string; grade_level: string | null } | { id: string; name: string; grade_level: string | null }[] | null;
}

/**
 * Fetches all children linked to a parent.
 * 
 * Checks both:
 * 1. Direct link via students.parent_id or students.guardian_id
 * 2. Junction table student_parent_relationships for multi-parent support
 * 
 * Deduplicates results to avoid showing the same child twice.
 */
export async function fetchParentChildren(
  parentId: string,
  options?: {
    includeInactive?: boolean;
    schoolId?: string;
  }
): Promise<ChildBasicInfo[]> {
  const supabase = assertSupabase();
  const { includeInactive = false, schoolId } = options || {};

  try {
    // Resolve to internal profile id when caller provides auth user id.
    let resolvedParentId = parentId;
    let resolvedAuthUserId: string | null = null;

    const { data: profileById } = await supabase
      .from('profiles')
      .select('id, auth_user_id')
      .eq('id', parentId)
      .maybeSingle();

    if (profileById?.id) {
      resolvedParentId = profileById.id;
      resolvedAuthUserId = profileById.auth_user_id ?? null;
    } else {
      const { data: profileByAuth } = await supabase
        .from('profiles')
        .select('id, auth_user_id')
        .eq('auth_user_id', parentId)
        .maybeSingle();

      if (profileByAuth?.id) {
        resolvedParentId = profileByAuth.id;
        resolvedAuthUserId = profileByAuth.auth_user_id ?? parentId;
      }
    }

    const parentFilters = [
      `parent_id.eq.${resolvedParentId}`,
      `guardian_id.eq.${resolvedParentId}`,
    ];

    if (resolvedAuthUserId && resolvedAuthUserId !== resolvedParentId) {
      parentFilters.push(`parent_id.eq.${resolvedAuthUserId}`);
      parentFilters.push(`guardian_id.eq.${resolvedAuthUserId}`);
    }

    // 1. Fetch children via direct parent_id/guardian_id link
    let directQuery = supabase
      .from('students')
      .select(`
        id, student_id, first_name, last_name, enrollment_date, date_of_birth, age_group_id, age_group_ref, grade, grade_level, class_id,
        preschool_id, organization_id, is_active, parent_id, guardian_id, avatar_url, registration_fee_amount, registration_fee_paid, payment_verified,
        age_group:age_groups!students_age_group_id_fkey(id, name, age_min, age_max, min_age_months, max_age_months),
        age_group_ref_data:age_groups!students_age_group_ref_fkey(id, name, age_min, age_max, min_age_months, max_age_months),
        classes!students_class_id_fkey(id, name, grade_level)
      `)
      .or(parentFilters.join(','));
    
    if (!includeInactive) {
      directQuery = directQuery.eq('is_active', true);
    }
    if (schoolId) {
      directQuery = directQuery.eq('preschool_id', schoolId);
    }

    const { data: directChildren, error: directError } = await directQuery;
    
    if (directError) {
      console.error('[fetchParentChildren] Direct query error:', directError);
    }

    // 2. Fetch children via junction table (supports multiple parents)
    const { data: relationships, error: relError } = await supabase
      .from('student_parent_relationships')
      .select('student_id')
      .eq('parent_id', resolvedParentId);

    if (relError) {
      console.error('[fetchParentChildren] Relationships query error:', relError);
    }

    let junctionChildren: ChildBasicInfo[] = [];
    if (relationships && relationships.length > 0) {
      const studentIds = relationships.map(r => r.student_id);
      
      let junctionQuery = supabase
        .from('students')
        .select(`
          id, student_id, first_name, last_name, enrollment_date, date_of_birth, age_group_id, age_group_ref, grade, grade_level, class_id,
          preschool_id, organization_id, is_active, parent_id, guardian_id, avatar_url, registration_fee_amount, registration_fee_paid, payment_verified,
          age_group:age_groups!students_age_group_id_fkey(id, name, age_min, age_max, min_age_months, max_age_months),
          age_group_ref_data:age_groups!students_age_group_ref_fkey(id, name, age_min, age_max, min_age_months, max_age_months),
          classes!students_class_id_fkey(id, name, grade_level)
        `)
        .in('id', studentIds);
      
      if (!includeInactive) {
        junctionQuery = junctionQuery.eq('is_active', true);
      }
      if (schoolId) {
        junctionQuery = junctionQuery.eq('preschool_id', schoolId);
      }

      const { data: junctionData, error: junctionError } = await junctionQuery;
      
      if (junctionError) {
        console.error('[fetchParentChildren] Junction query error:', junctionError);
      } else if (junctionData) {
        junctionChildren = junctionData.map((child) => {
          const normalized = child as Record<string, unknown>;
          const ageGroupValue = normalized.age_group;
          const ageGroupRefValue = normalized.age_group_ref_data;
          const classesValue = normalized.classes;

          return {
            ...child,
            age_group: Array.isArray(ageGroupValue) ? ageGroupValue[0] ?? null : ageGroupValue ?? null,
            age_group_ref_data: Array.isArray(ageGroupRefValue) ? ageGroupRefValue[0] ?? null : ageGroupRefValue ?? null,
            classes: Array.isArray(classesValue)
              ? classesValue
              : classesValue
                ? [classesValue]
                : null,
          } as ChildBasicInfo;
        });
      }
    }

    // 3. Combine and deduplicate
    const allChildren = [...(directChildren || []), ...junctionChildren];
    const uniqueChildren = deduplicateById(allChildren);

    return uniqueChildren as ChildBasicInfo[];
  } catch (error) {
    console.error('[fetchParentChildren] Error:', error);
    return [];
  }
}

/**
 * Deduplicates an array of objects by their `id` property.
 */
function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Links a second parent to a child via the junction table.
 * Used when both parents want app access for the same child.
 */
export async function linkParentToChild(
  parentId: string,
  studentId: string,
  options?: {
    relationshipType?: 'parent' | 'guardian' | 'step_parent' | 'other';
    isPrimary?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = assertSupabase();
  const { relationshipType = 'parent', isPrimary = false } = options || {};

  try {
    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('student_parent_relationships')
      .select('id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      return { success: true }; // Already linked
    }

    // Create the relationship
    const { error } = await supabase
      .from('student_parent_relationships')
      .insert({
        parent_id: parentId,
        student_id: studentId,
        relationship_type: relationshipType,
        is_primary: isPrimary,
      });

    if (error) {
      console.error('[linkParentToChild] Insert error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[linkParentToChild] Error:', error);
    return { success: false, error: 'Failed to link parent to child' };
  }
}

/**
 * Gets all parents linked to a specific child.
 * Useful for showing who has access to the child's information.
 */
export async function getChildParents(studentId: string): Promise<{
  parents: Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    relationship_type: string | null;
    is_primary: boolean;
  }>;
}> {
  const supabase = assertSupabase();

  try {
    // Get from junction table
    const { data: relationships, error: relError } = await supabase
      .from('student_parent_relationships')
      .select(`
        relationship_type,
        is_primary,
        profiles!fk_parent(id, email, first_name, last_name)
      `)
      .eq('student_id', studentId);

    if (relError) {
      console.error('[getChildParents] Relationships error:', relError);
    }

    // Get from direct link on students table
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        parent_id,
        guardian_id,
        parent:profiles!students_parent_id_fkey(id, email, first_name, last_name),
        guardian:profiles!students_guardian_id_fkey(id, email, first_name, last_name)
      `)
      .eq('id', studentId)
      .single();

    if (studentError) {
      console.error('[getChildParents] Student error:', studentError);
    }

    const parents: Array<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      relationship_type: string | null;
      is_primary: boolean;
    }> = [];

    const seenIds = new Set<string>();

    // Add from direct links
    if (student?.parent && !seenIds.has((student.parent as any).id)) {
      seenIds.add((student.parent as any).id);
      parents.push({
        ...(student.parent as any),
        relationship_type: 'parent',
        is_primary: true,
      });
    }
    if (student?.guardian && !seenIds.has((student.guardian as any).id)) {
      seenIds.add((student.guardian as any).id);
      parents.push({
        ...(student.guardian as any),
        relationship_type: 'guardian',
        is_primary: student.parent_id !== student.guardian_id,
      });
    }

    // Add from junction table
    if (relationships) {
      for (const rel of relationships) {
        const profile = (rel as any).profiles;
        if (profile && !seenIds.has(profile.id)) {
          seenIds.add(profile.id);
          parents.push({
            id: profile.id,
            email: profile.email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            relationship_type: rel.relationship_type,
            is_primary: rel.is_primary || false,
          });
        }
      }
    }

    return { parents };
  } catch (error) {
    console.error('[getChildParents] Error:', error);
    return { parents: [] };
  }
}
