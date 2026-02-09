import React, { useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { formatEmploymentType } from '@/lib/hiring/jobPostingShare';
import { EmploymentType } from '@/types/hiring';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';
import { LinearGradient } from 'expo-linear-gradient';
import JobPostingShareModal from '@/components/principal/JobPostingShareModal';
import JobPostingAIModal from '@/components/principal/JobPostingAIModal';
import JobPostingTemplateSaveModal from '@/components/principal/JobPostingTemplateSaveModal';
import { useJobPostingCreate } from '@/hooks/job-posting-create';

export default function JobPostingCreateScreen() {
  const {
    theme, showAlert, AlertModalComponent,
    title, setTitle, description, setDescription, requirements, setRequirements,
    salaryMin, setSalaryMin, salaryMax, setSalaryMax, location, setLocation,
    employmentType, setEmploymentType, expiresAt, setExpiresAt,
    ageGroup, setAgeGroup, whatsappNumber, setWhatsappNumber,
    submitting, handleSubmit, schoolInfo, draft, templates, ai, logo, share,
  } = useJobPostingCreate();
  const { draftParams, draftLoaded, draftSaving, draftLastSavedAt, clearDraftAndResetForm } = draft;
  const { allTemplates, savedTemplateIds, templatesLoaded, onPressTemplate, deleteSavedTemplate,
    openSaveTemplateModal, templateSaveModalVisible, setTemplateSaveModalVisible, templateName,
    setTemplateName, templateCategory, setTemplateCategory, savingTemplate, handleSaveTemplate } = templates;
  const { aiBusy, aiModalVisible, setAiModalVisible, aiSuggestions, aiUseSuggestedTitle,
    setAiUseSuggestedTitle, canUseAISuggestions, handleAISuggest, applyAISuggestions,
    aiWhatsAppShort, aiWhatsAppLong } = ai;
  const { jobLogoUrl, jobLogoUploading, pendingLogoUri, setPendingLogoUri,
    handlePickJobLogo, confirmLogoUpload, handleClearJobLogo } = logo;
  const { shareModalVisible, setShareModalVisible, shareJobPosting, shareMessage, setShareMessage,
    shareVariant, setShareVariant, broadcasting, setBroadcasting, polishingShareMessage,
    canPolishShareMessageWithAI, sharingPoster, includeSchoolHeader, setIncludeSchoolHeader,
    includeSchoolLogo, setIncludeSchoolLogo, includeSchoolDetails, setIncludeSchoolDetails,
    appWebBaseUrl, posterShotRef, formatSchoolDetails, buildShareMessageForVariant, attachApplyLink,
    handleShareToWhatsApp, handleCopyMessage, handleCopyApplyLink, handleSharePoster,
    handlePolishMessageWithAI, handleWhatsAppBroadcast } = share;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Create Job Posting', headerShown: false }} />
      <AlertModalComponent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job Posting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Draft + Templates + AI */}
        {draftParams ? (
          <View style={styles.draftBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftBarTitle}>Autosave</Text>
              <Text style={styles.draftBarSubtitle}>
                {!draftLoaded
                  ? 'Loading…'
                  : draftSaving
                  ? 'Saving…'
                  : draftLastSavedAt
                  ? `Saved ${new Date(draftLastSavedAt).toLocaleString()}`
                  : 'No draft saved yet'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.draftBarButton}
              onPress={() => {
                showAlert({
                  title: 'Clear Draft?',
                  message: 'This will clear the saved draft and reset the form.',
                  type: 'warning',
                  buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () => {
                        void clearDraftAndResetForm();
                      },
                    },
                  ],
                });
              }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.text} />
              <Text style={styles.draftBarButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="layers-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.sectionTitle}>Templates</Text>
            </View>
            <TouchableOpacity style={styles.sectionHeaderButton} onPress={openSaveTemplateModal}>
              <Ionicons name="bookmark-outline" size={16} color={theme.primary} />
              <Text style={styles.sectionHeaderButtonText}>Save current</Text>
            </TouchableOpacity>
          </View>

          {!templatesLoaded ? (
            <Text style={styles.sectionHint}>Loading templates…</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesRow}>
                {allTemplates.map((t) => {
                  const isSaved = savedTemplateIds.has(t.id);
                  return (
                    <TouchableOpacity key={t.id} style={styles.templateCard} activeOpacity={0.85} onPress={() => onPressTemplate(t)}>
                      <View style={styles.templateCardTop}>
                        <Text style={styles.templateName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        {isSaved ? (
                          <TouchableOpacity
                            style={styles.templateDeleteButton}
                            onPress={() => deleteSavedTemplate(t.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <Text style={styles.templateMeta} numberOfLines={1}>
                        {formatEmploymentType(String(t.employment_type))}
                        {t.category ? ` • ${t.category.toUpperCase()}` : ''}
                      </Text>
                      <Text style={styles.templateTitle} numberOfLines={2}>
                        {t.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.sectionHint}>Tap a template to start fast. Use “Save current” to reuse your best posts.</Text>
            </>
          )}
        </View>

        <View style={styles.aiCard}>
          <LinearGradient
            colors={[theme.primary + '22', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiCardBg}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>AI Assist</Text>
            </View>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>Next-gen</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            Generate or improve your description and requirements using your school info and role type.
          </Text>
          <TouchableOpacity
            style={[styles.aiPrimaryButton, (aiBusy || !canUseAISuggestions) && styles.aiPrimaryButtonDisabled]}
            onPress={handleAISuggest}
            disabled={aiBusy || !canUseAISuggestions}
          >
            {aiBusy ? <EduDashSpinner color="#FFFFFF" /> : <Ionicons name="sparkles" size={18} color="#FFFFFF" />}
            <Text style={styles.aiPrimaryButtonText}>
              {description.trim() || requirements.trim() ? 'Improve With AI' : 'Generate With AI'}
            </Text>
          </TouchableOpacity>
          {!canUseAISuggestions ? (
            <Text style={styles.sectionHint}>Add a job title to enable AI suggestions.</Text>
          ) : null}
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Job Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Early Childhood Teacher"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Job Logo */}
        <View style={styles.field}>
          <Text style={styles.label}>School Logo for This Job (Optional)</Text>
          <View style={styles.logoCard}>
            {jobLogoUrl ? (
              <Image source={{ uri: jobLogoUrl }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={26} color={theme.textSecondary} />
                <Text style={styles.logoPlaceholderText}>No logo uploaded</Text>
              </View>
            )}
            <View style={styles.logoActions}>
              <TouchableOpacity
                style={[styles.logoButton, jobLogoUploading && styles.logoButtonDisabled]}
                disabled={jobLogoUploading}
                onPress={handlePickJobLogo}
              >
                <Text style={styles.logoButtonText}>
                  {jobLogoUploading ? 'Uploading…' : jobLogoUrl ? 'Change Logo' : 'Upload Logo'}
                </Text>
              </TouchableOpacity>
              {jobLogoUrl ? (
                <TouchableOpacity style={styles.logoSecondaryButton} onPress={handleClearJobLogo}>
                  <Text style={styles.logoSecondaryText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.hint}>
              If you skip this, we will use your school logo (or EduDash Pro if none exists).
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the role, responsibilities, and expectations..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Requirements */}
        <View style={styles.field}>
          <Text style={styles.label}>Requirements</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={requirements}
            onChangeText={setRequirements}
            placeholder="List qualifications, experience, certifications..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Salary Range */}
        <View style={styles.field}>
          <Text style={styles.label}>Salary Range (R)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={salaryMin}
                onChangeText={setSalaryMin}
                placeholder="Min"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
            <Text style={[styles.separator, { color: theme.textSecondary }]}>to</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={salaryMax}
                onChangeText={setSalaryMax}
                placeholder="Max"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Johannesburg, Gauteng"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Employment Type */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Employment Type <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.surface }]}>
            <Picker
              selectedValue={employmentType}
              onValueChange={(value) => setEmploymentType(value as EmploymentType)}
              style={styles.picker}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="Full-Time" value={EmploymentType.FULL_TIME} />
              <Picker.Item label="Part-Time" value={EmploymentType.PART_TIME} />
              <Picker.Item label="Contract" value={EmploymentType.CONTRACT} />
              <Picker.Item label="Temporary" value={EmploymentType.TEMPORARY} />
            </Picker>
          </View>
        </View>

        {/* Age Group */}
        <View style={styles.field}>
          <Text style={styles.label}>Age Group</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.surface }]}>
            <Picker
              selectedValue={ageGroup}
              onValueChange={(value) => setAgeGroup(value)}
              style={styles.picker}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="Select age group (optional)" value="" />
              <Picker.Item label="Babies (0–1 year)" value="0-1" />
              <Picker.Item label="Toddlers (1–2 years)" value="1-2" />
              <Picker.Item label="Toddlers (2–3 years)" value="2-3" />
              <Picker.Item label="Preschool (3–4 years)" value="3-4" />
              <Picker.Item label="Pre-K (4–5 years)" value="4-5" />
              <Picker.Item label="Grade R (5–6 years)" value="Grade R" />
              <Picker.Item label="Grade 1–3" value="Grade 1-3" />
              <Picker.Item label="Grade 4–6" value="Grade 4-6" />
              <Picker.Item label="Grade 7–9" value="Grade 7-9" />
              <Picker.Item label="Grade 10–12" value="Grade 10-12" />
              <Picker.Item label="Mixed / All Ages" value="Mixed" />
            </Picker>
          </View>
          <Text style={styles.hint}>What age group will the teacher be working with?</Text>
        </View>

        {/* WhatsApp Number */}
        <View style={styles.field}>
          <Text style={styles.label}>WhatsApp Number</Text>
          <TextInput
            style={styles.input}
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            placeholder="e.g. +27 82 123 4567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>For quick communication with shortlisted candidates</Text>
        </View>

        {/* Expires At */}
        <View style={styles.field}>
          <Text style={styles.label}>Expires At (Optional)</Text>
          <TextInput
            style={styles.input}
            value={expiresAt}
            onChangeText={setExpiresAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.hint}>Leave blank for no expiration</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <EduDashSpinner color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Create Job Posting</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Save Template Modal */}
      <JobPostingTemplateSaveModal
        visible={templateSaveModalVisible}
        onClose={() => setTemplateSaveModalVisible(false)}
        templateName={templateName}
        setTemplateName={setTemplateName}
        templateCategory={templateCategory}
        setTemplateCategory={setTemplateCategory}
        savingTemplate={savingTemplate}
        handleSaveTemplate={handleSaveTemplate}
        theme={theme}
        styles={styles}
      />

      {/* AI Suggestions Modal */}
      <Modal visible={aiModalVisible} transparent={false} animationType="slide" onRequestClose={() => setAiModalVisible(false)}>
        <JobPostingAIModal
          visible={aiModalVisible}
          onClose={() => setAiModalVisible(false)}
          aiSuggestions={aiSuggestions}
          aiUseSuggestedTitle={aiUseSuggestedTitle}
          setAiUseSuggestedTitle={setAiUseSuggestedTitle}
          applyAISuggestions={applyAISuggestions}
          showAlert={showAlert}
          theme={theme}
          styles={styles}
        />
      </Modal>

      <JobPostingShareModal
        visible={shareModalVisible}
        onClose={() => { setShareModalVisible(false); router.back(); }}
        shareJobPosting={shareJobPosting}
        shareMessage={shareMessage}
        setShareMessage={setShareMessage}
        shareVariant={shareVariant}
        setShareVariant={setShareVariant}
        schoolInfo={schoolInfo}
        jobLogoUrl={jobLogoUrl}
        title={title}
        description={description}
        requirements={requirements}
        location={location}
        employmentType={employmentType}
        includeSchoolHeader={includeSchoolHeader}
        setIncludeSchoolHeader={setIncludeSchoolHeader}
        includeSchoolLogo={includeSchoolLogo}
        setIncludeSchoolLogo={setIncludeSchoolLogo}
        includeSchoolDetails={includeSchoolDetails}
        setIncludeSchoolDetails={setIncludeSchoolDetails}
        polishingShareMessage={polishingShareMessage}
        canPolishShareMessageWithAI={canPolishShareMessageWithAI}
        sharingPoster={sharingPoster}
        broadcasting={broadcasting}
        aiWhatsAppShort={aiWhatsAppShort}
        aiWhatsAppLong={aiWhatsAppLong}
        appWebBaseUrl={appWebBaseUrl}
        posterShotRef={posterShotRef}
        buildShareMessageForVariant={buildShareMessageForVariant}
        attachApplyLink={attachApplyLink}
        handleShareToWhatsApp={handleShareToWhatsApp}
        handleCopyMessage={handleCopyMessage}
        handleCopyApplyLink={handleCopyApplyLink}
        handleSharePoster={handleSharePoster}
        handlePolishMessageWithAI={handlePolishMessageWithAI}
        handleBroadcast={() => {
          if (!shareJobPosting) return;
          showAlert({
            title: 'Broadcast to all contacts?',
            message: 'This will send the message to your full WhatsApp contact list. Continue?',
            type: 'warning',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Broadcast',
                style: 'destructive',
                onPress: async () => {
                  setBroadcasting(true);
                  const success = await handleWhatsAppBroadcast(shareJobPosting, shareMessage);
                  setBroadcasting(false);
                  if (success) { setShareModalVisible(false); router.back(); }
                },
              },
            ],
          });
        }}
        formatSchoolDetails={formatSchoolDetails}
        theme={theme}
        styles={styles}
      />

      {/* Logo confirm modal */}
      <ImageConfirmModal
        visible={!!pendingLogoUri}
        imageUri={pendingLogoUri}
        onConfirm={confirmLogoUpload}
        onCancel={() => setPendingLogoUri(null)}
        title="Job Logo"
        confirmLabel="Set Logo"
        showCrop
        cropAspect={[1, 1]}
        loading={jobLogoUploading}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    // ── Draft / Templates / AI ──
    draftBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      marginBottom: 16,
    },
    draftBarTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
    },
    draftBarSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    draftBarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    draftBarButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    sectionCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 12,
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
    },
    sectionHeaderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    sectionHeaderButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.primary,
    },
    sectionHint: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    templatesRow: {
      paddingVertical: 2,
      gap: 12,
    },
    templateCard: {
      width: 220,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 12,
      gap: 6,
    },
    templateCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    templateName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '900',
      color: theme.text,
    },
    templateDeleteButton: {
      padding: 2,
    },
    templateMeta: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    templateTitle: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    aiCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    aiCardBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    aiBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.primary + '1A',
      borderWidth: 1,
      borderColor: theme.primary + '33',
    },
    aiBadgeText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.primary,
    },
    aiPrimaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    aiPrimaryButtonDisabled: {
      opacity: 0.6,
    },
    aiPrimaryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },
    field: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    required: {
      color: theme.error,
    },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    textArea: {
      minHeight: 100,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    separator: {
      fontSize: 14,
      paddingHorizontal: 4,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    picker: {
      color: theme.text,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    logoCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
    },
    logoPreview: {
      width: 84,
      height: 84,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    logoPlaceholder: {
      width: 120,
      height: 84,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    logoPlaceholderText: {
      marginTop: 6,
      fontSize: 12,
      color: theme.textSecondary,
    },
    logoActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    logoButton: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    logoButtonDisabled: {
      opacity: 0.6,
    },
    logoButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    logoSecondaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    logoSecondaryText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // ── Template Save Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.text,
    },
    modalSubtitle: {
      marginTop: 8,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
      marginBottom: 14,
    },
    modalLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    modalInput: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      marginBottom: 14,
    },
    modalPickerContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 14,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButtonSecondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 12,
    },
    modalButtonSecondaryText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
    },
    modalButtonPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor: theme.primary,
      paddingVertical: 12,
    },
    modalButtonPrimaryText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    modalButtonDisabled: {
      opacity: 0.6,
    },
    // ── AI Modal ──
    aiModalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    aiModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    aiModalClose: {
      padding: 8,
    },
    aiModalHeaderCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    aiModalTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.text,
    },
    aiModalScroll: {
      flex: 1,
    },
    aiModalContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 12,
    },
    aiSuggestionCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 8,
    },
    aiSuggestionTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    aiSuggestionLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    aiSuggestionSubLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    aiSuggestionText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    aiBulletText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    aiSwitchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    aiSwitchText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textSecondary,
    },
    aiCopyBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.card,
    },
    aiCopyBtnText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.primary,
    },
    aiModalFooter: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    aiFooterBtnSecondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 14,
    },
    aiFooterBtnSecondaryText: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.text,
    },
    aiFooterBtnPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: theme.primary,
      paddingVertical: 14,
    },
    aiFooterBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    // ── Share Screen (full-screen modal) ──
    shareScreenContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    shareHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    shareHeaderClose: {
      padding: 8,
    },
    shareHeaderCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    shareHeaderTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    shareScrollView: {
      flex: 1,
    },
    shareScrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 16,
    },
    // Preview Card
    previewCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      position: 'relative',
    },
    previewGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    schoolHeader: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    schoolLogo: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    schoolLogoPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    schoolLogoText: {
      color: theme.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    schoolHeaderText: {
      flex: 1,
    },
    schoolName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    schoolDetails: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    previewBody: {
      padding: 16,
      gap: 8,
    },
    previewTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    previewMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    previewMetaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.card,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    previewMetaTagText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    previewDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    previewSectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    posterFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    posterQr: {
      width: 96,
      height: 96,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    posterFooterText: {
      flex: 1,
      gap: 4,
    },
    posterFooterLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    posterFooterLink: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.text,
    },
    posterFooterHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    // Invite Code Card
    inviteCodeCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    inviteCodeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    inviteCodeIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteCodeLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inviteCodeValue: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: 1,
      marginTop: 2,
    },
    inviteCodeCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inviteCodeCopyText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primary,
    },
    // Toggle Group
    toggleGroup: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.card,
      gap: 10,
    },
    toggleGroupTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleLabel: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    // Message Section
    messageSection: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    messageSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    messageSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    messageControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    variantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    variantChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    variantChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '14',
    },
    variantChipText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textSecondary,
    },
    variantChipTextActive: {
      color: theme.primary,
    },
    aiPolishChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.primary,
    },
    aiPolishChipDisabled: {
      opacity: 0.65,
    },
    aiPolishChipText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    aiMessageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    aiMessageChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    aiMessageChipText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.text,
    },
    messageInput: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 13,
      color: theme.text,
      minHeight: 140,
      textAlignVertical: 'top',
      lineHeight: 19,
    },
    // Share Actions
    shareActionsSection: {
      gap: 10,
    },
    whatsappShareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#25D366',
      borderRadius: 14,
      paddingVertical: 16,
    },
    whatsappShareText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    shareSecondaryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    copyMessageBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: theme.surface,
    },
    copyMessageText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
    },
    copyLinkBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: theme.surface,
    },
    posterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: theme.primary + '10',
    },
    posterBtnDisabled: {
      opacity: 0.65,
    },
    posterBtnText: {
      color: theme.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    broadcastBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    broadcastBtnText: {
      color: '#f59e0b',
      fontWeight: '700',
      fontSize: 14,
    },
    // Done Button
    doneButton: {
      alignItems: 'center',
      paddingVertical: 14,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    doneButtonText: {
      color: theme.textSecondary,
      fontWeight: '700',
      fontSize: 15,
    },
    shareFooterText: {
      textAlign: 'center',
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 4,
    },
  });
