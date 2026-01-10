# Zanele Parent-Child Link Issue - Root Cause Analysis

## Date: 2026-01-10

## Problem
**Parent**: zanelelwndl@gmail.com (Zanele)  
**Child**: Mbali Skosana  
**Issue**: Zanele cannot see her child in the parent dashboard

## Root Cause

### Database Architecture Issue
The `parent_child_links` table has foreign key constraints that reference the `users` table:
```sql
parent_child_links.parent_id -> users.id
parent_child_links.child_id -> users.id
```

However, the application primarily uses the `profiles` table for user management, and Zanele only exists in `profiles`, not in `users`.

### Current State:
1. **Zanele's Profile**:
   - `profiles.id`: `150f8d13-1b32-48e9-a37c-cf562459030b`
   - `profiles.email`: `zanelelwndl@gmail.com`
   - `profiles.auth_user_id`: NULL
   - **NOT in `users` table**

2. **Mbali's Student Record**:
   - `students.id`: `074692f3-f5a3-4fea-977a-b726828e5067`
   - `students.first_name`: Mbali
   - `students.last_name`: Skosana
   - `students.preschool_id`: `ba79097c-1b93-4b48-bcbe-df73878ab4d1` (Young Eagles)
   - `students.class_id`: `ac257aa6-bb6a-47b6-9fce-d3c724b120b9` (Curious Cubs)

3. **parent_child_links Table**:
   - NO records linking Zanele to Mbali
   - Cannot create link due to foreign key constraint failure

## Table Structure Mismatch

### Legacy Architecture:
- `users` table - appears to be a custom table (not auth.users)
- Only contains 4 users currently
- Seems to be legacy/unused

### Current Architecture:
- `profiles` table - main user management
- References `auth.users` (Supabase Auth)
- All active users exist here

### Constraint Problem:
```sql
ALTER TABLE parent_child_links
  ADD CONSTRAINT parent_child_links_parent_id_fkey 
  FOREIGN KEY (parent_id) REFERENCES users(id);
```

This should reference `profiles(id)` or the constraint should be removed/updated.

## Attempted Fixes

### Attempt 1: Create link with 'mother' relationship
```sql
ERROR: check constraint "parent_child_links_relationship_check" violated
-- Valid values: ['parent', 'guardian', 'caregiver', 'grandparent']
```

### Attempt 2: Create link with 'parent' relationship
```sql
ERROR: foreign key constraint "parent_child_links_parent_id_fkey" violated
-- Zanele doesn't exist in users table
```

## Solutions

### Option 1: Update Foreign Key Constraints (Recommended)
```sql
-- Drop existing constraints
ALTER TABLE parent_child_links 
  DROP CONSTRAINT IF EXISTS parent_child_links_parent_id_fkey,
  DROP CONSTRAINT IF EXISTS parent_child_links_child_id_fkey;

-- Add new constraints referencing profiles
ALTER TABLE parent_child_links
  ADD CONSTRAINT parent_child_links_parent_id_fkey 
    FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- child_id should still reference students, not users
ALTER TABLE parent_child_links
  ADD CONSTRAINT parent_child_links_child_id_fkey 
    FOREIGN KEY (child_id) REFERENCES students(id) ON DELETE CASCADE;
```

### Option 2: Populate users table (Not Recommended - Legacy Table)
```sql
-- Insert Zanele into users table
-- NOT RECOMMENDED - users table appears to be deprecated
```

### Option 3: Remove Foreign Key Constraints (Quick Fix)
```sql
-- Remove constraints entirely
ALTER TABLE parent_child_links 
  DROP CONSTRAINT IF EXISTS parent_child_links_parent_id_fkey,
  DROP CONSTRAINT IF EXISTS parent_child_links_child_id_fkey;

-- Then create link without constraint checks
-- RISKY - no referential integrity
```

## Recommended Action Plan

1. **Immediate**: Update foreign key constraints to reference correct tables
2. **Create Link**: Add Zanele-Mbali link after constraint fix
3. **Audit**: Check all other parent-child links for similar issues
4. **Migrate**: Consider migrating any remaining `users` table data to `profiles`

## Additional Findings

### Valid Relationship Types:
- 'parent'
- 'guardian'
- 'caregiver'
- 'grandparent'

### parent_child_links Columns:
- `id` (uuid, primary key)
- `parent_id` (uuid, FK to users - SHOULD BE profiles)
- `child_id` (uuid, FK to users - SHOULD BE students)
- `relationship` (text, CHECK constraint)
- `is_primary` (boolean)
- `can_pick_up` (boolean)
- `emergency_contact` (boolean)
- `created_at`, `updated_at` (timestamps)

## Related Documentation
See: `docs/YOUTH_WING_REGISTRATION_FLOW.md` for member registration analysis

---

## Next Steps
1. Create migration to fix foreign key constraints
2. Create parent-child link for Zanele
3. Test parent dashboard displays Mbali
4. Audit all existing parent-child links
