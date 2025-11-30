# WARP.md Compliance - Updated Scan (November 30, 2025)

> **Scan Date:** November 30, 2025 @ 09:45 SAST  
> **Purpose:** Fresh scan after cleanup and archival of legacy files

## 📊 Current Status vs Previous

| Category | Previous | Current | Change |
|----------|----------|---------|--------|
| Components >400 | 26 | **13** | ↓13 removed/archived |
| Pages >500 | 22 | **22** | → same count, different sizes |
| Hooks >200 | 3 | **3** | → unchanged |
| Services >500 | 2 | **1** | ↓1 under limit now |
| **Total** | 53 | **39** | ↓14 files |

---

## 🧩 Components Requiring Refactoring (Limit: 400 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **1465** | `components/dashboard/exam-prep/ExamPrepWidget.tsx` | +1065 | 🔴 Critical |
| **1181** | `components/dashboard/exam-prep/ExamInteractiveView.tsx` | +781 | 🔴 Critical |
| **1107** | `components/dashboard/exam-prep/ConversationalExamBuilder.tsx` | +707 | 🔴 Critical |
| **959** | `components/dashboard/AskAIWidget.tsx` | +559 | 🔴 Critical |
| **742** | `components/admin/SuperAdminDashboard.tsx` | +342 | 🟠 High |
| **521** | `components/dashboard/teacher/ParentContactsWidget.tsx` | +121 | 🟡 Medium |
| **518** | `components/modals/UpgradeModal.tsx` | +118 | 🟡 Medium |
| **511** | `components/dash-chat/MessageBubble.tsx` | +111 | 🟡 Medium |
| **492** | `components/dash-chat/ImageUpload.tsx` | +92 | 🟡 Medium |
| **476** | `components/dashboard/teacher/TeacherShell.tsx` | +76 | 🟢 Low |
| **451** | `components/auth/PreschoolSelector.tsx` | +51 | 🟢 Low |
| **403** | `components/dash-chat/ConversationList.tsx` | +3 | 🟢 Low |
| **402** | `components/dashboard/principal/PrincipalShell.tsx` | +2 | 🟢 Low |

**Total Components:** 13 files (was 26)

### 📝 Notes on Missing Files
The following files from REFACTOR_X.md were not found in current scan:
- `components/calls/*` files - May have been deleted or moved
- `components/messaging/*` files - May have been refactored

---

## 📱 Screens/Pages Requiring Refactoring (Limit: 500 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **1469** | `app/dashboard/parent/messages/page.tsx` | +969 | 🔴 Critical |
| **1277** | `app/dashboard/teacher/messages/page.tsx` | +777 | 🔴 Critical |
| **1018** | `app/dashboard/principal/registrations/page.tsx` | +518 | 🔴 Critical |
| **1007** | `app/dashboard/principal/registrations/[id]/page.tsx` | +507 | 🔴 Critical |
| **986** | `app/dashboard/teacher/messages/[threadId]/page.tsx` | +486 | 🔴 Critical |
| **780** | `app/dashboard/parent/subscription/page.tsx` | +280 | 🟠 High |
| **778** | `app/dashboard/parent/standalone/page.tsx` | +278 | 🟠 High |
| **778** | `app/dashboard/parent/robotics/page.tsx` | +278 | 🟠 High |
| **667** | `app/pricing/page.tsx` | +167 | 🟡 Medium |
| **667** | `app/dashboard/principal/students/[id]/page.tsx` | +167 | 🟡 Medium |
| **665** | `app/admin/registrations/page.tsx` | +165 | 🟡 Medium |
| **664** | `app/dashboard/parent/homework/[assignmentId]/page.tsx` | +164 | 🟡 Medium |
| **649** | `app/dashboard/parent/settings/page.tsx` | +149 | 🟡 Medium |
| **591** | `app/dashboard/parent/ebooks/page.tsx` | +91 | 🟡 Medium |
| **577** | `app/dashboard/parent/robotics/intro-robotics-r-3/page.tsx` | +77 | 🟢 Low |
| **577** | `app/admin/users/page.tsx` | +77 | 🟢 Low |
| **571** | `app/sign-up/parent/page.tsx` | +71 | 🟢 Low |
| **568** | `app/dashboard/principal/campaigns/page.tsx` | +68 | 🟢 Low |
| **554** | `app/dashboard/parent/payments/page.tsx` | +54 | 🟢 Low |
| **536** | `app/dashboard/principal/page.tsx` | +36 | 🟢 Low |
| **534** | `app/dashboard/parent/register-child/page.tsx` | +34 | 🟢 Low |
| **520** | `app/dashboard/teacher/settings/page.tsx` | +20 | 🟢 Low |

**Total Pages:** 22 files

### 📉 Improvements Since Last Scan
| File | Previous | Current | Reduction |
|------|----------|---------|-----------|
| `parent/messages/page.tsx` | 2627 | **1469** | -1158 lines (44% reduction) |
| `teacher/messages/page.tsx` | 2174 | **1277** | -897 lines (41% reduction) |
| `parent/homework/page.tsx` | 517 | **<500** | ✅ Under limit |

---

## 🪝 Hooks Requiring Refactoring (Limit: 200 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **503** | `hooks/useChatLogic.ts` | +303 | 🔴 Critical |
| **374** | `hooks/useTTS.ts` | +174 | 🟠 High |
| **248** | `hooks/useVoiceRecording.ts` | +48 | 🟢 Low |

**Total Hooks:** 3 files

---

## ⚙️ Services/Utilities Requiring Refactoring (Limit: 500 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **591** | `lib/examParser.ts` | +91 | 🟡 Medium |

**Total Services:** 1 file (was 2 - `pushNotificationService.ts` now under limit)

---

## 📊 Updated Summary Dashboard

| Category | Count | Worst Offender | Lines |
|----------|-------|----------------|-------|
| Components | **13** | `ExamPrepWidget.tsx` | 1465 |
| Pages | **22** | `parent/messages/page.tsx` | 1469 |
| Hooks | **3** | `useChatLogic.ts` | 503 |
| Services | **1** | `examParser.ts` | 591 |
| **Total** | **39** | - | - |

---

## 🎯 Updated Refactoring Priority Queue

### Phase 1: Critical (>2x over limit) - 9 files
1. `components/dashboard/exam-prep/ExamPrepWidget.tsx` - 1465 lines (3.7x)
2. `app/dashboard/parent/messages/page.tsx` - 1469 lines (2.9x)
3. `app/dashboard/teacher/messages/page.tsx` - 1277 lines (2.5x)
4. `components/dashboard/exam-prep/ExamInteractiveView.tsx` - 1181 lines (3.0x)
5. `components/dashboard/exam-prep/ConversationalExamBuilder.tsx` - 1107 lines (2.8x)
6. `app/dashboard/principal/registrations/page.tsx` - 1018 lines (2.0x)
7. `app/dashboard/principal/registrations/[id]/page.tsx` - 1007 lines (2.0x)
8. `app/dashboard/teacher/messages/[threadId]/page.tsx` - 986 lines (2.0x)
9. `components/dashboard/AskAIWidget.tsx` - 959 lines (2.4x)

### Phase 2: High Priority (1.5x - 2x over limit) - 7 files
- `app/dashboard/parent/subscription/page.tsx` - 780 lines (1.56x)
- `app/dashboard/parent/standalone/page.tsx` - 778 lines (1.56x)
- `app/dashboard/parent/robotics/page.tsx` - 778 lines (1.56x)
- `components/admin/SuperAdminDashboard.tsx` - 742 lines (1.86x)
- `hooks/useChatLogic.ts` - 503 lines (2.5x)
- `hooks/useTTS.ts` - 374 lines (1.87x)
- `lib/examParser.ts` - 591 lines (1.18x)

### Phase 3: Medium Priority (1.2x - 1.5x over limit) - 11 files
All files with 🟡 Medium priority

### Phase 4: Low Priority (<1.2x over limit) - 12 files
All files with 🟢 Low priority

---

## ✅ Completed Actions This Session

- [x] Archived `ChatInterface-old.tsx` → `docs/archived-code/dash-chat/`
- [x] Archived `page_old.tsx` (teacher) → `docs/archived-code/teacher-messages/`
- [x] Archived `page_old.tsx.bak` (principal) → `docs/archived-code/principal-reports/`
- [x] Created `docs/archived-code/README.md` with restoration guide
- [x] Fixed TypeScript errors in `homework/page.tsx` and `useChildrenData.ts`
- [x] Build passes ✅

---

## 📈 Progress Tracking

| Metric | Start of Day | Current | Target |
|--------|--------------|---------|--------|
| Files over limit | 53 | **39** | 0 |
| Critical files | 11 | **9** | 0 |
| Build status | ✅ | ✅ | ✅ |
| Legacy files | 3 | **0** | 0 |

---

## 🔜 Next Steps

1. **Immediate:** Refactor exam-prep components (3 files, 3753 lines total)
2. **Short-term:** Split message pages into components + hooks
3. **Medium-term:** Extract `useChatLogic` into smaller hooks
4. **Ongoing:** Monitor new files for WARP.md compliance

---

*Generated: November 30, 2025 @ 09:45 SAST*
