# Parent Calendar System - Data Flow & Integration

## Overview
The parent calendar page displays school events and homework due dates for their children. The data flows from school administrators/teachers to parents.

## How Parents Access the Calendar

### 1. Navigation Options:
- **Quick Actions Grid**: Calendar tile on main dashboard (organization-linked parents only)
- **Direct URL**: `/dashboard/parent/calendar`
- **Mobile Navigation**: Calendar icon in sidebar

### 2. Display Modes:
- **Month View**: Visual calendar grid showing events by day
- **List View**: Chronological list of upcoming events
- Toggle button to switch between views

---

## Data Sources

### Primary Tables:

#### 1. `class_events` Table
**Created by**: Principals, Teachers (future feature)
**Structure**:
```sql
class_events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  event_type TEXT CHECK (event_type IN ('class', 'school', 'personal', 'exam')),
  class_id UUID REFERENCES classes(id),
  preschool_id UUID REFERENCES preschools(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

**Access Flow**:
1. Parent's child → `students.class_id`
2. Filter `class_events` WHERE `class_id` = child's class
3. Show events for next 30 days

#### 2. `homework_assignments` Table (Secondary Source)
**Shows as calendar events**: Homework due dates
**Structure**:
```sql
homework_assignments (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  class_id UUID REFERENCES classes(id),
  ...
)
```

**Access Flow**:
1. Get homework WHERE `class_id` = child's class AND `due_date` >= today
2. Check `homework_submissions` to exclude completed homework
3. Display remaining homework as "Due" events on calendar

---

## Principal Dashboard Integration

### ⚠️ **Current Status**: Class Events Creation NOT Yet Implemented

The calendar is **ready to display events**, but principals/teachers don't yet have a UI to create `class_events`.

### Required Feature: Event Management Dashboard

#### For Principals (`/dashboard/principal/events`):
**Needed Features**:
- ✅ Create school-wide events (all classes in preschool)
- ✅ Create class-specific events
- ✅ Edit/delete events
- ✅ Set event types: class, school, exam, personal
- ✅ Recurring events (optional)

#### For Teachers (`/dashboard/teacher/events`):
**Needed Features**:
- ✅ Create events for their assigned classes
- ✅ View school-wide events (read-only)
- ✅ Link events to specific lessons/homework

---

## RLS Policies Required

### `class_events` RLS:
```sql
-- Parents can view events for their children's classes
CREATE POLICY "parents_view_class_events" ON class_events
FOR SELECT USING (
  class_id IN (
    SELECT class_id FROM students 
    WHERE parent_id = auth.uid()
  )
);

-- Principals can manage events for their preschool
CREATE POLICY "principals_manage_events" ON class_events
FOR ALL USING (
  preschool_id IN (
    SELECT preschool_id FROM profiles 
    WHERE id = auth.uid() AND role = 'principal'
  )
);

-- Teachers can manage events for their classes
CREATE POLICY "teachers_manage_class_events" ON class_events
FOR ALL USING (
  class_id IN (
    SELECT id FROM classes 
    WHERE teacher_id = auth.uid()
  )
);
```

---

## Implementation Roadmap

### Phase 1: ✅ **Parent View (COMPLETE)**
- [x] Calendar page with month/list views
- [x] Display homework due dates
- [x] Hook: `useChildCalendarEvents`
- [x] Navigation from dashboard
- [x] Child selector for multi-child families

### Phase 2: 🔨 **Principal Event Management (NEEDED)**
- [ ] Create `/dashboard/principal/events` page
- [ ] Event creation form with:
  - Event title, description
  - Start/end date & time
  - Event type selector
  - Class selector (or all classes)
  - Recurring event options
- [ ] Event list with edit/delete actions
- [ ] Calendar view for principals

### Phase 3: 🔨 **Teacher Event Management (NEEDED)**
- [ ] Create `/dashboard/teacher/events` page
- [ ] Similar to principal but limited to assigned classes
- [ ] Link events to lesson plans

### Phase 4: 🔮 **Advanced Features (FUTURE)**
- [ ] Parent event reminders (push notifications)
- [ ] RSVP for events
- [ ] Export to Google Calendar / iCal
- [ ] Attach files/documents to events
- [ ] Event comments/discussion

---

## Quick Start: Creating Events Manually

Until the admin UI is built, principals can create events via SQL:

```sql
-- Example: Create a school-wide event
INSERT INTO class_events (
  title, 
  description,
  start_time,
  end_time,
  event_type,
  class_id,
  preschool_id,
  created_by
) VALUES (
  'Parent-Teacher Meeting',
  'Annual parent-teacher meetings for all grades',
  '2025-12-15 14:00:00+02',
  '2025-12-15 16:00:00+02',
  'school',
  NULL, -- NULL means all classes
  'YOUR_PRESCHOOL_ID',
  'PRINCIPAL_USER_ID'
);

-- Example: Create a class-specific event
INSERT INTO class_events (
  title,
  description,
  start_time,
  end_time,
  event_type,
  class_id,
  preschool_id,
  created_by
) VALUES (
  'Math Exam',
  'End of term mathematics exam',
  '2025-12-20 09:00:00+02',
  '2025-12-20 11:00:00+02',
  'exam',
  'CLASS_ID_HERE',
  'YOUR_PRESCHOOL_ID',
  'TEACHER_USER_ID'
);
```

---

## Testing the Calendar

### 1. Verify Parent Can See Events:
```sql
-- Check what events a specific parent should see
SELECT 
  ce.title,
  ce.start_time,
  ce.event_type,
  c.name as class_name
FROM class_events ce
LEFT JOIN classes c ON ce.class_id = c.id
WHERE ce.class_id IN (
  SELECT class_id FROM students WHERE parent_id = 'PARENT_USER_ID'
)
ORDER BY ce.start_time;
```

### 2. Add Test Events:
Use the SQL examples above to add sample events, then:
1. Login as parent
2. Navigate to `/dashboard/parent/calendar`
3. Select child (if multiple)
4. Toggle between month/list view
5. Verify events appear correctly

---

## File Locations

### Frontend:
- **Page**: `/web/src/app/dashboard/parent/calendar/page.tsx`
- **Hook**: `/web/src/lib/hooks/parent/useCalendar.ts`
- **Navigation**: `/web/src/components/dashboard/parent/QuickActionsGrid.tsx` (line 34)

### Backend (Future):
- **Principal Events**: `/web/src/app/dashboard/principal/events/page.tsx` (TO CREATE)
- **Teacher Events**: `/web/src/app/dashboard/teacher/events/page.tsx` (TO CREATE)

### Database:
- **Migration**: Find or create migration for `class_events` table
- **RLS Policies**: Add policies as shown above

---

## Summary

✅ **What Works Now:**
- Parents can view calendar
- Homework due dates display automatically
- Month/list view toggles
- Child selector

❌ **What's Missing:**
- Principals can't create events via UI (must use SQL)
- Teachers can't create events
- No event editing/deletion UI
- No recurring events support

🎯 **Next Steps:**
1. Create principal event management page
2. Add RLS policies for class_events
3. Test with real school events
4. Add teacher event creation later
