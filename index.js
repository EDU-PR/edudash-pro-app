// Load Promise polyfills FIRST (required by Daily.co SDK)
import './polyfills/promise';
// Load React polyfills before expo-router
import './polyfills/react-use';
// Load expo-router entry
import 'expo-router/entry';
