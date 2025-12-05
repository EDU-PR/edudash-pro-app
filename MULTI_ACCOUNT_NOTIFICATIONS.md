# Multi-Account Notification Routing

## Overview

EduDash Pro supports multiple users on a single device, which is common in South African households where parents share devices. The notification routing system ensures that notifications are delivered to the correct user and provides a seamless experience when notifications arrive for a logged-out user.

## Problem Statement

**Scenario**: Teacher sends message to Parent A
- Parent A logged out
- Parent B currently logged in
- Notification arrives on device
- **Issue**: Notification appears for wrong user or doesn't show

## Solution: Smart Notification Routing

The system implements **device-linked notifications** with **smart routing fallback**:

1. **Device-Linked Tokens**: Each user registers their push token tied to their `user_id` and `device_installation_id`
2. **Token Activation**: Only the currently logged-in user's tokens are active on the device
3. **Smart Routing**: When a notification arrives, check `target_user_id` vs `current_user_id`
4. **Account Switch**: If mismatch, show alert with "Switch Account" option

## Architecture

### Database Schema

```sql
-- push_devices table
CREATE TABLE push_devices (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  expo_push_token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  is_active boolean DEFAULT TRUE,
  device_installation_id text,
  device_metadata jsonb,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  UNIQUE (user_id, device_installation_id)
);
```

**Key Points**:
- `user_id`: Identifies which user owns this token
- `device_installation_id`: Identifies the physical device (same across users)
- `is_active`: Only one user's token is active per device at a time
- Unique constraint prevents duplicate registrations

### Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Teacher sends message to Parent A                           │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. notifications-dispatcher Edge Function                      │
│    - Looks up active push_devices for Parent A                 │
│    - Sends notification with user_id in payload                │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Device receives notification via FCM/APNs                   │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. NotificationRouter checks target vs current user            │
│    - Extract user_id from notification.data                    │
│    - Get currently logged-in user                              │
│    - Compare user IDs                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌────────────────────┐      ┌────────────────────┐
│ User IDs Match     │      │ User IDs Differ    │
│ Show notification  │      │ Show alert:        │
│ normally           │      │ "Switch Account?"  │
└────────────────────┘      └────────────────────┘
```

### Token Lifecycle

**On Sign-In**:
1. User signs in (email/password or biometric)
2. `AuthContext` triggers `SIGNED_IN` event
3. `registerPushDevice()` called
4. `reactivateUserTokens()` called:
   - Deactivates all other users' tokens on this device
   - Activates current user's token on this device

**On Sign-Out**:
1. User signs out
2. `signOutAndRedirect()` called
3. `deactivateCurrentUserTokens()` called:
   - Marks user's token as `is_active = false`
   - Sets `revoked_at` timestamp

**On Notification Received**:
1. `setupNotificationRouter()` listener triggered
2. `routeNotification()` checks target user
3. If mismatch: Show "Switch Account" alert
4. If match: Display notification normally

## Code Components

### 1. NotificationRouter (`lib/NotificationRouter.ts`)

Main orchestrator for notification routing:

```typescript
// Check if notification is for current user
await routeNotification(notification)

// Deactivate tokens on sign-out
await deactivateCurrentUserTokens(userId)

// Reactivate tokens on sign-in
await reactivateUserTokens(userId)

// Setup listeners in app root
setupNotificationRouter()
```

### 2. Notification Registration (`lib/notifications.ts`)

Enhanced to activate tokens after registration:

```typescript
// After successful registration
const { reactivateUserTokens } = await import('./NotificationRouter');
await reactivateUserTokens(user.id);
```

### 3. Auth Actions (`lib/authActions.ts`)

Integrated token deactivation on sign-out:

```typescript
// Before sign-out
await deactivateCurrentUserTokens(session.user.id);
await signOut();
```

### 4. Notification Dispatcher (`supabase/functions/notifications-dispatcher/index.ts`)

Sends individual notifications with `user_id`:

```typescript
// Send to each user individually with their user_id
const expoNotifications = pushTokens.map(tokenInfo => ({
  to: [tokenInfo.expo_push_token],
  title: template.title,
  body: template.body,
  data: {
    ...enhancedData,
    user_id: tokenInfo.user_id, // Target user ID
    recipient_id: tokenInfo.user_id,
    target_user_id: tokenInfo.user_id,
  },
  // ...
}))
```

### 5. App Initialization (`app/_layout.tsx`)

Setup notification router on app start:

```typescript
useEffect(() => {
  if (Platform.OS === 'web') return;
  
  const cleanup = setupNotificationRouter();
  return () => cleanup();
}, []);
```

## User Experience

### Scenario 1: Notification for Current User

```
User: Parent B (logged in)
Notification: "New message from Teacher" (for Parent B)
Result: ✅ Notification shown normally
```

### Scenario 2: Notification for Different User

```
User: Parent B (logged in)
Notification: "New message from Teacher" (for Parent A)
Result: 🔀 Alert shown:

┌─────────────────────────────────────┐
│   Message for Another User          │
│                                     │
│   This message is for Parent A.     │
│   Would you like to switch          │
│   accounts?                         │
│                                     │
│   [Ignore]    [Switch Account]      │
└─────────────────────────────────────┘
```

### Scenario 3: User Switches Account

```
1. Parent B sees alert
2. Taps "Switch Account"
3. App signs out Parent B
4. Redirects to sign-in screen
5. Parent A can now sign in and see message
```

## Testing

### Manual Testing

1. **Setup**: Two parent accounts on same device
2. **Sign in as Parent A**
   - Verify token registered in `push_devices`
   - Verify `is_active = true` for Parent A
3. **Send test notification to Parent A**
   - Should show normally
4. **Sign out Parent A, sign in as Parent B**
   - Verify Parent A token `is_active = false`
   - Verify Parent B token `is_active = true`
5. **Send test notification to Parent A**
   - Should show "Switch Account" alert
6. **Tap "Switch Account"**
   - Should sign out Parent B
   - Should redirect to sign-in

### Test Notification Script

```typescript
// Send test notification via Supabase client
const { data, error } = await supabase.functions.invoke('notifications-dispatcher', {
  body: {
    event_type: 'custom',
    user_ids: ['parent-a-user-id'],
    template_override: {
      title: 'Test Notification',
      body: 'Testing multi-account routing',
      data: {
        type: 'test',
        screen: 'messages'
      }
    }
  }
})
```

## Database Queries

### Check active tokens per device

```sql
SELECT 
  device_installation_id,
  user_id,
  is_active,
  last_seen_at,
  platform
FROM push_devices
WHERE device_installation_id = 'YOUR_DEVICE_ID'
ORDER BY last_seen_at DESC;
```

### Verify only one active token per device

```sql
SELECT 
  device_installation_id,
  COUNT(*) FILTER (WHERE is_active = true) as active_count,
  COUNT(*) as total_count
FROM push_devices
GROUP BY device_installation_id
HAVING COUNT(*) FILTER (WHERE is_active = true) > 1;
-- Should return no rows (0 conflicts)
```

### Get user's notification history

```sql
SELECT 
  pn.title,
  pn.body,
  pn.status,
  pn.created_at,
  pn.notification_type
FROM push_notifications pn
WHERE pn.recipient_user_id = 'USER_ID'
ORDER BY pn.created_at DESC
LIMIT 20;
```

## Security Considerations

1. **RLS Policies**: Ensure users can only see their own push_devices
2. **Token Validation**: Expo validates tokens, we just route them
3. **No Sensitive Data**: Notification payloads should not contain sensitive info
4. **Audit Trail**: All token activations/deactivations are timestamped

## Future Enhancements

1. **Account Switcher UI**: Show list of available accounts with quick switch
2. **Notification Badges**: Per-account notification counts
3. **Silent Notifications**: Background sync without alerts
4. **Push to Multiple Accounts**: Broadcast to all users on device (optional)
5. **Token Expiry**: Auto-deactivate tokens after X days of inactivity

## Troubleshooting

### Notifications not arriving

1. Check `push_devices` table for active token
2. Verify `is_active = true` for current user
3. Check Expo push notification status dashboard
4. Verify `EXPO_ACCESS_TOKEN` in Supabase Edge Functions

### Wrong user receiving notifications

1. Check notification payload includes `user_id`
2. Verify `NotificationRouter` is initialized in `_layout.tsx`
3. Check logs for routing decisions
4. Ensure token activation on sign-in is working

### Multiple tokens active per device

1. Run query to find conflicts
2. Manually deactivate old tokens
3. Check `reactivateUserTokens()` is called on sign-in

## References

- Expo Push Notifications: https://docs.expo.dev/push-notifications/overview/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- React Native Notifications: https://reactnative.dev/docs/pushnotificationios
