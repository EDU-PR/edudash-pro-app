declare module '@rneui/themed' {
  interface ButtonProps {
    title?: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
    [key: string]: any;
  }
  export const Button: React.ComponentType<ButtonProps>;
  
  interface InputProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    [key: string]: any;
  }
  export const Input: React.ComponentType<InputProps>;
}

declare module 'react-native-document-picker' {
  interface DocumentPickerResponse {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  }
  
  interface DocumentPickerOptions {
    type?: string[];
    allowMultiSelection?: boolean;
    copyTo?: string;
  }
  
  interface DocumentPicker {
    pick(options?: DocumentPickerOptions): Promise<DocumentPickerResponse[]>;
  }
  
  const DocumentPicker: DocumentPicker;
  export default DocumentPicker;
  export const isCancel: (error: any) => boolean;
  export const isInProgress: (error: any) => boolean;
  export const types: Record<string, string[]>;
}

declare module 'expo-sqlite/next' {
  interface SQLiteDatabase {
    execSync(sql: string, params?: any[]): void;
    getAllSync(sql: string, params?: any[]): any[];
    getFirstSync(sql: string, params?: any[]): any;
    runSync(sql: string, params?: any[]): { changes: number; lastInsertRowId: number };
  }
  
  export function openDatabaseSync(name: string): SQLiteDatabase;
  export type { SQLiteDatabase };
  const _default: {
    openDatabaseSync: typeof openDatabaseSync;
  };
  export default _default;
}

declare module 'react-native-webrtc' {
  export interface RTCPeerConnectionConfiguration {
    iceServers?: Array<{ urls: string | string[] }>;
    [key: string]: any;
  }

  export interface MediaStreamConstraints {
    audio?: boolean | { echoCancellation?: boolean; noiseSuppression?: boolean; channelCount?: number };
    video?: boolean | object;
  }

  export class RTCPeerConnection {
    constructor(configuration?: RTCPeerConnectionConfiguration);
    createOffer(options?: any): Promise<RTCSessionDescription>;
    createAnswer(options?: any): Promise<RTCSessionDescription>;
    setLocalDescription(description: RTCSessionDescription): Promise<void>;
    setRemoteDescription(description: RTCSessionDescription): Promise<void>;
    addTrack(track: any, stream: MediaStream): any;
    close(): void;
    ontrack: ((event: any) => void) | null;
    oniceconnectionstatechange: (() => void) | null;
    onconnectionstatechange: (() => void) | null;
    onicecandidateerror: ((event: any) => void) | null;
    iceConnectionState: string;
    connectionState: string;
  }

  export class RTCSessionDescription {
    constructor(init: { type: string; sdp: string });
    type: string;
    sdp: string;
  }

  export class MediaStream {
    getTracks(): any[];
  }

  export const mediaDevices: {
    getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  };

  export function registerGlobals(): void;
}

declare module 'expo-file-system' {
  // Expo SDK 54+ exposes many legacy fields at runtime, but the types live under `expo-file-system/legacy`.
  // This augmentation makes common legacy usages type-safe in the app codebase.
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  export const bundleDirectory: string | null;

  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }

  export interface InfoOptions {
    readonly md5?: boolean;
    readonly size?: boolean;
  }

  export interface FileInfo {
    readonly exists: boolean;
    readonly isDirectory: boolean;
    readonly uri: string;
    readonly size?: number;
    readonly modificationTime?: number;
    readonly md5?: string;
  }

  export interface ReadingOptions {
    readonly encoding?: EncodingType | 'utf8' | 'base64';
    readonly length?: number;
    readonly position?: number;
  }

  export interface DownloadProgressData {
    readonly totalBytesWritten: number;
    readonly totalBytesExpectedToWrite: number;
  }

  export type FileSystemProgressCallback = (progress: DownloadProgressData) => void;

  export interface DownloadResult {
    readonly uri: string;
    readonly status: number;
    readonly headers: Record<string, string>;
    readonly md5?: string;
  }

  export interface MakeDirectoryOptions {
    readonly intermediates?: boolean;
  }

  export function getInfoAsync(fileUri: string, options?: InfoOptions): Promise<FileInfo>;
  export function readAsStringAsync(fileUri: string, options?: ReadingOptions): Promise<string>;
  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { readonly encoding?: EncodingType | 'utf8' | 'base64' }
  ): Promise<void>;
  export function makeDirectoryAsync(fileUri: string, options?: MakeDirectoryOptions): Promise<void>;
  export function deleteAsync(fileUri: string, options?: { readonly idempotent?: boolean }): Promise<void>;
  export function moveAsync(options: { from: string; to: string }): Promise<void>;
  export function copyAsync(options: { from: string; to: string }): Promise<void>;

  export function uploadAsync(
    url: string,
    fileUri: string,
    options?: Record<string, unknown>
  ): Promise<{ status: number; headers: Record<string, string>; body?: string }>;

  export function getFreeDiskStorageAsync(): Promise<number>;
  export function getTotalDiskCapacityAsync(): Promise<number>;

  export class DownloadResumable {
    constructor(
      url: string,
      fileUri: string,
      options?: Record<string, unknown>,
      callback?: FileSystemProgressCallback,
      resumeData?: string
    );
    downloadAsync(): Promise<DownloadResult | undefined>;
    pauseAsync(): Promise<{ readonly resumeData?: string }>;
    resumeAsync(): Promise<DownloadResult | undefined>;
  }

  export function createDownloadResumable(
    url: string,
    fileUri: string,
    options?: Record<string, unknown>,
    callback?: FileSystemProgressCallback,
    resumeData?: string
  ): DownloadResumable;
}
