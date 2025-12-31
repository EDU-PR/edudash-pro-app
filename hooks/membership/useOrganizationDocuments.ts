/**
 * Hook for fetching organization documents
 * Used for policies, governance documents, and other organizational files
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface OrganizationDocument {
  id: string;
  name: string;
  description: string | null;
  document_type: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  version: number;
  access_level: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  organization_id: string;
  // For policy list display
  title?: string;
  category?: string;
  lastUpdated?: string;
  status?: 'active' | 'under-review' | 'draft';
}

interface UseOrganizationDocumentsResult {
  documents: OrganizationDocument[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrganizationDocuments(
  organizationId?: string,
  documentType?: string
): UseOrganizationDocumentsResult {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<OrganizationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = organizationId || profile?.organization_membership?.organization_id;

  const fetchDocuments = useCallback(async () => {
    if (!orgId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabase = assertSupabase();

      let query = supabase
        .from('organization_documents')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      // Filter by document type if provided
      if (documentType) {
        query = query.eq('document_type', documentType);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Map to include policy-compatible fields
      const mappedDocs = (data || []).map(doc => ({
        ...doc,
        title: doc.name,
        category: doc.document_type,
        lastUpdated: doc.updated_at,
        status: doc.access_level === 'draft' ? 'draft' as const : 
               doc.requires_approval && !doc.approved_at ? 'under-review' as const : 
               'active' as const,
      }));

      setDocuments(mappedDocs);
    } catch (err) {
      console.error('Error fetching organization documents:', err);
      setError('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, documentType]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
  };
}

export default useOrganizationDocuments;
