-- Fix vw_teacher_overview to correctly join classes with teachers
-- Issue: The view was joining classes.teacher_id with public.users.id,
--        but classes.teacher_id actually stores auth.users.id
-- Fix: Join directly with teachers.user_id (which stores auth.users.id)

CREATE OR REPLACE VIEW vw_teacher_overview AS
SELECT 
    t.id AS teacher_id,
    t.user_id AS teacher_auth_user_id,
    t.user_id AS public_user_id,  -- Keep same name for backward compatibility
    t.email,
    t.preschool_id,
    COALESCE(COUNT(DISTINCT c.id), 0)::integer AS class_count,
    COALESCE(COUNT(s.id), 0)::integer AS student_count,
    COALESCE(string_agg(DISTINCT c.name, ', ' ORDER BY c.name), '')::text AS classes_text
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id 
    AND c.active = true 
    AND c.preschool_id = t.preschool_id
LEFT JOIN students s ON s.class_id = c.id 
    AND s.is_active = true 
    AND s.preschool_id = t.preschool_id
WHERE t.is_active = true 
    AND t.preschool_id = current_preschool_id()
GROUP BY t.id, t.user_id, t.email, t.preschool_id;

COMMENT ON VIEW vw_teacher_overview IS 
'Teacher overview with class and student counts. Uses RLS via current_preschool_id(). 
Fixed on 2026-01-12: Changed join from public.users to teachers.user_id for correct class matching.';
