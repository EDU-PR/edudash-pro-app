# WARP.md Compliance Refactoring Plan

> **Generated:** November 30, 2025  
> **Purpose:** Track files requiring refactoring per WARP.md file size standards

## 📋 WARP.md File Size Standards

| Category | Max Lines | Notes |
|----------|-----------|-------|
| Components | ≤400 | Excluding StyleSheet |
| Screens/Pages | ≤500 | Excluding StyleSheet |
| Hooks | ≤200 | - |
| Services/Utilities | ≤500 | - |
| Type definitions | ≤300 | Except auto-generated |

---

## 🧩 Components Requiring Refactoring (Limit: 400 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **2311** | `components/calls/StartLiveLessonPrebuilt.tsx` | +1911 | 🔴 Critical |
| **1465** | `components/dashboard/exam-prep/ExamPrepWidget.tsx` | +1065 | 🔴 Critical |
| **1414** | `components/calls/DailyCallInterface.tsx` | +1014 | 🔴 Critical |
| **1403** | `components/calls/CallInterface.tsx` | +1003 | 🔴 Critical |
| **1181** | `components/dashboard/exam-prep/ExamInteractiveView.tsx` | +781 | 🔴 Critical |
| **1175** | `components/calls/StartLiveLesson.tsx` | +775 | 🔴 Critical |
| **1107** | `components/dashboard/exam-prep/ConversationalExamBuilder.tsx` | +707 | 🔴 Critical |
| **959** | `components/dashboard/AskAIWidget.tsx` | +559 | 🔴 Critical |
| **866** | `components/dash-chat/ChatInterface-old.tsx` | +466 | ⚫ Delete |
| **836** | `components/calls/ClassLessonCall.tsx` | +436 | 🔴 Critical |
| **742** | `components/admin/SuperAdminDashboard.tsx` | +342 | 🟠 High |
| **739** | `components/calls/JoinLiveLesson.tsx` | +339 | 🟠 High |
| **674** | `components/messaging/InviteContactModal.tsx` | +274 | 🟠 High |
| **552** | `components/messaging/NewChatModal.tsx` | +152 | 🟡 Medium |
| **549** | `components/calls/CallProvider.tsx` | +149 | 🟡 Medium |
| **518** | `components/modals/UpgradeModal.tsx` | +118 | 🟡 Medium |
| **511** | `components/dash-chat/MessageBubble.tsx` | +111 | 🟡 Medium |
| **492** | `components/dash-chat/ImageUpload.tsx` | +92 | 🟡 Medium |
| **492** | `components/dashboard/teacher/TeacherShell.tsx` | +92 | 🟡 Medium |
| **476** | `components/calls/QuickCallModal.tsx` | +76 | 🟢 Low |
| **476** | `components/calls/GroupCallProvider.tsx` | +76 | 🟢 Low |
| **472** | `components/messaging/MessageContextMenu.tsx` | +72 | 🟢 Low |
| **451** | `components/auth/PreschoolSelector.tsx` | +51 | 🟢 Low |
| **421** | `components/calls/IncomingCallOverlay.tsx` | +21 | 🟢 Low |
| **403** | `components/dash-chat/ConversationList.tsx` | +3 | 🟢 Low |
| **402** | `components/dashboard/principal/PrincipalShell.tsx` | +2 | 🟢 Low |

**Total Components:** 26 files

---

## 🗑️ Archived Files to Delete

| Lines | File | Reason |
|-------|------|--------|
| **1375** | `components/calls/_archived/DailyCallInterface.tsx` | Superseded by active version |
| **836** | `components/calls/_archived/ClassLessonCall.tsx` | Superseded by active version |
| **476** | `components/calls/_archived/GroupCallProvider.tsx` | Superseded by active version |

**Action:** Delete entire `_archived` folder after confirming no dependencies.

---

## 📱 Screens/Pages Requiring Refactoring (Limit: 500 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **2627** | `app/dashboard/parent/messages/page.tsx` | +2127 | 🔴 Critical |
| **2174** | `app/dashboard/teacher/messages/page.tsx` | +1674 | 🔴 Critical |
| **1018** | `app/dashboard/principal/registrations/page.tsx` | +518 | 🔴 Critical |
| **1007** | `app/dashboard/principal/registrations/[id]/page.tsx` | +507 | 🔴 Critical |
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
| **517** | `app/dashboard/parent/homework/page.tsx` | +17 | 🟢 Low |

**Total Pages:** 22 files

---

## 🪝 Hooks Requiring Refactoring (Limit: 200 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **503** | `hooks/useChatLogic.ts` | +303 | 🔴 Critical |
| **374** | `hooks/useTTS.ts` | +174 | 🟠 High |
| **254** | `hooks/useVoiceRecording.ts` | +54 | 🟢 Low |

**Total Hooks:** 3 files

---

## ⚙️ Services/Utilities Requiring Refactoring (Limit: 500 lines)

| Lines | File | Overflow | Priority |
|-------|------|----------|----------|
| **591** | `lib/examParser.ts` | +91 | 🟡 Medium |
| **501** | `lib/services/pushNotificationService.ts` | +1 | 🟢 Low |

**Total Services:** 2 files

---

## 📊 Summary Dashboard

| Category | Count | Worst Offender | Lines |
|----------|-------|----------------|-------|
| Components | **26** | `StartLiveLessonPrebuilt.tsx` | 2311 |
| Pages | **22** | `parent/messages/page.tsx` | 2627 |
| Hooks | **3** | `useChatLogic.ts` | 503 |
| Services | **2** | `examParser.ts` | 591 |
| Archived | **3** | (to delete) | 2687 |
| **Total** | **53** | - | - |

---

## 🎯 Refactoring Priority Queue

### Phase 1: Critical (>2x over limit)
1. `app/dashboard/parent/messages/page.tsx` - 2627 lines (5.2x)
2. `components/calls/StartLiveLessonPrebuilt.tsx` - 2311 lines (5.8x)
3. `app/dashboard/teacher/messages/page.tsx` - 2174 lines (4.3x)
4. `components/dashboard/exam-prep/ExamPrepWidget.tsx` - 1465 lines (3.7x)
5. `components/calls/DailyCallInterface.tsx` - 1414 lines (3.5x)
6. `components/calls/CallInterface.tsx` - 1403 lines (3.5x)
7. `components/dashboard/exam-prep/ExamInteractiveView.tsx` - 1181 lines (3.0x)
8. `components/calls/StartLiveLesson.tsx` - 1175 lines (2.9x)
9. `components/dashboard/exam-prep/ConversationalExamBuilder.tsx` - 1107 lines (2.8x)
10. `app/dashboard/principal/registrations/page.tsx` - 1018 lines (2.0x)
11. `app/dashboard/principal/registrations/[id]/page.tsx` - 1007 lines (2.0x)

### Phase 2: High Priority (1.5x - 2x over limit)
- `components/dashboard/AskAIWidget.tsx` - 959 lines
- `components/calls/ClassLessonCall.tsx` - 836 lines
- `app/dashboard/parent/subscription/page.tsx` - 780 lines
- `app/dashboard/parent/standalone/page.tsx` - 778 lines
- `app/dashboard/parent/robotics/page.tsx` - 778 lines
- `components/admin/SuperAdminDashboard.tsx` - 742 lines
- `components/calls/JoinLiveLesson.tsx` - 739 lines

### Phase 3: Medium Priority (1.2x - 1.5x over limit)
- All remaining files with 🟡 Medium priority

### Phase 4: Low Priority (<1.2x over limit)
- All remaining files with 🟢 Low priority

### Immediate Action: Delete Legacy Files
- ~~`components/dash-chat/ChatInterface-old.tsx` - 866 lines~~ ✅ **DELETED**

### Archived Files (Keep for now - documented in `_archived/README.md`)
- `components/calls/_archived/DailyCallInterface.tsx` - 1375 lines (superseded by Prebuilt)
- `components/calls/_archived/ClassLessonCall.tsx` - 836 lines (superseded by Prebuilt)
- `components/calls/_archived/GroupCallProvider.tsx` - 476 lines (superseded by Prebuilt)
> **Note:** These are documented backups from 2025-11-29 migration to Daily Prebuilt. May be restored if Prebuilt doesn't meet standards.

---

## 📐 Refactoring Patterns

### For Large Components
```
Before: components/ExamPrepWidget.tsx (1465 lines)
After:
├── components/exam-prep/
│   ├── ExamPrepWidget.tsx (300 lines) - Main orchestrator
│   ├── ExamHeader.tsx (100 lines)
│   ├── ExamQuestionList.tsx (200 lines)
│   ├── ExamControls.tsx (150 lines)
│   ├── ExamResults.tsx (200 lines)
│   └── hooks/
│       └── useExamState.ts (150 lines)
```

### For Large Pages
```
Before: app/dashboard/parent/messages/page.tsx (2627 lines)
After:
├── app/dashboard/parent/messages/
│   └── page.tsx (200 lines) - Route handler only
├── components/messaging/
│   ├── MessagesDashboard.tsx (300 lines)
│   ├── ConversationList.tsx (200 lines)
│   ├── MessageThread.tsx (250 lines)
│   ├── MessageInput.tsx (150 lines)
│   └── hooks/
│       ├── useMessages.ts (150 lines)
│       └── useConversations.ts (100 lines)
```

### For Large Hooks
```
Before: hooks/useChatLogic.ts (503 lines)
After:
├── hooks/chat/
│   ├── useChatLogic.ts (150 lines) - Main hook, composes others
│   ├── useChatMessages.ts (100 lines)
│   ├── useChatConnection.ts (100 lines)
│   └── useChatActions.ts (100 lines)
```

---

## ✅ Completion Tracking

- [ ] Phase 1: Critical files refactored
- [ ] Phase 2: High priority files refactored
- [ ] Phase 3: Medium priority files refactored
- [ ] Phase 4: Low priority files refactored
- [x] Legacy files deleted ✅ (`ChatInterface-old.tsx` removed)
- [ ] All files under WARP.md limits

---

## 🔧 PWA Native App Enhancements (November 30, 2025)

### Completed Enhancements:
- [x] Enhanced `manifest.ts` with full PWA configuration (display_override, icons, shortcuts, screenshots)
- [x] Added `NativeAppManager` component for native-like behavior management
- [x] Created `useNotificationSound` hook for notification audio feedback
- [x] Created `useOrientationLock` hook for screen orientation control
- [x] Enhanced `PWAInstallPrompt` with comprehensive cross-browser support:
  - iOS Safari instructions
  - iOS Chrome redirect to Safari
  - Android Chrome/Edge/Firefox/Samsung Browser instructions
  - Desktop Chrome/Edge instructions
- [x] Updated service worker to cache notification sounds
- [x] Added in-app push notification forwarding to clients
- [x] Enhanced layout.tsx with additional PWA meta tags
- [x] Orientation lock (portrait) enabled by default

---

*Last updated: November 30, 2025 (verified)*
