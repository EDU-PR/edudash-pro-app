-- Seed Default Preschool Lessons for First Term
-- Date: 2026-01-11
-- Purpose: Provide preschool teachers with ready-to-use lessons for the first term
-- WARP.md Compliance: Database migration for default content

DO $$
DECLARE
  has_preschools boolean;
  has_profiles boolean;
  has_lessons boolean;
  has_preschool_name boolean;
  has_preschool_active boolean;
  has_profile_active boolean;
  profile_active_filter text := '';
  preschool_record RECORD;
  teacher_id uuid;
  teacher_query text;
BEGIN
  has_preschools := to_regclass('public.preschools') IS NOT NULL;
  has_profiles := to_regclass('public.profiles') IS NOT NULL;
  has_lessons := to_regclass('public.lessons') IS NOT NULL;

  IF NOT has_preschools OR NOT has_profiles OR NOT has_lessons THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'preschools'
      AND column_name = 'name'
  ) INTO has_preschool_name;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'preschools'
      AND column_name = 'is_active'
  ) INTO has_preschool_active;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'is_active'
  ) INTO has_profile_active;

  IF NOT has_preschool_name OR NOT has_preschool_active THEN
    RETURN;
  END IF;

  IF has_profile_active THEN
    profile_active_filter := 'AND is_active = true';
  END IF;

  teacher_query := format(
    'SELECT id FROM profiles WHERE (preschool_id = $1 OR organization_id = $1)
      AND role IN (''teacher'', ''principal'', ''principal_admin'') %s
     ORDER BY
       CASE role
         WHEN ''teacher'' THEN 1
         WHEN ''principal'' THEN 2
         WHEN ''principal_admin'' THEN 2
         ELSE 3
       END,
       created_at ASC
     LIMIT 1',
    profile_active_filter
  );

  FOR preschool_record IN
    EXECUTE 'SELECT id, name FROM preschools WHERE is_active = true'
  LOOP
    teacher_id := NULL;
    EXECUTE teacher_query INTO teacher_id USING preschool_record.id;

    IF teacher_id IS NULL THEN
      RAISE NOTICE 'No teacher found for preschool: % (%)', preschool_record.name, preschool_record.id;
      CONTINUE;
    END IF;

    RAISE NOTICE 'Creating default lessons for preschool: % (%) with teacher: %', preschool_record.name, preschool_record.id, teacher_id;

    INSERT INTO lessons (
      id,
      preschool_id,
      teacher_id,
      title,
      description,
      content,
      objectives,
      age_group,
      subject,
      duration_minutes,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      preschool_record.id,
      teacher_id,
      'Welcome to Preschool - My First Day',
      'A warm welcome lesson to help children feel comfortable and excited about preschool',
      '{"sections": [{"title": "Introduction", "content": "Welcome circle time with name games"}, {"title": "Activity", "content": "Draw and share about yourself"}, {"title": "Closing", "content": "Sing welcome songs together"}]}'::jsonb,
      ARRAY['Feel comfortable in new environment', 'Learn classmates names', 'Express themselves creatively'],
      '3-6',
      'general',
      30,
      'active',
      NOW(),
      NOW()
    );

    INSERT INTO lessons (
      id,
      preschool_id,
      teacher_id,
      title,
      description,
      content,
      objectives,
      age_group,
      subject,
      duration_minutes,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      preschool_record.id,
      teacher_id,
      'Colors and Shapes Adventure',
      'Learn basic colors and shapes through fun activities and games',
      '{"sections": [{"title": "Introduction", "content": "Color and shape flashcards"}, {"title": "Activity", "content": "Shape sorting and color matching games"}, {"title": "Art", "content": "Create colorful shape collages"}]}'::jsonb,
      ARRAY['Identify basic colors', 'Recognize common shapes', 'Match shapes and colors'],
      '3-6',
      'art',
      35,
      'active',
      NOW(),
      NOW()
    );

    INSERT INTO lessons (
      id,
      preschool_id,
      teacher_id,
      title,
      description,
      content,
      objectives,
      age_group,
      subject,
      duration_minutes,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      preschool_record.id,
      teacher_id,
      'Counting Fun - Numbers 1 to 10',
      'Introduction to numbers and counting through songs, games, and hands-on activities',
      '{"sections": [{"title": "Introduction", "content": "Number songs and finger counting"}, {"title": "Activity", "content": "Count objects in groups"}, {"title": "Practice", "content": "Number recognition games"}]}'::jsonb,
      ARRAY['Count from 1 to 10', 'Recognize number symbols', 'Count objects accurately'],
      '3-6',
      'mathematics',
      30,
      'active',
      NOW(),
      NOW()
    );

    INSERT INTO lessons (
      id,
      preschool_id,
      teacher_id,
      title,
      description,
      content,
      objectives,
      age_group,
      subject,
      duration_minutes,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      preschool_record.id,
      teacher_id,
      'Letter Sounds - A, B, C',
      'Introduction to letter sounds and phonics through interactive activities',
      '{"sections": [{"title": "Introduction", "content": "Letter flashcards and sounds"}, {"title": "Activity", "content": "Find objects starting with A, B, C"}, {"title": "Practice", "content": "Letter tracing and sound games"}]}'::jsonb,
      ARRAY['Recognize letters A, B, C', 'Learn letter sounds', 'Identify words starting with these letters'],
      '4-5',
      'literacy',
      35,
      'active',
      NOW(),
      NOW()
    );

    INSERT INTO lessons (
      id,
      preschool_id,
      teacher_id,
      title,
      description,
      content,
      objectives,
      age_group,
      subject,
      duration_minutes,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      preschool_record.id,
      teacher_id,
      'Exploring Nature - Plants and Animals',
      'Discover the natural world through observation and exploration',
      '{"sections": [{"title": "Introduction", "content": "Nature walk and observation"}, {"title": "Activity", "content": "Plant seeds and observe growth"}, {"title": "Discussion", "content": "Talk about different animals and their habitats"}]}'::jsonb,
      ARRAY['Observe nature', 'Learn about plants', 'Identify common animals'],
      '3-6',
      'science',
      40,
      'active',
      NOW(),
      NOW()
    );

    INSERT INTO lessons (
          id,
          preschool_id,
          teacher_id,
          title,
          description,
          content,
          objectives,
          age_group,
          subject,
          duration_minutes,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          preschool_record.id,
          teacher_id,
          'Colors and Shapes Adventure',
          'Learn basic colors and shapes through fun activities and games',
          '{"sections": [{"title": "Introduction", "content": "Color and shape flashcards"}, {"title": "Activity", "content": "Shape sorting and color matching games"}, {"title": "Art", "content": "Create colorful shape collages"}]}'::jsonb,
          ARRAY['Identify basic colors', 'Recognize common shapes', 'Match shapes and colors'],
          '3-6',
          'art',
          35,
          'active',
          NOW(),
          NOW()
        );

        INSERT INTO lessons (
          id,
          preschool_id,
          teacher_id,
          title,
          description,
          content,
          objectives,
          age_group,
          subject,
          duration_minutes,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          preschool_record.id,
          teacher_id,
          'Counting Fun - Numbers 1 to 10',
          'Introduction to numbers and counting through songs, games, and hands-on activities',
          '{"sections": [{"title": "Introduction", "content": "Number songs and finger counting"}, {"title": "Activity", "content": "Count objects in groups"}, {"title": "Practice", "content": "Number recognition games"}]}'::jsonb,
          ARRAY['Count from 1 to 10', 'Recognize number symbols', 'Count objects accurately'],
          '3-6',
          'mathematics',
          30,
          'active',
          NOW(),
          NOW()
        );

        INSERT INTO lessons (
          id,
          preschool_id,
          teacher_id,
          title,
          description,
          content,
          objectives,
          age_group,
          subject,
          duration_minutes,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          preschool_record.id,
          teacher_id,
          'Letter Sounds - A, B, C',
          'Introduction to letter sounds and phonics through interactive activities',
          '{"sections": [{"title": "Introduction", "content": "Letter flashcards and sounds"}, {"title": "Activity", "content": "Find objects starting with A, B, C"}, {"title": "Practice", "content": "Letter tracing and sound games"}]}'::jsonb,
          ARRAY['Recognize letters A, B, C', 'Learn letter sounds', 'Identify words starting with these letters'],
          '4-5',
          'literacy',
          35,
          'active',
          NOW(),
          NOW()
        );

        INSERT INTO lessons (
          id,
          preschool_id,
          teacher_id,
          title,
          description,
          content,
          objectives,
          age_group,
          subject,
          duration_minutes,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          preschool_record.id,
          teacher_id,
          'Exploring Nature - Plants and Animals',
          'Discover the natural world through observation and exploration',
          '{"sections": [{"title": "Introduction", "content": "Nature walk and observation"}, {"title": "Activity", "content": "Plant seeds and observe growth"}, {"title": "Discussion", "content": "Talk about different animals and their habitats"}]}'::jsonb,
          ARRAY['Observe nature', 'Learn about plants', 'Identify common animals'],
          '3-6',
          'science',
          40,
          'active',
          NOW(),
          NOW()
        );

        INSERT INTO lessons (
          id,
          preschool_id,
          teacher_id,
          title,
          description,
          content,
          objectives,
          age_group,
          subject,
          duration_minutes,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          preschool_record.id,
          teacher_id,
          'Sharing and Caring - Social Skills',
          'Learn important social skills like sharing, taking turns, and being kind',
          '{"sections": [{"title": "Story", "content": "Read stories about sharing"}, {"title": "Role Play", "content": "Practice sharing scenarios"}, {"title": "Activity", "content": "Group activities requiring cooperation"}]}'::jsonb,
          ARRAY['Understand the importance of sharing', 'Practice taking turns', 'Show kindness to others'],
          '3-6',
          'general',
          30,
          'active',
          NOW(),
          NOW()
        );

        INSERT INTO lessons (
          id,
          preschool_id,
          teacher_id,
          title,
          description,
          content,
          objectives,
          age_group,
          subject,
          duration_minutes,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          preschool_record.id,
          teacher_id,
          'Music and Movement - Rhythm and Dance',
          'Explore music, rhythm, and movement through songs and dance',
          '{"sections": [{"title": "Warm-up", "content": "Stretching and movement exercises"}, {"title": "Music", "content": "Sing songs and play rhythm instruments"}, {"title": "Dance", "content": "Free movement and dance to music"}]}'::jsonb,
          ARRAY['Follow rhythm', 'Express through movement', 'Participate in group music activities'],
          '3-6',
          'music',
          30,
          'active',
          NOW(),
          NOW()
        );

    RAISE NOTICE 'Created 7 default lessons for preschool: %', preschool_record.name;
  END LOOP;
END $$;
