/**
 * Custom hook for managing activity builder state and logic
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import {
  ActivityType,
  ActivityDraft,
  MatchPair,
  CountingItem,
  createInitialDraft,
  getSkillsForType,
} from '@/components/activity-builder/activity-builder.types';

export type ActivityStep = 'type' | 'details' | 'content';
export type EmojiPickerMode = 'left' | 'right' | 'counting' | null;

export interface UseActivityBuilderReturn {
  // State
  step: ActivityStep;
  draft: ActivityDraft;
  saving: boolean;
  showEmojiPicker: EmojiPickerMode;
  editingIndex: number | null;

  // Navigation handlers
  handleSelectType: (type: ActivityType) => void;
  handleDetailsNext: () => void;
  handleBack: () => void;
  resetForm: () => void;

  // Draft update handlers
  updateDraft: (updates: Partial<ActivityDraft>) => void;
  
  // Match pair handlers
  handleAddMatchPair: () => void;
  handleUpdateMatchPair: (index: number, field: 'left' | 'right', value: string) => void;
  handleRemoveMatchPair: (index: number) => void;
  
  // Counting item handlers
  handleAddCountingItem: () => void;
  handleUpdateCountingItem: (index: number, field: 'emoji' | 'count', value: string | number) => void;
  handleRemoveCountingItem: (index: number) => void;
  
  // Emoji picker handlers
  openEmojiPicker: (mode: EmojiPickerMode, index: number) => void;
  handleEmojiSelect: (emoji: string) => void;
  closeEmojiPicker: () => void;
  
  // Save handler
  handleSave: () => Promise<void>;
}

export function useActivityBuilder(): UseActivityBuilderReturn {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState<ActivityStep>('type');
  const [draft, setDraft] = useState<ActivityDraft>(createInitialDraft());
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<EmojiPickerMode>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // ====================================================================
  // NAVIGATION HANDLERS
  // ====================================================================

  const handleSelectType = useCallback((type: ActivityType) => {
    setDraft(prev => ({ ...prev, type }));
    setStep('details');
  }, []);

  const handleDetailsNext = useCallback(() => {
    if (!draft.title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your activity');
      return;
    }
    setStep('content');
  }, [draft.title]);

  const handleBack = useCallback(() => {
    if (step === 'content') {
      setStep('details');
    } else if (step === 'details') {
      setStep('type');
    } else {
      router.back();
    }
  }, [step, router]);

  const resetForm = useCallback(() => {
    setDraft(createInitialDraft());
    setStep('type');
  }, []);

  // ====================================================================
  // DRAFT UPDATE HANDLERS
  // ====================================================================

  const updateDraft = useCallback((updates: Partial<ActivityDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  // ====================================================================
  // MATCH PAIR HANDLERS
  // ====================================================================

  const handleAddMatchPair = useCallback(() => {
    const newPair: MatchPair = {
      id: `pair-${Date.now()}`,
      left: '',
      right: '',
    };
    setDraft(prev => ({
      ...prev,
      pairs: [...(prev.pairs || []), newPair],
    }));
  }, []);

  const handleUpdateMatchPair = useCallback((index: number, field: 'left' | 'right', value: string) => {
    setDraft(prev => ({
      ...prev,
      pairs: prev.pairs?.map((p, i) => i === index ? { ...p, [field]: value } : p),
    }));
  }, []);

  const handleRemoveMatchPair = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      pairs: prev.pairs?.filter((_, i) => i !== index),
    }));
  }, []);

  // ====================================================================
  // COUNTING ITEM HANDLERS
  // ====================================================================

  const handleAddCountingItem = useCallback(() => {
    const newItem: CountingItem = {
      id: `count-${Date.now()}`,
      emoji: '🍎',
      count: 1,
    };
    setDraft(prev => ({
      ...prev,
      countingItems: [...(prev.countingItems || []), newItem],
    }));
  }, []);

  const handleUpdateCountingItem = useCallback((index: number, field: 'emoji' | 'count', value: string | number) => {
    setDraft(prev => ({
      ...prev,
      countingItems: prev.countingItems?.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }, []);

  const handleRemoveCountingItem = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      countingItems: prev.countingItems?.filter((_, i) => i !== index),
    }));
  }, []);

  // ====================================================================
  // EMOJI PICKER HANDLERS
  // ====================================================================

  const openEmojiPicker = useCallback((mode: EmojiPickerMode, index: number) => {
    setEditingIndex(index);
    setShowEmojiPicker(mode);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (showEmojiPicker === 'left' && editingIndex !== null) {
      handleUpdateMatchPair(editingIndex, 'left', emoji);
    } else if (showEmojiPicker === 'right' && editingIndex !== null) {
      handleUpdateMatchPair(editingIndex, 'right', emoji);
    } else if (showEmojiPicker === 'counting' && editingIndex !== null) {
      handleUpdateCountingItem(editingIndex, 'emoji', emoji);
    }
    setShowEmojiPicker(null);
    setEditingIndex(null);
  }, [showEmojiPicker, editingIndex, handleUpdateMatchPair, handleUpdateCountingItem]);

  const closeEmojiPicker = useCallback(() => {
    setShowEmojiPicker(null);
    setEditingIndex(null);
  }, []);

  // ====================================================================
  // SAVE HANDLER
  // ====================================================================

  const handleSave = useCallback(async () => {
    if (!profile?.preschool_id) {
      Alert.alert('Error', 'You must be associated with a school');
      return;
    }

    // Validate content
    if (draft.type === 'matching' && (!draft.pairs || draft.pairs.length < 2)) {
      Alert.alert('Not Enough Pairs', 'Please add at least 2 matching pairs');
      return;
    }
    if (draft.type === 'counting' && (!draft.countingItems || draft.countingItems.length < 2)) {
      Alert.alert('Not Enough Items', 'Please add at least 2 counting items');
      return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();

      // Build content JSON
      let content = {};
      if (draft.type === 'matching') {
        content = {
          pairs: draft.pairs?.map(p => ({
            id: p.id,
            image1: p.left,
            text2: p.right,
          })),
        };
      } else if (draft.type === 'counting') {
        content = {
          items: draft.countingItems?.map(item => ({
            image: item.emoji.repeat(item.count),
            count: item.count,
          })),
        };
      }

      const { error } = await supabase
        .from('interactive_activities')
        .insert({
          preschool_id: profile.preschool_id,
          teacher_id: user?.id,
          activity_type: draft.type,
          title: draft.title,
          instructions: draft.instructions || `Complete the ${draft.type} activity!`,
          content,
          difficulty_level: draft.difficulty,
          age_group_min: draft.ageGroupMin,
          age_group_max: draft.ageGroupMax,
          stars_reward: draft.starsReward,
          subject: draft.subject,
          skills: JSON.stringify(getSkillsForType(draft.type)),
          is_active: false,
          is_published: false,
          approval_status: 'pending',
          approved_by: null,
          approved_at: null,
          is_template: false,
        });

      if (error) throw error;

      Alert.alert('Success!', 'Activity created successfully! 🎉', [
        { text: 'Create Another', onPress: resetForm },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [profile?.preschool_id, user?.id, draft, resetForm, router]);

  return {
    // State
    step,
    draft,
    saving,
    showEmojiPicker,
    editingIndex,

    // Navigation handlers
    handleSelectType,
    handleDetailsNext,
    handleBack,
    resetForm,

    // Draft update handlers
    updateDraft,

    // Match pair handlers
    handleAddMatchPair,
    handleUpdateMatchPair,
    handleRemoveMatchPair,

    // Counting item handlers
    handleAddCountingItem,
    handleUpdateCountingItem,
    handleRemoveCountingItem,

    // Emoji picker handlers
    openEmojiPicker,
    handleEmojiSelect,
    closeEmojiPicker,

    // Save handler
    handleSave,
  };
}
