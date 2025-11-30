export { CallInterface, useCallInterface } from './CallInterface';
export { IncomingCallOverlay } from './IncomingCallOverlay';
export { CallProvider, useCall } from './CallProvider';
export { CallProviderWrapper } from './CallProviderWrapper';
export { QuickCallModal } from './QuickCallModal';

// Daily.co Calls (Legacy - see _archived/ folder for original implementations)
export { DailyCallInterface } from './DailyCallInterface';
export { GroupCallProvider, useGroupCall } from './GroupCallProvider';
export { ClassLessonCall } from './ClassLessonCall';
export { StartLiveLesson } from './StartLiveLesson';
export { JoinLiveLesson } from './JoinLiveLesson';

// Daily Prebuilt (New - recommended for video/voice calls)
export { DailyPrebuiltCall } from './DailyPrebuiltCall';
export { DailyPrebuiltProvider, useDailyPrebuilt } from './DailyPrebuiltProvider';
export { StartLiveLessonPrebuilt } from './StartLiveLessonPrebuilt';
export { JoinLiveLessonPrebuilt } from './JoinLiveLessonPrebuilt';

// Feature-flagged components (toggle between legacy and Prebuilt)
// Default: Uses Daily Prebuilt. Set NEXT_PUBLIC_USE_DAILY_PREBUILT=false to use legacy.
export { StartLiveLessonWithToggle, JoinLiveLessonWithToggle } from './LiveLessonWithToggle';
