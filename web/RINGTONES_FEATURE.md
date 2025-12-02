# Custom Ringtones Feature

## Overview
Users can now customize their call ringtones and ringback tones (the "KRING-KRING" sound heard while waiting for someone to answer).

## Features Implemented

### 1. **Incoming Call Ringtones** (Callee Side)
- What you hear when someone calls you
- Multiple built-in options:
  - Default Ring (classic phone ring)
  - Classic Ring (traditional phone ring)
  - Chime (soft chime tone)
- Custom ringtone upload (MP3, WAV, M4A, OGG - max 5MB)
- Volume control (0-100%)
- Vibration toggle

### 2. **Outgoing Call Ringback** (Caller Side) 
- What you hear while waiting for someone to answer ("KRING-KRING")
- Same built-in options as incoming
- Custom ringback upload
- Volume control (0-100%)
- Vibration toggle (when dialing)

### 3. **Device Ringtone Support**
- Option to use device's default ringtone
- Browser permissions handled automatically

## Technical Architecture

### Files Created/Modified

#### New Files:
- `web/src/lib/types/ringtone.ts` - TypeScript types and constants
- `web/src/lib/services/ringtoneService.ts` - Ringtone management service
- `web/src/components/settings/RingtoneSettings.tsx` - Settings UI component
- `web/src/app/dashboard/parent/settings/ringtones/page.tsx` - Parent ringtone settings page
- `web/src/app/dashboard/teacher/settings/ringtones/page.tsx` - Teacher ringtone settings page
- `supabase/migrations/20251202082105_add_ringtone_preferences.sql` - Database migration

#### Modified Files:
- `web/src/components/calls/DailyCallInterface.tsx` - Uses RingtoneService for outgoing ringback
- `web/src/components/calls/IncomingCallOverlay.tsx` - Uses RingtoneService for incoming ringtone
- `web/src/app/dashboard/parent/settings/page.tsx` - Added ringtone settings link
- `web/src/app/dashboard/teacher/settings/page.tsx` - Added ringtone settings link

### Data Storage

#### localStorage (Instant Load)
```typescript
{
  edudash_ringtone_preferences: {
    incomingRingtone: 'default_old',
    incomingVolume: 1.0,
    outgoingRingback: 'default',
    outgoingVolume: 0.8,
    vibrateOnIncoming: true,
    vibrateOnOutgoing: false,
    updatedAt: '2024-12-02T...'
  }
}
```

#### Supabase profiles.ringtone_preferences (JSONB)
- Same structure as localStorage
- Syncs in background
- Cross-device support

#### Custom Ringtone Files
- Stored in Supabase Storage bucket: `user-media/ringtones/`
- File naming: `{userId}_{timestamp}.{ext}`
- Public URLs generated automatically
- Max file size: 5MB
- Supported formats: MP3, WAV, M4A, OGG

### Service Architecture

```typescript
RingtoneService
├── getRingtonePreferences() - Load from localStorage/Supabase
├── updateRingtonePreferences() - Save to both stores
├── uploadCustomRingtone() - Upload to Supabase Storage
├── deleteCustomRingtone() - Remove from storage
├── preloadRingtone() - Cache audio for faster playback
├── playRingtone() - Play with user preferences
├── stopRingtone() - Stop audio and vibration
└── previewRingtone() - Preview sound in settings
```

### Audio Routing (Voice vs Loudspeaker)

The system now handles:
1. **Incoming calls**: User's custom ringtone plays
2. **Outgoing calls**: User's custom ringback plays (KRING-KRING)
3. **Voice calls**: Default to earpiece (speaker OFF)
4. **Video calls**: Default to loudspeaker (speaker ON)

## Usage

### For Users:
1. Go to Settings → Notifications section
2. Click "Call Ringtones"
3. Choose incoming ringtone and outgoing ringback
4. Adjust volume for each
5. Upload custom sounds (optional)
6. Toggle vibration preferences
7. Preview sounds before saving

### For Developers:

#### Using RingtoneService:
```typescript
import RingtoneService from '@/lib/services/ringtoneService';

// Play incoming ringtone
const audio = await RingtoneService.playRingtone('incoming', { loop: true });

// Play outgoing ringback
const audio = await RingtoneService.playRingtone('outgoing', { loop: true });

// Stop ringtone
RingtoneService.stopRingtone(audio);

// Update preferences
await RingtoneService.updateRingtonePreferences({
  incomingRingtone: 'custom',
  incomingCustomUrl: 'https://...',
  incomingVolume: 0.8
});
```

## Database Migration

To apply the migration:
```bash
supabase db push
```

This adds the `ringtone_preferences` JSONB column to the `profiles` table with default values.

## Browser Compatibility

- **Chrome/Edge**: Full support including vibration
- **Firefox**: Full support including vibration
- **Safari**: Audio works, vibration limited
- **Mobile browsers**: Works with autoplay restrictions handled

### Autoplay Handling
- First attempt: Auto-play on incoming call
- Fallback: Play on user interaction (tap to answer)
- Retry mechanism: Every 2 seconds until played

## Security

- File type validation (audio/* only)
- File size limit (5MB max)
- User-specific storage paths
- RLS policies on Supabase Storage
- Signed URLs with expiry (not implemented yet, using public URLs)

## Future Enhancements

1. **Device ringtone picker** - Access native ringtones via File System Access API
2. **Ringtone marketplace** - Share/download community ringtones
3. **Ringtone editor** - Trim/edit uploaded sounds
4. **Per-contact ringtones** - Different ringtones for different callers
5. **Quiet hours** - Auto-silence during specified times
6. **Fade in/out** - Gradual volume increase/decrease

## Testing

1. Upload custom ringtone (< 5MB audio file)
2. Make outgoing call - should hear custom ringback
3. Receive incoming call - should hear custom ringtone
4. Test vibration on mobile device
5. Test volume controls
6. Test preview buttons
7. Verify settings sync across devices

## Troubleshooting

### Audio not playing?
- Check browser autoplay policy
- Ensure user has interacted with page
- Try lowering volume (may be muted)
- Check browser console for errors

### Custom upload failing?
- Verify file is audio format
- Check file size < 5MB
- Ensure logged in
- Check network connection

### Settings not syncing?
- Check localStorage in DevTools
- Verify Supabase connection
- Check profiles table has ringtone_preferences column
