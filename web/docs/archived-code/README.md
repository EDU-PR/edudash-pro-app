# Archived Code Reference

> **Purpose:** Store legacy implementations for reference without polluting the active codebase.
> **Last Updated:** November 30, 2025

## Overview

This folder contains deprecated code that has been replaced by newer implementations. These files are kept for reference in case specific functionality needs to be restored or examined.

---

## 📁 Contents

### 1. `dash-chat/ChatInterface-old.tsx` (866 lines)

**Archived:** November 30, 2025  
**Replaced By:** `src/components/dash-chat/ChatInterface.tsx`

**Description:**  
Original Dash AI Chat interface implementation with:
- Basic message sending/receiving
- Image upload support
- Exam builder launcher integration
- Token usage tracking

**Key Features Preserved:**
- `ChatMessage` interface with meta information
- Image handling with base64 data
- Throttling via `dashAIThrottler`
- Auto-scroll behavior

**Reason for Replacement:**  
Refactored to use `useChatLogic` hook for better separation of concerns and improved mobile responsiveness.

---

### 2. `teacher-messages/page_old.tsx` (1362 lines)

**Archived:** November 30, 2025  
**Replaced By:** `src/app/dashboard/teacher/messages/page.tsx`

**Description:**  
Original teacher messaging page with parent communication features:
- Message thread list with search
- Real-time messaging with Supabase
- Emoji picker and attachments
- Mobile-responsive layout with scroll lock

**Key Features Preserved:**
- `MessageThread` interface with participant data
- Real-time message subscriptions
- Composer enhancements (emoji, attachments)
- Unread message counting

**Reason for Replacement:**  
Split into smaller components and hooks per WARP.md file size standards. The 2174-line replacement is still flagged for further refactoring.

---

### 3. `principal-reports/page_old.tsx` (396 lines)

**Archived:** November 30, 2025  
**Replaced By:** `src/app/dashboard/principal/reports/page.tsx`

**Description:**  
Original principal reports approval page:
- Progress report listing
- Approval workflow (draft → pending → approved/rejected)
- Teacher and student data joins

**Key Features Preserved:**
- `ProgressReport` interface with approval status
- Report filtering by status
- PDF download capability

**Reason for Replacement:**  
Enhanced with additional reporting features and better UI. Original was under the 500-line limit but contained bugs.

---

## 🔄 Restoration Guide

If you need to restore any archived code:

1. **Copy** the file back to its original location
2. **Rename** to remove any `-old` or `.bak` suffix
3. **Update imports** in dependent files
4. **Test thoroughly** before deploying

```bash
# Example: Restore ChatInterface-old
cp docs/archived-code/dash-chat/ChatInterface-old.tsx \
   src/components/dash-chat/ChatInterface.tsx
```

---

## ⚠️ Important Notes

- These files are **NOT maintained** - they may have security vulnerabilities or bugs
- Do **NOT** import these files directly into the application
- Use for **reference only** when implementing similar features
- Consider the newer implementations as the source of truth

---

## 📊 Archive Statistics

| File | Lines | Archived Date | Original Location |
|------|-------|---------------|-------------------|
| ChatInterface-old.tsx | 866 | 2025-11-30 | components/dash-chat/ |
| page_old.tsx (teacher) | 1362 | 2025-11-30 | app/dashboard/teacher/messages/ |
| page_old.tsx (principal) | 396 | 2025-11-30 | app/dashboard/principal/reports/ |
| **Total** | **2624** | - | - |

---

*This documentation is part of the WARP.md compliance initiative.*
