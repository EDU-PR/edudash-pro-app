import { NativeModules } from 'react-native';

type EmitterCompatibleModule = {
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

function ensureEmitterCompatibility(moduleName: string): void {
  const nativeModule = (NativeModules as Record<string, unknown>)[moduleName];
  if (!nativeModule || typeof nativeModule !== 'object') return;

  const emitterModule = nativeModule as EmitterCompatibleModule;

  if (typeof emitterModule.addListener !== 'function') {
    emitterModule.addListener = () => {};
  }

  if (typeof emitterModule.removeListeners !== 'function') {
    emitterModule.removeListeners = () => {};
  }
}

/**
 * Some native modules (notably WebRTC on Android) do not implement the
 * addListener/removeListeners methods React Native expects. Patch them early
 * to avoid noisy NativeEventEmitter warnings.
 */
export function patchNativeEventEmitterModules(): void {
  ensureEmitterCompatibility('WebRTCModule');
  ensureEmitterCompatibility('RNBackgroundTimer');
  ensureEmitterCompatibility('ReactNativeBlobUtil');
  ensureEmitterCompatibility('PvVoiceProcessor');
}

