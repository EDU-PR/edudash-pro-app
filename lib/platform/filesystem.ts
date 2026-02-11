/**
 * Filesystem Adapter (Expo SDK 54)
 *
 * Centralized filesystem API for app code.
 * - Defaults to Expo v54 File/Directory/Paths APIs for core operations.
 * - Falls back to legacy APIs where parity is still required.
 * - Exposes legacy-compatible helpers for staged migration.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';

export interface FsInfo {
  exists: boolean;
  size?: number;
  isDirectory?: boolean | null;
  uri?: string;
  modificationTime?: number;
  creationTime?: number;
  md5?: string;
}

export type UploadFileOptions = LegacyFileSystem.FileSystemUploadOptions;
export type UploadFileResult = LegacyFileSystem.FileSystemUploadResult;
export type DownloadFileOptions = LegacyFileSystem.DownloadOptions;
export type DownloadFileResult = LegacyFileSystem.FileSystemDownloadResult;
export type GetInfoOptions = LegacyFileSystem.InfoOptions;
export type ReadAsStringOptions = LegacyFileSystem.ReadingOptions;
export type WriteAsStringOptions = LegacyFileSystem.WritingOptions;
export type DeleteOptions = LegacyFileSystem.DeletingOptions;
export type RelocatingOptions = LegacyFileSystem.RelocatingOptions;
export type MakeDirectoryOptions = LegacyFileSystem.MakeDirectoryOptions;

// Legacy constants exposed for compatibility with existing callsites.
export const EncodingType = LegacyFileSystem.EncodingType;
export const FileSystemUploadType = LegacyFileSystem.FileSystemUploadType;
export const StorageAccessFramework = LegacyFileSystem.StorageAccessFramework;

// Directory constants exposed with legacy-like naming.
export const cacheDirectory = Paths.cache.uri;
export const documentDirectory = Paths.document.uri;
export const bundleDirectory = Paths.bundle.uri;

function normalizeFsInfo(uri: string, isDirectory: boolean | null, info?: Partial<FsInfo>): FsInfo {
  return {
    exists: Boolean(info?.exists),
    isDirectory,
    uri: info?.uri || uri,
    size: typeof info?.size === 'number' ? info.size : undefined,
    modificationTime: typeof info?.modificationTime === 'number' ? info.modificationTime : undefined,
    creationTime: typeof info?.creationTime === 'number' ? info.creationTime : undefined,
    md5: typeof info?.md5 === 'string' ? info.md5 : undefined,
  };
}

function getPathInfo(uri: string): { exists: boolean; isDirectory: boolean | null } {
  try {
    return Paths.info(uri);
  } catch {
    return { exists: false, isDirectory: null };
  }
}

export async function getInfo(uri: string, options: GetInfoOptions = {}): Promise<FsInfo> {
  try {
    const pathInfo = getPathInfo(uri);
    if (!pathInfo.exists) {
      return normalizeFsInfo(uri, pathInfo.isDirectory, { exists: false });
    }

    if (pathInfo.isDirectory) {
      const dirInfo = new Directory(uri).info();
      return normalizeFsInfo(uri, true, {
        exists: true,
        uri: dirInfo.uri,
        size: typeof dirInfo.size === 'number' ? dirInfo.size : undefined,
        modificationTime: typeof dirInfo.modificationTime === 'number' ? dirInfo.modificationTime : undefined,
        creationTime: typeof dirInfo.creationTime === 'number' ? dirInfo.creationTime : undefined,
      });
    }

    const fileInfo = new File(uri).info({ md5: options?.md5 });
    return normalizeFsInfo(uri, false, {
      exists: true,
      uri: fileInfo.uri,
      size: typeof fileInfo.size === 'number' ? fileInfo.size : undefined,
      modificationTime: typeof fileInfo.modificationTime === 'number' ? fileInfo.modificationTime : undefined,
      creationTime: typeof fileInfo.creationTime === 'number' ? fileInfo.creationTime : undefined,
      md5: typeof fileInfo.md5 === 'string' ? fileInfo.md5 : undefined,
    });
  } catch {
    const legacyInfo = await LegacyFileSystem.getInfoAsync(uri, options);
    const isDirectory = typeof legacyInfo.isDirectory === 'boolean' ? legacyInfo.isDirectory : null;
    return normalizeFsInfo(uri, isDirectory, {
      exists: legacyInfo.exists,
      uri: legacyInfo.uri,
      size: typeof legacyInfo.size === 'number' ? legacyInfo.size : undefined,
      modificationTime: typeof legacyInfo.modificationTime === 'number' ? legacyInfo.modificationTime : undefined,
      md5: typeof legacyInfo.md5 === 'string' ? legacyInfo.md5 : undefined,
    });
  }
}

export async function readBase64(uri: string): Promise<string> {
  try {
    return await new File(uri).base64();
  } catch {
    return LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
  }
}

export async function readText(uri: string): Promise<string> {
  try {
    return await new File(uri).text();
  } catch {
    return LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.UTF8 });
  }
}

export async function copy(from: string, to: string): Promise<void> {
  try {
    const sourceInfo = getPathInfo(from);
    if (!sourceInfo.exists) {
      throw new Error(`Source does not exist: ${from}`);
    }

    if (sourceInfo.isDirectory) {
      new Directory(from).copy(new Directory(to));
    } else {
      new File(from).copy(new File(to));
    }
    return;
  } catch {
    await LegacyFileSystem.copyAsync({ from, to });
  }
}

export async function move(from: string, to: string): Promise<void> {
  try {
    const sourceInfo = getPathInfo(from);
    if (!sourceInfo.exists) {
      throw new Error(`Source does not exist: ${from}`);
    }

    if (sourceInfo.isDirectory) {
      new Directory(from).move(new Directory(to));
    } else {
      new File(from).move(new File(to));
    }
    return;
  } catch {
    await LegacyFileSystem.moveAsync({ from, to });
  }
}

export async function writeText(path: string, text: string, options?: WriteAsStringOptions): Promise<void> {
  const encoding = String(options?.encoding || LegacyFileSystem.EncodingType.UTF8).toLowerCase();
  const fileEncoding = encoding === LegacyFileSystem.EncodingType.Base64 ? 'base64' : 'utf8';

  try {
    const file = new File(path);
    const parent = file.parentDirectory;
    if (!parent.exists) {
      parent.create({ intermediates: true, idempotent: true });
    }
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    file.write(text, { encoding: fileEncoding });
    return;
  } catch {
    await LegacyFileSystem.writeAsStringAsync(path, text, options);
  }
}

export async function deletePath(path: string, options: DeleteOptions = {}): Promise<void> {
  try {
    const info = getPathInfo(path);
    if (!info.exists) {
      if (options?.idempotent) return;
      throw new Error(`Path does not exist: ${path}`);
    }

    if (info.isDirectory) {
      new Directory(path).delete();
    } else {
      new File(path).delete();
    }
    return;
  } catch {
    await LegacyFileSystem.deleteAsync(path, options);
  }
}

export async function ensureDir(path: string, options: MakeDirectoryOptions = {}): Promise<void> {
  try {
    const directory = new Directory(path);
    if (!directory.exists) {
      directory.create({
        intermediates: options?.intermediates ?? true,
        idempotent: true,
      });
    }
    return;
  } catch {
    await LegacyFileSystem.makeDirectoryAsync(path, {
      intermediates: options?.intermediates ?? true,
    });
  }
}

export async function downloadFile(
  url: string,
  path: string,
  options: DownloadFileOptions = {},
): Promise<DownloadFileResult> {
  try {
    const outputFile = new File(path);
    const parent = outputFile.parentDirectory;
    if (!parent.exists) {
      parent.create({ intermediates: true, idempotent: true });
    }
    const downloaded = await File.downloadFileAsync(url, outputFile, {
      headers: options?.headers,
      idempotent: options?.idempotent ?? true,
    });
    return {
      uri: downloaded.uri,
      status: 200,
      headers: {},
      md5: downloaded.md5 || undefined,
    };
  } catch {
    return LegacyFileSystem.downloadAsync(url, path, options);
  }
}

export async function uploadFile(
  url: string,
  path: string,
  options?: UploadFileOptions,
): Promise<UploadFileResult> {
  return LegacyFileSystem.uploadAsync(url, path, options);
}

export function cacheDir(): string {
  return cacheDirectory;
}

export function documentDir(): string {
  return documentDirectory;
}

// Legacy-compatible API aliases for staged migration.
export async function getInfoAsync(fileUri: string, options?: GetInfoOptions): Promise<FsInfo> {
  return getInfo(fileUri, options);
}

export async function readAsStringAsync(fileUri: string, options: ReadAsStringOptions = {}): Promise<string> {
  const encoding = String(options?.encoding || '').toLowerCase();
  if (encoding === LegacyFileSystem.EncodingType.Base64) {
    return readBase64(fileUri);
  }
  return readText(fileUri);
}

export async function writeAsStringAsync(
  fileUri: string,
  contents: string,
  options?: WriteAsStringOptions,
): Promise<void> {
  return writeText(fileUri, contents, options);
}

export async function copyAsync(options: RelocatingOptions): Promise<void> {
  return copy(options.from, options.to);
}

export async function moveAsync(options: RelocatingOptions): Promise<void> {
  return move(options.from, options.to);
}

export async function deleteAsync(fileUri: string, options?: DeleteOptions): Promise<void> {
  return deletePath(fileUri, options);
}

export async function makeDirectoryAsync(fileUri: string, options?: MakeDirectoryOptions): Promise<void> {
  return ensureDir(fileUri, options);
}

export async function readDirectoryAsync(fileUri: string): Promise<string[]> {
  try {
    return new Directory(fileUri).list().map((entry) => entry.name);
  } catch {
    return LegacyFileSystem.readDirectoryAsync(fileUri);
  }
}

export async function downloadAsync(
  uri: string,
  fileUri: string,
  options?: DownloadFileOptions,
): Promise<DownloadFileResult> {
  return downloadFile(uri, fileUri, options);
}

export async function uploadAsync(
  url: string,
  fileUri: string,
  options?: UploadFileOptions,
): Promise<UploadFileResult> {
  return uploadFile(url, fileUri, options);
}

export function createDownloadResumable(
  uri: string,
  fileUri: string,
  options?: DownloadFileOptions,
  callback?: LegacyFileSystem.FileSystemNetworkTaskProgressCallback<LegacyFileSystem.DownloadProgressData>,
  resumeData?: string,
) {
  return LegacyFileSystem.createDownloadResumable(uri, fileUri, options, callback, resumeData);
}

export async function getFreeDiskStorageAsync(): Promise<number> {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return LegacyFileSystem.getFreeDiskStorageAsync();
  }
}

export async function getTotalDiskCapacityAsync(): Promise<number> {
  try {
    return Paths.totalDiskSpace;
  } catch {
    return LegacyFileSystem.getTotalDiskCapacityAsync();
  }
}
