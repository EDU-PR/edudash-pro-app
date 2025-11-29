# Dashboard Refactoring Plan

## Overview

This document outlines a detailed plan to refactor the teacher and parent dashboard components from monolithic files into modular structures, following WARP.md standards.

**Date Created:** November 2024
**Status:** Planning Phase
**Target:** No code changes - structural documentation only

---

## WARP.md File Size Standards

Per project repository custom instructions (defined in `.github/instructions/*.instructions.md`), files must adhere to these limits:

| File Type | Maximum Lines |
|-----------|---------------|
| Components | ≤400 lines (excluding StyleSheet) |
| Screens | ≤500 lines (excluding StyleSheet) |
| Hooks | ≤200 lines |
| Services/Utilities | ≤500 lines |
| Type definitions | ≤300 lines (except auto-generated) |

---

## Current State Analysis

### Files Exceeding Limits

#### Components (≤400 lines limit)

| File | Current Lines | Over Limit By |
|------|---------------|---------------|
| `web/src/components/dashboard/teacher/TeacherContactsWidget.tsx` | 700 | 300 lines |
| `web/src/components/dashboard/teacher/TeacherShell.tsx` | 487 | 87 lines |
| `web/src/components/dashboard/teacher/ParentContactsWidget.tsx` | 460 | 60 lines |

#### Hooks (≤200 lines limit)

| File | Current Lines | Over Limit By |
|------|---------------|---------------|
| `web/src/lib/hooks/parent/useParentMessaging.ts` | 320 | 120 lines |
| `web/src/lib/hooks/parent/useChildrenData.ts` | 301 | 101 lines |
| `web/src/lib/hooks/teacher/useTeacherUnreadMessages.ts` | 213 | 13 lines |
| `web/src/lib/hooks/parent/useUnreadMessages.ts` | 211 | 11 lines |

### Files Within Limits (No Changes Required)

| File | Current Lines | Status |
|------|---------------|--------|
| `web/src/app/dashboard/teacher/page.tsx` | 263 | ✓ Within limit |
| `web/src/app/dashboard/parent/page.tsx` | 397 | ✓ Within limit |
| `web/src/components/dashboard/parent/ParentShell.tsx` | 384 | ✓ Within limit |
| `web/src/lib/hooks/teacher/useTeacherDashboard.ts` | 124 | ✓ Within limit |
| `web/src/lib/hooks/useParentDashboardData.ts` | 141 | ✓ Within limit |

---

## Detailed Refactoring Plans

### 1. TeacherContactsWidget.tsx (700 → ~250 lines)

**Current Responsibilities:**
- Contact data fetching (parents & teachers)
- Search functionality
- Tab navigation (Parents/Teachers)
- Parent list rendering
- Teacher list rendering
- Empty state handling
- Loading state handling
- Error state handling
- Conversation thread management

**Proposed Structure:**

```
web/src/components/dashboard/teacher/teacher-contacts/
├── index.ts                      # Re-export all components
├── TeacherContactsWidget.tsx     # Main container (~200 lines)
├── ContactsHeader.tsx            # Header with count (~40 lines)
├── ContactsSearch.tsx            # Search input component (~50 lines)
├── ContactsTabs.tsx              # Tab navigation (~60 lines)
├── ContactListItem.tsx           # Shared contact item (~80 lines)
├── EmptyContactsState.tsx        # Empty state component (~40 lines)
└── types.ts                      # Shared types (~30 lines)

web/src/lib/hooks/teacher/
├── useTeacherContacts.ts         # Contact data fetching (~150 lines)
└── useContactConversation.ts     # Thread management (~100 lines)
```

**Note:** The total extracted component lines (~500) are intentionally less than 700 because:
- Logic is moved to hooks (~250 lines moved to useTeacherContacts and useContactConversation)
- Shared ContactListItem component reduces duplication (single component for both parent/teacher items)
- Types are centralized in types.ts
- **Total accounting:** ~500 lines (components) + ~250 lines (hooks) = 750, but hooks contain extracted logic that was inline in the original 700-line component

**Extraction Details:**

1. **ContactsHeader.tsx** (~40 lines)
   - Header section with title and contact count
   - Props: `totalContacts: number`

2. **ContactsSearch.tsx** (~50 lines)
   - Search input with styling
   - Props: `searchQuery: string`, `onSearchChange: (value: string) => void`

3. **ContactsTabs.tsx** (~60 lines)
   - Tab buttons for Parents/Teachers switching
   - Props: `activeTab: 'parents' | 'teachers'`, `onTabChange`, `parentCount`, `teacherCount`

4. **ContactListItem.tsx** (~80 lines) - *Shared Component*
   - Unified contact item for both parents and teachers
   - Uses variant prop to differentiate styling
   - Props: `contact: Contact`, `variant: 'parent' | 'teacher'`, `onStartConversation`
   - **Location:** `web/src/components/dashboard/teacher/shared/ContactListItem.tsx` for reuse across teacher-contacts and parent-contacts directories

5. **EmptyContactsState.tsx** (~40 lines)
   - Reusable empty state with icon and message
   - Props: `type: 'parents' | 'teachers'`, `hasSearchQuery: boolean`

6. **useTeacherContacts.ts** (~150 lines)
   - Fetch parents and teachers data
   - Handle search filtering
   - Returns: `{ parents, teachers, loading, error, refetch }`

7. **useContactConversation.ts** (~100 lines)
   - Handle thread creation/finding
   - Navigate to messages
   - Returns: `{ startConversation, loading }`

---

### 2. TeacherShell.tsx (487 → ~300 lines)

**Current Responsibilities:**
- Top bar rendering
- Side navigation
- Mobile navigation drawer
- Mobile widgets drawer
- Sidebar collapse functionality
- Notification count
- Authentication handling

**Proposed Structure:**

```
web/src/components/dashboard/teacher/shell/
├── index.ts                      # Re-export
├── TeacherShell.tsx              # Main container (~300 lines)
├── TeacherTopBar.tsx             # Header component (~80 lines)
├── TeacherSideNav.tsx            # Desktop sidebar (~100 lines)
├── TeacherMobileNav.tsx          # Mobile drawer (~120 lines)
├── TeacherMobileWidgets.tsx      # Right sidebar drawer (~80 lines)
└── navigationConfig.ts           # Nav items configuration (~30 lines)

web/src/lib/hooks/teacher/
└── useTeacherNotifications.ts    # Notification count logic (~80 lines)
```

**Extraction Details:**

1. **TeacherTopBar.tsx**
   - Brand/school name display
   - Notification bell
   - Avatar
   - Mobile menu button
   - Props: `preschoolName`, `notificationCount`, `avatarLetter`, `onMenuClick`, `onNotificationsClick`

2. **TeacherSideNav.tsx**
   - Desktop sidebar navigation
   - Collapsible functionality
   - Sign out button
   - Props: `nav`, `pathname`, `collapsed`, `onCollapse`, `onSignOut`

3. **TeacherMobileNav.tsx**
   - Mobile navigation drawer
   - Full navigation menu
   - Props: `isOpen`, `onClose`, `nav`, `pathname`, `onSignOut`

4. **TeacherMobileWidgets.tsx**
   - Right sidebar for mobile
   - Props: `isOpen`, `onClose`, `children` (rightSidebar content)

5. **navigationConfig.ts**
   - Navigation items array
   - Export: `getTeacherNavItems(unreadCount: number)`

6. **useTeacherNotifications.ts**
   - Fetch and subscribe to notification count
   - Returns: `{ notificationCount, loading }`

---

### 3. ParentContactsWidget.tsx (460 → ~280 lines)

**Current Responsibilities:**
- Parent data fetching
- Search functionality
- Parent card rendering
- Student tags display
- Message button actions
- Thread management

**Proposed Structure:**

```
web/src/components/dashboard/teacher/parent-contacts/
├── index.ts                      # Re-export
├── ParentContactsWidget.tsx      # Main container (~200 lines)
├── ParentContactCard.tsx         # Individual card (~100 lines)
└── StudentTagList.tsx            # Student tags component (~40 lines)

web/src/lib/hooks/teacher/
└── useParentContacts.ts          # Data fetching (~100 lines)
```

**Extraction Details:**

1. **ParentContactCard.tsx**
   - Individual parent card with avatar, info, students
   - Message buttons for each student
   - Props: `parent: Parent`, `onMessageStudent: (parent, student) => void`

2. **StudentTagList.tsx**
   - Reusable component for displaying student name tags
   - Props: `students: Student[]`

3. **useParentContacts.ts**
   - Fetch parents for teacher's classes
   - Filter by search query
   - Returns: `{ parents, loading, error, refetch }`

---

### 4. useParentMessaging.ts (320 → ~150 lines)

**Current Responsibilities:**
- Thread fetching
- Thread creation
- Message sending
- Real-time subscriptions
- Read status updates

**Proposed Structure:**

```
web/src/lib/hooks/parent/
├── useParentMessaging.ts         # Main hook (simplified ~150 lines)
├── useMessageThreads.ts          # Thread fetching (~100 lines)
├── useMessageMutations.ts        # Send/create operations (~100 lines)
└── useMessageSubscription.ts     # Real-time updates (~80 lines)
```

**Extraction Details:**

1. **useMessageThreads.ts**
   - Fetch threads with participants
   - Calculate unread counts
   - Returns: `{ threads, loading, error, refetch }`

2. **useMessageMutations.ts**
   - Create new threads
   - Send messages
   - Mark as read
   - Returns: `{ createThread, sendMessage, markAsRead }`

3. **useMessageSubscription.ts**
   - Subscribe to new messages
   - Subscribe to thread updates
   - Returns: `{ isConnected }`

---

### 5. useChildrenData.ts (301 → ~150 lines)

**Current Responsibilities:**
- Fetch children data
- Build child cards with metrics
- Handle active child selection
- Calculate homework pending
- Calculate upcoming events

**Proposed Structure:**

```
web/src/lib/hooks/parent/
├── useChildrenData.ts            # Main hook (~150 lines)
├── useChildMetricsCalculation.ts # Metrics calculation (~80 lines)
└── types/childTypes.ts           # Type definitions (~40 lines)

web/src/lib/utils/
└── childCardBuilder.ts           # Build card helper (~80 lines)
```

**Extraction Details:**

1. **useChildMetricsCalculation.ts**
   - Calculate homework pending count
   - Calculate upcoming events
   - Calculate progress score
   - Returns: `{ calculateMetrics }`

2. **childCardBuilder.ts**
   - Pure function to build ChildCard object
   - No database calls, just transformation
   - Export: `buildChildCardFromData(child, metrics)`

3. **types/childTypes.ts**
   - ChildCard interface
   - UseChildrenDataReturn interface
   - HomeworkAssignment types

---

### 6. useTeacherUnreadMessages.ts (213 → Keep As-Is)

**Assessment:** This hook is only 13 lines over the 200-line limit. The overhead of splitting it would add more complexity than it resolves.

**Recommendation:** Mark as low priority. Consider minor cleanup if other hooks in the file can be simplified, but splitting is not recommended.

**Alternative:** Simple inline optimizations to reduce to ~195 lines:
- Remove verbose comments
- Consolidate duplicate logic
- Simplify early returns

---

### 7. useUnreadMessages.ts (211 → Keep As-Is)

**Assessment:** This hook is only 11 lines over the 200-line limit. Similar to useTeacherUnreadMessages, splitting would add unnecessary complexity.

**Recommendation:** Mark as low priority. Consider minor inline optimizations if needed.

---

## Implementation Guidelines

### File Organization Principles

1. **Container/Presentational Pattern**
   - Container components handle logic and data
   - Presentational components are pure UI

2. **Hook Extraction Rules**
   - Each hook should have a single responsibility
   - Complex hooks should be composed from smaller hooks
   - Shared logic goes in utility functions

3. **Type Organization**
   - Shared types in dedicated type files
   - Component-specific types can stay in component file
   - Export types for reuse

### Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Types: `camelCaseTypes.ts`
- Utils: `camelCase.ts`
- Config: `camelCaseConfig.ts`

### Import/Export Pattern

```typescript
// index.ts for each component group
export { TeacherContactsWidget } from './TeacherContactsWidget';
export { ContactsHeader } from './ContactsHeader';
// ... etc

// Usage
import { TeacherContactsWidget } from '@/components/dashboard/teacher/teacher-contacts';
```

---

## Verification Checklist

Before implementation, verify:

- [ ] No functional changes to existing behavior
- [ ] All imports updated correctly
- [ ] TypeScript types preserved
- [ ] Real-time subscriptions maintained
- [ ] Error handling preserved
- [ ] Loading states preserved
- [ ] Mobile responsiveness maintained
- [ ] All existing tests pass

---

## Risk Assessment

### Low Risk
- Extracting pure UI components
- Moving types to separate files
- Creating re-export index files

### Medium Risk
- Extracting hooks with state
- Splitting components with shared state
- Moving real-time subscription logic

### Mitigation Strategy
- Implement one file at a time
- Run full test suite after each extraction
- Manual testing of affected features
- Keep rollback capability

---

## Next Steps

1. **Phase 1:** Extract types and interfaces
2. **Phase 2:** Extract pure presentational components
3. **Phase 3:** Extract hooks
4. **Phase 4:** Refactor container components
5. **Phase 5:** Update imports across codebase
6. **Phase 6:** Full testing and verification

---

## Notes

- This is a planning document only
- No code changes should be made until approved
- All refactoring must maintain functional parity
- Follow existing code style and patterns
