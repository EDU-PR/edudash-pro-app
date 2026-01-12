// filepath: /media/king/5e026cdc-594e-4493-bf92-c35c231beea3/home/king/Desktop/dashpro/app/screens/teacher-activity-builder.tsx
/**
 * Teacher Activity Builder Screen
 * 
 * Allows teachers to create and manage interactive activities
 * for preschool students (matching games, counting, etc.)
 * 
 * Refactored to use extracted components and hook for WARP.md compliance
 */

import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useActivityBuilder } from '@/hooks/useActivityBuilder';
import {
  ActivityTypeSelector,
  ActivityDetailsForm,
  ActivityContentBuilder,
  ProgressSteps,
  activityBuilderStyles as styles,
} from '@/components/activity-builder';

export default function TeacherActivityBuilder() {
  const { colors } = useTheme();
  
  const {
    // State
    step,
    draft,
    saving,
    showEmojiPicker,

    // Navigation handlers
    handleSelectType,
    handleDetailsNext,
    handleBack,

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
  } = useActivityBuilder();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SubPageHeader
        title="Create Activity"
        onBack={handleBack}
      />

      {/* Progress Steps */}
      <ProgressSteps currentStep={step} />

      {/* Step Content */}
      {step === 'type' && (
        <ActivityTypeSelector
          selectedType={draft.type}
          onSelectType={handleSelectType}
        />
      )}

      {step === 'details' && (
        <ActivityDetailsForm
          draft={draft}
          onUpdateDraft={updateDraft}
          onNext={handleDetailsNext}
        />
      )}

      {step === 'content' && (
        <ActivityContentBuilder
          draft={draft}
          saving={saving}
          showEmojiPicker={showEmojiPicker}
          onAddMatchPair={handleAddMatchPair}
          onUpdateMatchPair={handleUpdateMatchPair}
          onRemoveMatchPair={handleRemoveMatchPair}
          onAddCountingItem={handleAddCountingItem}
          onUpdateCountingItem={handleUpdateCountingItem}
          onRemoveCountingItem={handleRemoveCountingItem}
          onOpenEmojiPicker={openEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
          onCloseEmojiPicker={closeEmojiPicker}
          onSave={handleSave}
        />
      )}
    </SafeAreaView>
  );
}
