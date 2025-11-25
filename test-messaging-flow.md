# Messaging Flow Test Checklist

## Prerequisites ✅
- [x] Teacher: katso@youngeagles.org.za assigned to 3 classes
- [x] Students: 3 students in teacher's classes
- [x] Parents: 3 parents linked to those students
- [x] Database: All tables and RLS policies in place

## Test Steps

### 1. Teacher Dashboard - View Parent Contacts
**Steps:**
1. Login as teacher: `katso@youngeagles.org.za`
2. Navigate to teacher dashboard
3. Find "Parent Contacts" widget
4. Verify you see exactly **3 parents**:
   - Kgaogelo Senabe (senabek4@gmail.com)
   - Marrion Makunyane (makunyanejayden@gmail.com)
   - Ikaneng Ngobeni (ikanengngobeni41@gmail.com)

**Expected Result:** ✅ 3 parents displayed with their children's names and classes

**Actual Result:** _[To be filled during test]_

---

### 2. Create Message Thread - Click Message Button
**Steps:**
1. In ParentContactsWidget, click the message icon next to any parent's student
2. System should:
   - Check if thread exists between teacher and parent for that student
   - Create new thread if none exists
   - Add both participants (teacher + parent)
   - Navigate to `/dashboard/teacher/messages/{threadId}`

**Expected Result:** ✅ Redirected to message thread page

**Actual Result:** _[To be filled during test]_

**Debug Console Logs to Check:**
```
- "Error creating/finding thread:" (should NOT appear)
- Network tab: POST to message_threads table
- Network tab: POST to message_participants table
```

---

### 3. Send First Message
**Steps:**
1. On message thread page, type a test message:
   ```
   Hello! This is a test message about your child's progress.
   ```
2. Click Send button
3. Message should appear in chat

**Expected Result:** 
- ✅ Message appears instantly
- ✅ Timestamp shows "Just now"
- ✅ Message shows on teacher's side (right-aligned)

**Actual Result:** _[To be filled during test]_

**Database Check:**
```sql
SELECT id, sender_id, content, created_at 
FROM messages 
WHERE thread_id = '[your-thread-id]'
ORDER BY created_at DESC 
LIMIT 1;
```

---

### 4. Test Real-Time Updates (Simulated)
**Steps:**
1. Open developer tools → Application → Storage
2. Check Supabase Realtime connection status
3. Send another message
4. Check if message appears without page refresh

**Expected Result:** ✅ Real-time subscription active, messages appear instantly

**Console Logs to Check:**
```javascript
// Should see:
console.log('Realtime subscription active')
// Should NOT see:
console.error('Realtime error')
```

**Actual Result:** _[To be filled during test]_

---

### 5. Verify Message Thread Persistence
**Steps:**
1. Navigate back to teacher dashboard
2. Go to Messages page: `/dashboard/teacher/messages`
3. Find the thread you just created
4. Click on it to reopen

**Expected Result:** 
- ✅ Thread appears in list
- ✅ Shows latest message preview
- ✅ Shows timestamp
- ✅ Clicking reopens same conversation

**Actual Result:** _[To be filled during test]_

---

### 6. Test Parent Login (Future - Parent View Not Built Yet)
**Status:** ⏸️ Parent dashboard messaging view not yet implemented

Will test after building parent-side interface:
- Parent sees thread from teacher
- Parent can reply
- Both sides see messages in real-time

---

## Database Verification Queries

### Check Thread Creation
```sql
-- View all threads for Young Eagles preschool
SELECT 
    mt.id,
    mt.subject,
    mt.type,
    mt.created_at,
    s.first_name || ' ' || s.last_name as student_name,
    COUNT(m.id) as message_count
FROM message_threads mt
LEFT JOIN students s ON mt.student_id = s.id
LEFT JOIN messages m ON m.thread_id = mt.id
WHERE mt.preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid
GROUP BY mt.id, mt.subject, mt.type, mt.created_at, s.first_name, s.last_name
ORDER BY mt.created_at DESC;
```

### Check Participants
```sql
-- View participants in threads
SELECT 
    mt.subject,
    mp.role,
    p.email,
    p.first_name || ' ' || p.last_name as participant_name
FROM message_threads mt
INNER JOIN message_participants mp ON mp.thread_id = mt.id
INNER JOIN profiles p ON p.id = mp.user_id
WHERE mt.preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid
ORDER BY mt.created_at DESC, mp.role;
```

### Check Messages
```sql
-- View all messages in threads
SELECT 
    mt.subject,
    p.email as sender_email,
    p.first_name || ' ' || p.last_name as sender_name,
    m.content,
    m.created_at
FROM messages m
INNER JOIN message_threads mt ON mt.id = m.thread_id
INNER JOIN profiles p ON p.id = m.sender_id
WHERE mt.preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid
ORDER BY m.created_at DESC
LIMIT 20;
```

---

## Known Issues / Blockers

### Current Status:
- ✅ ParentContactsWidget displays 3 parents correctly
- ✅ Message button handler exists
- ✅ Thread creation logic implemented
- ✅ Message thread page exists
- ✅ RLS policies in place (no infinite recursion)
- ⚠️ Need to test actual button clicks in browser
- ❌ Parent dashboard messaging view not yet built

### Potential Issues to Watch:
1. **RLS Permission Denied:** Check browser console for "permission denied" errors
2. **Navigation Fails:** If routing doesn't work, check Next.js route structure
3. **Send Button Disabled:** Check if user profile loaded correctly
4. **Real-time Not Working:** Verify Supabase Realtime is enabled for messages table

---

## Next Steps After Testing

### If Tests Pass:
1. Build parent dashboard messaging view
2. Add message notifications
3. Add principal oversight dashboard
4. Implement advanced features (templates, attachments, etc.)

### If Tests Fail:
1. Check browser console errors
2. Run database verification queries
3. Check Supabase Dashboard → Authentication → Users
4. Verify RLS policies aren't blocking access
5. Check Network tab for API errors

---

## Test Execution

**Tester:** _[Your name]_  
**Date:** _[Test date]_  
**Environment:** Production (Young Eagles Preschool)  
**Browser:** _[Chrome/Firefox/Safari]_

**Overall Result:** 
- [ ] ✅ All tests passed
- [ ] ⚠️ Partial success (specify issues below)
- [ ] ❌ Failed (specify blockers below)

**Notes:**
_[Add any observations, errors, or issues encountered]_
