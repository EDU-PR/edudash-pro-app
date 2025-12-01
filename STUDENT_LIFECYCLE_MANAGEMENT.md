# Student Lifecycle Management - Enrollment to Exit

## Overview
This document explains how students are enrolled, managed, and what happens when they leave the preschool.

---

## Current Student Status Types

Based on the `students` table schema:
```sql
status VARCHAR(50) DEFAULT 'registered'
```

### Status Values:
- **`registered`** - Initial status when created
- **`active`** - Currently enrolled and attending
- **`inactive`** - Temporarily not attending
- **`graduated`** - Successfully completed program
- **`withdrawn`** - Left before completion
- **`transferred`** - Moved to another school
- **`pending`** - Awaiting approval/payment

---

## Enrollment Methods

### Method 1: Parent Registration Form (EduSitePro)
**Process:**
1. Parent fills registration form on website
2. Creates entry in `registration_requests` table
3. Principal reviews and approves
4. System creates `students` record with status='active'
5. Links to parent via `parent_id` field

**Tables:**
- `registration_requests` (EduSitePro database)
- `students` (EduDashPro database)

### Method 2: Principal Direct Enrollment ✅ (NEEDED)
**Use Cases:**
- Existing students from previous years
- Walk-in registrations
- Emergency enrollments
- Sibling enrollments (parent already exists)

**Current Status:** ❌ **NO UI EXISTS**

**Required Page:** `/dashboard/principal/students/enroll`

**What's Needed:**
- Form to manually add student
- Link to existing parent OR create parent placeholder
- Set class, status, enrollment date
- Upload documents
- No approval process needed (principal does it directly)

---

## Student Exit/Departure Flow

### Current Issues:
1. ❌ No formal "departure" or "exit" process
2. ❌ Status change doesn't trigger parent notification
3. ❌ Historical data not archived properly
4. ❌ Reports don't differentiate by academic year

### What Should Happen When a Child Leaves:

#### Option A: Status Change (Recommended)
**Pros:**
- Preserves all historical data
- Can still run reports on past students
- Parents can still view historical homework/grades
- Simple to implement

**Steps:**
1. Principal marks student as `graduated` or `withdrawn`
2. System:
   - Removes from active class roster
   - Notifies parent (optional)
   - Hides from active student lists
   - Keeps in historical reports
   - Archives homework submissions

#### Option B: Soft Delete
**Pros:**
- Cleaner active data
- Can be restored if mistake

**Cons:**
- More complex queries
- Risk of data loss

**Steps:**
1. Add `deleted_at` timestamp to students table
2. Set `deleted_at = NOW()` instead of hard delete
3. Filter active queries: `WHERE deleted_at IS NULL`

#### Option C: Hard Delete (NOT RECOMMENDED)
**Cons:**
- Loses all historical data
- Breaks foreign key relationships
- Cannot generate alumni reports
- Parent loses access to child's records

---

## Recommended Implementation

### 1. Update Students Table
```sql
-- Add graduation/exit tracking
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS exit_date DATE,
ADD COLUMN IF NOT EXISTS exit_reason TEXT,
ADD COLUMN IF NOT EXISTS next_school TEXT;

-- Status should already exist as:
-- status VARCHAR(50) DEFAULT 'registered'
```

### 2. Create Status Transition Rules
```sql
-- Valid status transitions
-- registered → active (enrollment confirmed)
-- active → inactive (temporary leave)
-- inactive → active (returns)
-- active → graduated (completed program)
-- active → withdrawn (left early)
-- active → transferred (moved to another school)
```

### 3. Principal Student Management UI

#### `/dashboard/principal/students/enroll` (NEW PAGE)
**Features:**
- Add new student form
- Search and link existing parent
- Create parent placeholder if needed
- Assign to class immediately
- Upload initial documents

#### `/dashboard/principal/students/[id]/edit` (ENHANCE)
**Add:**
- Status change dropdown
- Exit date picker (when status changes to graduated/withdrawn/transferred)
- Exit reason field
- Next school field (for transfers)
- "Archive Student" button with confirmation

#### `/dashboard/principal/students` (ENHANCE)
**Add:**
- Filter by status (active, inactive, graduated, withdrawn)
- Filter by academic year
- "View Alumni" toggle
- Bulk status change

---

## Academic Year Management

### Problem:
Each year, you want to:
1. Graduate current students
2. Enroll new students
3. Keep historical data separate
4. Not disrupt database

### Solution: Academic Year Field
```sql
-- Already exists in students table:
academic_year VARCHAR(10) DEFAULT '2026'
```

**Workflow:**
1. **End of Year (Dec):**
   - Principal clicks "Promote/Graduate Students"
   - System shows list of eligible students
   - Bulk action: 
     - Grade R-2 → status='graduated', exit_date=today
     - Grade R → promoted to Grade 1 (updates class_id)
   - Historical data preserved with academic_year='2026'

2. **Start of New Year (Jan):**
   - Change default academic_year to '2027'
   - New enrollments get academic_year='2027'
   - Reports can filter by year

3. **Queries:**
   ```sql
   -- Current year active students
   SELECT * FROM students 
   WHERE academic_year = '2027' 
   AND status = 'active';
   
   -- Alumni (past students)
   SELECT * FROM students 
   WHERE status IN ('graduated', 'withdrawn', 'transferred')
   AND academic_year < '2027';
   ```

---

## Report Generation Without Disrupting Database

### Year-End Reports (Before Status Changes)
**Before graduating students, generate:**
1. Class rosters with final grades
2. Attendance reports
3. Homework completion reports
4. Achievement reports
5. Progress reports

**SQL Example:**
```sql
-- Generate report for specific academic year
SELECT 
  s.student_id,
  s.first_name,
  s.last_name,
  s.status,
  s.academic_year,
  c.name as class_name,
  COUNT(hw.id) as homework_completed,
  AVG(hw.grade) as average_grade
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN homework_submissions hw ON s.id = hw.student_id
WHERE s.academic_year = '2026'
  AND s.preschool_id = 'YOUR_PRESCHOOL_ID'
GROUP BY s.id, s.student_id, s.first_name, s.last_name, s.status, s.academic_year, c.name
ORDER BY c.name, s.last_name;
```

### After Status Changes
Reports still work because:
- Status is included in queries
- Academic year filters data
- Historical records preserved

---

## Parent Access After Child Leaves

### Recommended Approach:
**Keep Parent Access with "View Only" Mode**

**What Parents Can See:**
- ✅ Historical homework submissions
- ✅ Past grades and feedback
- ✅ Achievement records
- ✅ Attendance history
- ✅ Messages from teachers (archived)
- ❌ Cannot submit new homework
- ❌ Cannot register for events
- ❌ Cannot send new messages

**Implementation:**
```typescript
// In parent hooks/queries
const isChildActive = child.status === 'active';

// Show "View Only" banner if not active
if (!isChildActive) {
  return <Banner>This child has graduated/left. You're viewing historical records.</Banner>
}

// Disable submission forms
<SubmitButton disabled={!isChildActive}>
  {isChildActive ? 'Submit Homework' : 'Child Not Active'}
</SubmitButton>
```

---

## Migration Plan for Existing Students

### For Your Current Year Students:
```sql
-- Step 1: Backup current data
CREATE TABLE students_backup_2026 AS 
SELECT * FROM students 
WHERE preschool_id = 'YOUR_PRESCHOOL_ID';

-- Step 2: Update existing students with academic_year
UPDATE students 
SET academic_year = '2026'
WHERE academic_year IS NULL 
  AND preschool_id = 'YOUR_PRESCHOOL_ID';

-- Step 3: Generate year-end reports (use SQL above)

-- Step 4: Mark leaving students
UPDATE students 
SET status = 'graduated',
    exit_date = '2026-12-31',
    exit_reason = 'Completed Grade R-2 program'
WHERE id IN ('student_id_1', 'student_id_2', ...)
  AND preschool_id = 'YOUR_PRESCHOOL_ID';

-- Step 5: Promote continuing students (if applicable)
-- Update their class_id to next grade
```

---

## Files to Create/Modify

### New Files:
1. `/web/src/app/dashboard/principal/students/enroll/page.tsx` - Manual enrollment form
2. `/web/src/app/dashboard/principal/students/year-end/page.tsx` - Bulk graduate/promote
3. `/web/src/components/dashboard/principal/StudentStatusManager.tsx` - Status change component

### Modify Files:
1. `/web/src/app/dashboard/principal/students/page.tsx` - Add filters (status, year)
2. `/web/src/app/dashboard/principal/students/[id]/page.tsx` - Add exit management
3. `/web/src/app/dashboard/principal/reports/page.tsx` - Add alumni reports

### Database:
```sql
-- Add if missing:
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS exit_date DATE,
ADD COLUMN IF NOT EXISTS exit_reason TEXT,
ADD COLUMN IF NOT EXISTS next_school TEXT;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_students_status_year 
ON students(status, academic_year, preschool_id);
```

---

## Summary

### Current State:
- ✅ Students table exists with status field
- ✅ Academic year field exists
- ❌ No principal enrollment form
- ❌ No exit management process
- ❌ No year-end bulk actions

### Immediate Actions Needed:
1. **Build `/dashboard/principal/students/enroll` page** - Allow principals to manually add students
2. **Add status management** - Dropdown to change status to graduated/withdrawn/transferred
3. **Add exit date tracking** - Record when and why student left
4. **Filter by academic year** - Separate current from historical students

### For Year-End:
1. Generate all reports **before** changing statuses
2. Bulk update leaving students to 'graduated' status
3. Set exit_date = end of academic year
4. New students get academic_year='2027'
5. Parents keep view-only access to historical data

This approach ensures:
- ✅ No data loss
- ✅ Historical reports work
- ✅ Database stays clean
- ✅ Parents retain records access
- ✅ Easy to manage year-over-year
