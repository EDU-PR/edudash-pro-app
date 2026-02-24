-- Add delivery_mode to lesson_assignments
-- Distinguishes classroom activities from student digital/take-home assignments.
--
-- delivery_mode values:
--   class_activity  — teacher-led, delivered in class; parents see it as informational
--   playground      — digital Dash Playground activity the student does on their device
--   take_home       — parent-guided home reinforcement activity

ALTER TABLE lesson_assignments
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'class_activity'
    CHECK (delivery_mode IN ('class_activity', 'playground', 'take_home'));

-- Back-fill existing rows: assignments with a playground activity → 'playground', rest → 'class_activity'
UPDATE lesson_assignments
  SET delivery_mode = CASE
    WHEN interactive_activity_id IS NOT NULL THEN 'playground'
    ELSE 'class_activity'
  END
WHERE delivery_mode = 'class_activity';

-- Index for the common filtered queries
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_delivery_mode
  ON lesson_assignments (delivery_mode);

CREATE INDEX IF NOT EXISTS idx_lesson_assignments_student_delivery
  ON lesson_assignments (student_id, delivery_mode)
  WHERE student_id IS NOT NULL;
