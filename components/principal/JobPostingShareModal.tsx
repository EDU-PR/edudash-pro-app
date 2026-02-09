/** Share screen modal — extracted from job-posting-create.tsx */
import React from 'react';
import { Image, Linking, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { buildApplyLink, formatEmploymentType, formatSalaryRange, type WhatsAppMessageVariant } from '@/lib/hiring/jobPostingShare';

interface SchoolInfo {
  name: string;
  logoUrl?: string | null;
  type?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  city?: string | null;
  province?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  shareJobPosting: any;
  shareMessage: string;
  setShareMessage: (msg: string) => void;
  shareVariant: WhatsAppMessageVariant;
  schoolInfo: SchoolInfo | null;
  jobLogoUrl: string | null;
  title: string;
  description: string;
  requirements: string;
  location: string;
  employmentType: string;
  includeSchoolHeader: boolean;
  setIncludeSchoolHeader: (v: boolean) => void;
  includeSchoolLogo: boolean;
  setIncludeSchoolLogo: (v: boolean) => void;
  includeSchoolDetails: boolean;
  setIncludeSchoolDetails: (v: boolean) => void;
  polishingShareMessage: boolean;
  canPolishShareMessageWithAI: boolean;
  sharingPoster: boolean;
  broadcasting: boolean;
  aiWhatsAppShort: string | null;
  aiWhatsAppLong: string | null;
  appWebBaseUrl: string;
  posterShotRef: React.RefObject<ViewShot>;
  // Callbacks
  buildShareMessageForVariant: (variant: WhatsAppMessageVariant, job: any) => string;
  attachApplyLink: (msg: string, jobId: string) => string;
  handleShareToWhatsApp: () => void;
  handleCopyMessage: () => void;
  handleCopyApplyLink: () => void;
  handleSharePoster: () => void;
  handlePolishMessageWithAI: () => void;
  handleBroadcast: () => void;
  formatSchoolDetails: (info: SchoolInfo | null) => string;
  setShareVariant: (v: WhatsAppMessageVariant) => void;
  theme: any;
  styles: any;
}

export default function JobPostingShareModal({
  visible, onClose, shareJobPosting, shareMessage, setShareMessage,
  shareVariant, schoolInfo, jobLogoUrl, title, description, requirements,
  location, employmentType, includeSchoolHeader, setIncludeSchoolHeader,
  includeSchoolLogo, setIncludeSchoolLogo, includeSchoolDetails, setIncludeSchoolDetails,
  polishingShareMessage, canPolishShareMessageWithAI, sharingPoster, broadcasting,
  aiWhatsAppShort, aiWhatsAppLong, appWebBaseUrl, posterShotRef,
  buildShareMessageForVariant, attachApplyLink, handleShareToWhatsApp,
  handleCopyMessage, handleCopyApplyLink, handleSharePoster,
  handlePolishMessageWithAI, handleBroadcast, formatSchoolDetails,
  setShareVariant, theme, styles,
}: Props) {
  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.shareScreenContainer} edges={['top', 'bottom']}>
        <View style={styles.shareHeader}>
          <TouchableOpacity style={styles.shareHeaderClose} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.shareHeaderCenter}>
            <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
            <Text style={styles.shareHeaderTitle}>Job Posted!</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.shareScrollView} contentContainerStyle={styles.shareScrollContent} showsVerticalScrollIndicator={false}>
          {/* Job Preview Card (shareable poster) */}
          <ViewShot ref={posterShotRef} options={{ format: 'png', quality: 0.95, result: 'tmpfile' }} style={styles.previewCard}>
            <LinearGradient colors={[theme.primary + '22', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewGradient} />
            {includeSchoolHeader && (schoolInfo || jobLogoUrl) ? (
              <View style={styles.schoolHeader}>
                {includeSchoolLogo ? (
                  (jobLogoUrl || schoolInfo?.logoUrl) ? (
                    <Image source={{ uri: jobLogoUrl || schoolInfo?.logoUrl || undefined }} style={styles.schoolLogo} />
                  ) : (
                    <View style={styles.schoolLogoPlaceholder}>
                      <Text style={styles.schoolLogoText}>{schoolInfo?.name?.slice(0, 2).toUpperCase() || 'ED'}</Text>
                    </View>
                  )
                ) : null}
                <View style={styles.schoolHeaderText}>
                  <Text style={styles.schoolName}>{schoolInfo?.name || 'School'}</Text>
                  {includeSchoolDetails ? (
                    <Text style={styles.schoolDetails}>{formatSchoolDetails(schoolInfo) || 'School details unavailable'}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.previewBody}>
              <Text style={styles.previewTitle}>{shareJobPosting?.title || title || 'Teaching Opportunity'}</Text>
              <View style={styles.previewMetaRow}>
                <View style={styles.previewMetaTag}>
                  <Ionicons name="briefcase-outline" size={13} color={theme.primary} />
                  <Text style={styles.previewMetaTagText}>{formatEmploymentType(shareJobPosting?.employment_type || employmentType)}</Text>
                </View>
                <View style={styles.previewMetaTag}>
                  <Ionicons name="location-outline" size={13} color={theme.primary} />
                  <Text style={styles.previewMetaTagText}>{shareJobPosting?.location || location || 'Location TBA'}</Text>
                </View>
                <View style={styles.previewMetaTag}>
                  <Ionicons name="cash-outline" size={13} color="#22c55e" />
                  <Text style={[styles.previewMetaTagText, { color: '#22c55e' }]}>
                    {formatSalaryRange(shareJobPosting?.salary_range_min ?? null, shareJobPosting?.salary_range_max ?? null)}
                  </Text>
                </View>
              </View>
              <View style={styles.previewDivider} />
              <Text style={styles.previewSectionLabel}>Description</Text>
              <Text style={styles.previewText} numberOfLines={6}>{shareJobPosting?.description || description || 'Description will appear here.'}</Text>
              {(shareJobPosting?.requirements || requirements) ? (
                <>
                  <Text style={styles.previewSectionLabel}>Requirements</Text>
                  <Text style={styles.previewText} numberOfLines={5}>{shareJobPosting?.requirements || requirements}</Text>
                </>
              ) : null}
            </View>
            {shareJobPosting?.id ? (
              <View style={styles.posterFooter}>
                <View style={styles.posterQr}>
                  <QRCode value={buildApplyLink({ baseUrl: appWebBaseUrl, jobId: String(shareJobPosting.id) })} size={84} />
                </View>
                <View style={styles.posterFooterText}>
                  <Text style={styles.posterFooterLabel}>Apply online</Text>
                  <Text style={styles.posterFooterLink} numberOfLines={1}>
                    {buildApplyLink({ baseUrl: appWebBaseUrl, jobId: String(shareJobPosting.id) }).replace(/^https?:\/\//i, '')}
                  </Text>
                  <Text style={styles.posterFooterHint}>No account required</Text>
                </View>
              </View>
            ) : null}
          </ViewShot>

          {/* Branding Toggles */}
          <View style={styles.toggleGroup}>
            <Text style={styles.toggleGroupTitle}>Customise Preview</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelRow}>
                <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
                <Text style={styles.toggleLabel}>School header</Text>
              </View>
              <Switch value={includeSchoolHeader} onValueChange={setIncludeSchoolHeader} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={includeSchoolHeader ? '#fff' : theme.textSecondary} />
            </View>
            {includeSchoolHeader && (
              <>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabelRow}>
                    <Ionicons name="image-outline" size={16} color={theme.textSecondary} />
                    <Text style={styles.toggleLabel}>Logo</Text>
                  </View>
                  <Switch value={includeSchoolLogo} onValueChange={setIncludeSchoolLogo} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={includeSchoolLogo ? '#fff' : theme.textSecondary} />
                </View>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabelRow}>
                    <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
                    <Text style={styles.toggleLabel}>Contact details</Text>
                  </View>
                  <Switch value={includeSchoolDetails} onValueChange={setIncludeSchoolDetails} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={includeSchoolDetails ? '#fff' : theme.textSecondary} />
                </View>
              </>
            )}
          </View>

          {/* WhatsApp Message Preview */}
          <View style={styles.messageSection}>
            <View style={styles.messageSectionHeader}>
              <Ionicons name="logo-whatsapp" size={18} color="#22c55e" />
              <Text style={styles.messageSectionTitle}>WhatsApp Message</Text>
            </View>
            <View style={styles.messageControlsRow}>
              <View style={styles.variantRow}>
                <TouchableOpacity
                  style={[styles.variantChip, shareVariant === 'short' && styles.variantChipActive]}
                  onPress={() => { if (!shareJobPosting) return; setShareVariant('short'); setShareMessage(buildShareMessageForVariant('short', shareJobPosting)); }}
                >
                  <Text style={[styles.variantChipText, shareVariant === 'short' && styles.variantChipTextActive]}>Short</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.variantChip, shareVariant === 'detailed' && styles.variantChipActive]}
                  onPress={() => { if (!shareJobPosting) return; setShareVariant('detailed'); setShareMessage(buildShareMessageForVariant('detailed', shareJobPosting)); }}
                >
                  <Text style={[styles.variantChipText, shareVariant === 'detailed' && styles.variantChipTextActive]}>Detailed</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.aiPolishChip, (polishingShareMessage || !canPolishShareMessageWithAI) && styles.aiPolishChipDisabled]}
                disabled={polishingShareMessage || !canPolishShareMessageWithAI}
                onPress={handlePolishMessageWithAI}
              >
                {polishingShareMessage ? <EduDashSpinner size="small" color="#FFFFFF" /> : <Ionicons name="sparkles" size={16} color="#FFFFFF" />}
                <Text style={styles.aiPolishChipText}>AI Polish</Text>
              </TouchableOpacity>
            </View>
            {!canPolishShareMessageWithAI ? <Text style={styles.sectionHint}>Enter a message first to enable AI polish.</Text> : null}

            {(aiWhatsAppShort || aiWhatsAppLong) && shareJobPosting?.id ? (
              <View style={styles.aiMessageRow}>
                {aiWhatsAppShort ? (
                  <TouchableOpacity style={styles.aiMessageChip} onPress={() => setShareMessage(attachApplyLink(aiWhatsAppShort, String(shareJobPosting.id)))}>
                    <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
                    <Text style={styles.aiMessageChipText}>Use AI short</Text>
                  </TouchableOpacity>
                ) : null}
                {aiWhatsAppLong ? (
                  <TouchableOpacity style={styles.aiMessageChip} onPress={() => setShareMessage(attachApplyLink(aiWhatsAppLong, String(shareJobPosting.id)))}>
                    <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
                    <Text style={styles.aiMessageChipText}>Use AI long</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <TextInput
              style={styles.messageInput}
              value={shareMessage}
              onChangeText={setShareMessage}
              placeholder="Message preview..."
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Share Actions */}
          <View style={styles.shareActionsSection}>
            <TouchableOpacity style={styles.whatsappShareBtn} onPress={handleShareToWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.whatsappShareText}>Share to WhatsApp</Text>
            </TouchableOpacity>
            <View style={styles.shareSecondaryRow}>
              <TouchableOpacity style={styles.copyMessageBtn} onPress={handleCopyMessage}>
                <Ionicons name="copy-outline" size={18} color={theme.text} />
                <Text style={styles.copyMessageText}>Copy Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyApplyLink}>
                <Ionicons name="link-outline" size={18} color={theme.text} />
                <Text style={styles.copyMessageText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.shareSecondaryRow}>
              <TouchableOpacity style={[styles.posterBtn, sharingPoster && styles.posterBtnDisabled]} disabled={sharingPoster} onPress={handleSharePoster}>
                {sharingPoster ? <EduDashSpinner size="small" color={theme.primary} /> : <Ionicons name="image-outline" size={18} color={theme.primary} />}
                <Text style={styles.posterBtnText}>{sharingPoster ? 'Preparing…' : 'Share Poster'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.broadcastBtn} disabled={broadcasting} onPress={handleBroadcast}>
                <Ionicons name="megaphone-outline" size={18} color="#f59e0b" />
                <Text style={styles.broadcastBtnText}>{broadcasting ? 'Sending…' : 'Broadcast'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Done */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.shareFooterText}>Posted via EduDash Pro Hiring Hub</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
