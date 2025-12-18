/**
 * Secure store module entrypoint for TypeScript resolution.
 *
 * Runtime uses platform-specific files (e.g. `index.native.ts`, `index.web.ts`),
 * but TypeScript needs a stable `index.ts` for module resolution.
 */
export { secureStore } from './index.native';

export interface SecureStoreLike {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}


