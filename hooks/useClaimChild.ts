/**
 * useClaimChild — state + handlers for claim-child screen
 *
 * Extracted from parent-claim-child.tsx.
 * Already used useAlertModal — showAlert passed as callback.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ParentJoinService, type SearchedStudent } from '@/lib/services/parentJoinService';
import { useQueryClient } from '@tanstack/react-query';

type ShowAlert = (cfg: {
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}) => void;

type Step = 'search' | 'confirm';
type Relationship = 'mother' | 'father' | 'guardian' | 'other';

export function useClaimChild(showAlert: ShowAlert) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const preschoolId = profile?.organization_id || profile?.preschool_id;

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedStudent[]>([]);
  const [selectedChild, setSelectedChild] = useState<SearchedStudent | null>(null);
  const [relationship, setRelationship] = useState<Relationship>('mother');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (query?: string) => {
    const searchText = query !== undefined ? query : searchQuery;
    if (!searchText.trim()) { setSearchResults([]); return; }
    if (!preschoolId) {
      showAlert({
        title: 'School not linked',
        message: "Your account isn't linked to a school yet. Use your invite link to join your school, or contact the school to send a new invite.",
      });
      return;
    }

    setSearching(true);
    try {
      const results = await ParentJoinService.searchChild(preschoolId, searchText.trim());
      setSearchResults(results);
      if (results.length === 0 && query === undefined) {
        showAlert({
          title: 'No Results',
          message: `No children found matching "${searchText}". Please check the spelling or try registering a new child.`,
          buttons: [
            { text: 'Try Again', style: 'cancel' },
            { text: 'Register New Child', onPress: () => router.push('/screens/parent-child-registration') },
          ],
        });
      }
    } catch (error: any) {
      if (query === undefined) {
        showAlert({ title: 'Error', message: error.message || 'Failed to search for child' });
      }
    } finally {
      setSearching(false);
    }
  }, [searchQuery, preschoolId, showAlert]);

  // Live search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(() => { handleSearch(searchQuery); }, 500);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, preschoolId]);

  const handleSelectChild = useCallback((child: SearchedStudent) => {
    setSelectedChild(child);
    setStep('confirm');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedChild || !user) return;
    setSubmitting(true);
    try {
      await ParentJoinService.requestLink({
        schoolId: selectedChild.preschool_id || preschoolId || null,
        parentAuthId: user.id,
        parentEmail: user.email || null,
        studentId: selectedChild.id,
        childFullName: `${selectedChild.first_name} ${selectedChild.last_name}`,
        childClass: selectedChild.age_group?.name || null,
        relationship,
      });
      if (user?.id) queryClient.invalidateQueries({ queryKey: ['guardian-requests', user.id] });
      showAlert({
        title: 'Request Submitted!',
        message: `Your request to link ${selectedChild.first_name} has been sent to the school for approval. You'll be notified when it's reviewed.`,
        buttons: [{ text: 'OK', onPress: () => router.back() }],
      });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : '';
      const friendly = msg.includes('pending request') ? 'You already have a pending request for this child.' : (msg || 'Failed to submit request');
      showAlert({ title: 'Error', message: friendly });
    } finally {
      setSubmitting(false);
    }
  }, [selectedChild, user, preschoolId, relationship, queryClient, showAlert]);

  const calculateAge = useCallback((dob: string): number => {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }, []);

  return {
    step, setStep, searchQuery, setSearchQuery, searchResults, selectedChild,
    relationship, setRelationship, searching, submitting, preschoolId,
    handleSearch, handleSelectChild, handleSubmit, calculateAge,
  };
}
