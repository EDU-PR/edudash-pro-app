-- Migration: Add tertiary education roles (admin, instructor, student)
-- Date: 2025-12-02
-- Purpose: Enable separate dashboard for adult learning centers

-- Drop the existing role check constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with all roles including tertiary ones
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN (
  'parent',       -- Preschool/K-12 parent
  'teacher',      -- Preschool/K-12 teacher
  'principal',    -- Preschool/K-12 school head
  'superadmin',   -- Platform superadmin
  'admin',        -- Tertiary education admin (manages adult learning centers)
  'instructor',   -- Tertiary education facilitator (teaches courses)
  'student'       -- Tertiary education student (18+ self-managed learner)
));

-- Update existing users who should be tertiary admins
-- (Organizations managing multiple adult training centers)
UPDATE public.profiles
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email IN (
  'davecon12martin@outlook.com'  -- SOA / Inviro wise admin
)
AND role = 'principal';

-- Add comment for future reference
COMMENT ON COLUMN public.profiles.role IS 
'User role: parent/teacher/principal/superadmin (K-12), admin/instructor/student (tertiary)';
