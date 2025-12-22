// Load Promise polyfills FIRST (required by Daily.co SDK)
import './polyfills/promise';
// Load React polyfills before expo-router
import './polyfills/react-use';

// Register HeadlessJS task for background call handling (MUST be before expo-router)
// This enables incoming calls to display when the app is killed or backgrounded on Android
import { registerCallHeadlessTask } from './lib/calls/CallHeadlessTask';
registerCallHeadlessTask();

// Load expo-router entry
import 'expo-router/entry';
