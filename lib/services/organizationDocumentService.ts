/**
 * Organization Document Vault Service
 * Handles secure document storage, encryption, and access management
 */

import { assertSupabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export type AccessLevel = 'public' | 'members' | 'managers' | 'executives' | 'admin_only' | 'custom';
export type DocumentType = 'general' | 'policy' | 'legal' | 'financial' | 'governance' | 'disciplinary' | 'template' | 'certificate' | 'report' | 'confidential';
export type Permission = 'view' | 'download' | 'edit' | 'admin';

export interface DocumentFolder {
  id: string;
  organization_id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  default_access_level: AccessLevel;
  folder_path: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationDocument {
  id: string;
  organization_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  document_type: DocumentType;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  storage_path: string;
  is_encrypted: boolean;
  encryption_key_id: string | null;
  version: number;
  previous_version_id: string | null;
  access_level: AccessLevel;
  requires_approval: boolean;
  tags: string[];
  metadata: Record<string, any>;
  uploaded_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_deleted: boolean;
  // Joined fields
  folder?: DocumentFolder;
  uploader?: {
    id: string;
    full_name: string;
  };
}

export interface DocumentAccessGrant {
  id: string;
  document_id: string;
  grantee_user_id: string | null;
  grantee_role: string | null;
  grantee_region_id: string | null;
  permission: Permission;
  valid_from: string;
  valid_until: string | null;
  granted_by: string;
  revoked_by: string | null;
  revoked_at: string | null;
  reason: string | null;
  created_at: string;
  // Joined
  grantee?: {
    id: string;
    full_name: string;
  };
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  parent_folder_id?: string | null;
  icon?: string;
  color?: string;
  default_access_level?: AccessLevel;
}

export interface UploadDocumentInput {
  name: string;
  description?: string;
  folder_id?: string | null;
  document_type?: DocumentType;
  access_level?: AccessLevel;
  tags?: string[];
  requires_approval?: boolean;
  encrypt?: boolean;
}

export interface GrantAccessInput {
  document_id: string;
  grantee_user_id?: string;
  grantee_role?: string;
  grantee_region_id?: string;
  permission: Permission;
  valid_until?: string;
  reason?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class OrganizationDocumentService {
  private static readonly BUCKET_NAME = 'organization-documents';

  // --------------------------------------------------------------------------
  // FOLDERS
  // --------------------------------------------------------------------------

  /**
   * Create a new folder
   */
  static async createFolder(
    organizationId: string,
    userId: string,
    input: CreateFolderInput
  ): Promise<{ success: boolean; data?: DocumentFolder; error?: string }> {
    try {
      console.log('[DocVault] Creating folder:', input.name);

      // Build folder path
      let folderPath = '/';
      if (input.parent_folder_id) {
        const { data: parent } = await assertSupabase()
          .from('organization_document_folders')
          .select('folder_path')
          .eq('id', input.parent_folder_id)
          .single();
        if (parent) {
          folderPath = `${parent.folder_path}${input.name}/`;
        }
      } else {
        folderPath = `/${input.name}/`;
      }

      const { data, error } = await assertSupabase()
        .from('organization_document_folders')
        .insert({
          organization_id: organizationId,
          parent_folder_id: input.parent_folder_id || null,
          name: input.name,
          description: input.description || null,
          icon: input.icon || 'folder',
          color: input.color || '#3B82F6',
          default_access_level: input.default_access_level || 'admin_only',
          folder_path: folderPath,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('[DocVault] Create folder error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[DocVault] Unexpected error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get folders for an organization
   */
  static async getFolders(
    organizationId: string,
    parentId?: string | null
  ): Promise<{ success: boolean; data?: DocumentFolder[]; error?: string }> {
    try {
      let query = assertSupabase()
        .from('organization_document_folders')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (parentId === null) {
        query = query.is('parent_folder_id', null);
      } else if (parentId) {
        query = query.eq('parent_folder_id', parentId);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // --------------------------------------------------------------------------
  // DOCUMENTS
  // --------------------------------------------------------------------------

  /**
   * Upload a document
   */
  static async uploadDocument(
    organizationId: string,
    userId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    input: UploadDocumentInput
  ): Promise<{ success: boolean; data?: OrganizationDocument; error?: string }> {
    try {
      console.log('[DocVault] Uploading document:', fileName);

      // Generate unique storage path
      const timestamp = Date.now();
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${organizationId}/${timestamp}_${sanitizedName}`;

      // Read file content
      let fileContent: ArrayBuffer;
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        fileContent = await response.arrayBuffer();
      } else {
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileContent = bytes.buffer;
      }

      // Optional encryption
      let encryptionKeyId: string | null = null;
      if (input.encrypt) {
        // Generate encryption key ID (actual encryption would be done server-side)
        encryptionKeyId = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${organizationId}-${timestamp}-${Math.random()}`
        );
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await assertSupabase()
        .storage
        .from(this.BUCKET_NAME)
        .upload(storagePath, fileContent, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[DocVault] Upload error:', uploadError);
        return { success: false, error: uploadError.message };
      }

      // Get public URL
      const { data: urlData } = assertSupabase()
        .storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(storagePath);

      // Create document record
      const { data, error } = await assertSupabase()
        .from('organization_documents')
        .insert({
          organization_id: organizationId,
          folder_id: input.folder_id || null,
          name: input.name,
          description: input.description || null,
          document_type: input.document_type || 'general',
          file_url: urlData.publicUrl,
          file_name: fileName,
          file_size: fileContent.byteLength,
          mime_type: mimeType,
          storage_path: storagePath,
          is_encrypted: input.encrypt || false,
          encryption_key_id: encryptionKeyId,
          access_level: input.access_level || 'admin_only',
          requires_approval: input.requires_approval || false,
          tags: input.tags || [],
          uploaded_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('[DocVault] Insert error:', error);
        // Try to clean up uploaded file
        await assertSupabase().storage.from(this.BUCKET_NAME).remove([storagePath]);
        return { success: false, error: error.message };
      }

      // Log the upload
      await this.logAccess(data.id, 'upload', { fileName, mimeType });

      return { success: true, data };
    } catch (err) {
      console.error('[DocVault] Unexpected error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get documents for an organization
   */
  static async getDocuments(
    organizationId: string,
    options?: {
      folderId?: string | null;
      documentType?: DocumentType;
      accessLevel?: AccessLevel;
      includeDeleted?: boolean;
      limit?: number;
    }
  ): Promise<{ success: boolean; data?: OrganizationDocument[]; error?: string }> {
    try {
      let query = assertSupabase()
        .from('organization_documents')
        .select(`
          *,
          folder:organization_document_folders(id, name, icon, color),
          uploader:profiles!uploaded_by(id, full_name)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (!options?.includeDeleted) {
        query = query.eq('is_deleted', false);
      }
      if (options?.folderId === null) {
        query = query.is('folder_id', null);
      } else if (options?.folderId) {
        query = query.eq('folder_id', options.folderId);
      }
      if (options?.documentType) {
        query = query.eq('document_type', options.documentType);
      }
      if (options?.accessLevel) {
        query = query.eq('access_level', options.accessLevel);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get a single document by ID
   */
  static async getDocument(
    documentId: string
  ): Promise<{ success: boolean; data?: OrganizationDocument; error?: string }> {
    try {
      const { data, error } = await assertSupabase()
        .from('organization_documents')
        .select(`
          *,
          folder:organization_document_folders(id, name, icon, color),
          uploader:profiles!uploaded_by(id, full_name)
        `)
        .eq('id', documentId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Log view
      await this.logAccess(documentId, 'view');

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Delete a document (soft delete)
   */
  static async deleteDocument(
    documentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await assertSupabase()
        .from('organization_documents')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq('id', documentId);

      if (error) {
        return { success: false, error: error.message };
      }

      await this.logAccess(documentId, 'delete');

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // --------------------------------------------------------------------------
  // ACCESS MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Grant access to a document
   */
  static async grantAccess(
    userId: string,
    input: GrantAccessInput
  ): Promise<{ success: boolean; data?: DocumentAccessGrant; error?: string }> {
    try {
      console.log('[DocVault] Granting access:', input);

      const { data, error } = await assertSupabase()
        .from('organization_document_access')
        .insert({
          document_id: input.document_id,
          grantee_user_id: input.grantee_user_id || null,
          grantee_role: input.grantee_role || null,
          grantee_region_id: input.grantee_region_id || null,
          permission: input.permission,
          valid_until: input.valid_until || null,
          reason: input.reason || null,
          granted_by: userId,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await this.logAccess(input.document_id, 'share', {
        grantee_user_id: input.grantee_user_id,
        permission: input.permission,
      });

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Revoke document access
   */
  static async revokeAccess(
    accessId: string,
    userId: string,
    documentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await assertSupabase()
        .from('organization_document_access')
        .update({
          revoked_by: userId,
          revoked_at: new Date().toISOString(),
        })
        .eq('id', accessId);

      if (error) {
        return { success: false, error: error.message };
      }

      await this.logAccess(documentId, 'revoke_access', { accessId });

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get access grants for a document
   */
  static async getAccessGrants(
    documentId: string
  ): Promise<{ success: boolean; data?: DocumentAccessGrant[]; error?: string }> {
    try {
      const { data, error } = await assertSupabase()
        .from('organization_document_access')
        .select(`
          *,
          grantee:profiles!grantee_user_id(id, full_name)
        `)
        .eq('document_id', documentId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // --------------------------------------------------------------------------
  // AUDIT LOG
  // --------------------------------------------------------------------------

  /**
   * Log document access
   */
  static async logAccess(
    documentId: string,
    action: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      await assertSupabase().rpc('log_document_access', {
        p_document_id: documentId,
        p_action: action,
        p_details: details,
      });
    } catch (err) {
      console.error('[DocVault] Log access error:', err);
    }
  }

  /**
   * Get audit log for a document
   */
  static async getAuditLog(
    documentId: string,
    limit = 50
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const { data, error } = await assertSupabase()
        .from('organization_document_audit_log')
        .select(`
          *,
          user:profiles!user_id(id, full_name)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // --------------------------------------------------------------------------
  // DOWNLOAD
  // --------------------------------------------------------------------------

  /**
   * Download a document (logs the download)
   */
  static async downloadDocument(
    documentId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const { data: doc, error } = await assertSupabase()
        .from('organization_documents')
        .select('file_url, storage_path, is_encrypted')
        .eq('id', documentId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (doc.is_encrypted) {
        // For encrypted documents, would need to decrypt server-side
        // For now, return error
        return { success: false, error: 'Document is encrypted. Contact admin for access.' };
      }

      // Log the download
      await this.logAccess(documentId, 'download');

      return { success: true, url: doc.file_url };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

export default OrganizationDocumentService;
