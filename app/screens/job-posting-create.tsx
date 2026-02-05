import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal, Linking, Platform, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { InviteCodeService } from '@/lib/services/inviteCodeService';
import { EmploymentType } from '@/types/hiring';
import * as Clipboard from 'expo-clipboard';
import { assertSupabase } from '@/lib/supabase';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function JobPostingCreateScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareJobPosting, setShareJobPosting] = useState<any | null>(null);
  const [shareInviteCode, setShareInviteCode] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string;
    logoUrl?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    city?: string | null;
    province?: string | null;
  } | null>(null);
  const [includeSchoolHeader, setIncludeSchoolHeader] = useState(true);
  const [includeSchoolLogo, setIncludeSchoolLogo] = useState(true);
  const [includeSchoolDetails, setIncludeSchoolDetails] = useState(true);

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Job title is required');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Job description is required');
      return false;
    }
    if (!employmentType) {
      Alert.alert('Validation Error', 'Employment type is required');
      return false;
    }

    const minSalary = salaryMin ? parseFloat(salaryMin) : null;
    const maxSalary = salaryMax ? parseFloat(salaryMax) : null;

    if (minSalary && isNaN(minSalary)) {
      Alert.alert('Validation Error', 'Minimum salary must be a valid number');
      return false;
    }
    if (maxSalary && isNaN(maxSalary)) {
      Alert.alert('Validation Error', 'Maximum salary must be a valid number');
      return false;
    }
    if (minSalary && maxSalary && minSalary > maxSalary) {
      Alert.alert('Validation Error', 'Minimum salary cannot be greater than maximum salary');
      return false;
    }

    return true;
  };

  const formatEmploymentType = (rawValue: string) => {
    const value = String(rawValue || '').toLowerCase();
    if (value === 'full_time' || value === 'full-time') return 'Full-Time';
    if (value === 'part_time' || value === 'part-time') return 'Part-Time';
    if (value === 'contract') return 'Contract';
    if (value === 'temporary') return 'Temporary';
    return 'Employment Type TBA';
  };

  const formatSalaryRange = (jobPosting: any) => {
    if (jobPosting.salary_range_min && jobPosting.salary_range_max) {
      return `R${jobPosting.salary_range_min} - R${jobPosting.salary_range_max}`;
    }
    if (jobPosting.salary_range_min) {
      return `From R${jobPosting.salary_range_min}`;
    }
    return 'Negotiable';
  };

  const formatSchoolDetails = (info: typeof schoolInfo) => {
    if (!info) return '';
    const locationParts = [info.city, info.province].filter(Boolean).join(', ');
    const detailParts = [locationParts, info.phone, info.email, info.website].filter(Boolean);
    return detailParts.join(' • ');
  };

  const buildWhatsAppMessage = (jobPosting: any, inviteCode?: string) => {
    const jobTitle = jobPosting.title || title;
    const jobLocation = jobPosting.location || location || 'Location TBA';
    const jobRequirements = jobPosting.requirements || requirements || '';
    const salaryRange =
      jobPosting.salary_range_min && jobPosting.salary_range_max
        ? `R${jobPosting.salary_range_min} - R${jobPosting.salary_range_max}`
        : jobPosting.salary_range_min
        ? `From R${jobPosting.salary_range_min}`
        : 'Negotiable';
    const employmentTypeRaw = String(jobPosting.employment_type || '').toLowerCase();
    const employmentTypeDisplay =
      employmentTypeRaw === 'full_time' || employmentTypeRaw === 'full-time'
        ? 'Full-Time'
        : employmentTypeRaw === 'part_time' || employmentTypeRaw === 'part-time'
        ? 'Part-Time'
        : employmentTypeRaw === 'contract'
        ? 'Contract'
        : employmentTypeRaw === 'temporary'
        ? 'Temporary'
        : 'Employment Type TBA';

    const appUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.org.za';
    const applicationLink = inviteCode
      ? `${appUrl}/apply/${jobPosting.id}?invite=${encodeURIComponent(inviteCode)}`
      : `${appUrl}/apply/${jobPosting.id}`;
    const teacherSignupLink = inviteCode
      ? `${appUrl}/sign-up/teacher?invite=${encodeURIComponent(inviteCode)}`
      : `${appUrl}/sign-up/teacher`;
    const requirementsLine = jobRequirements ? `*Requirements:* ${jobRequirements}\n` : '';
    const inviteLine = inviteCode
      ? `*Invite Code:* ${inviteCode}\n*Teacher Sign Up:* ${teacherSignupLink}\n\n`
      : '';

    return `🎓 *New Teaching Opportunity!*\n\n` +
      `*Position:* ${jobTitle}\n` +
      `*Type:* ${employmentTypeDisplay}\n` +
      `*Location:* ${jobLocation}\n` +
      `*Salary:* ${salaryRange}\n\n` +
      requirementsLine +
      inviteLine +
      `📝 *Apply Now:* ${applicationLink}\n\n` +
      `Posted via EduDash Pro Hiring Hub`;
  };

  const loadSchoolInfo = async () => {
    if (!preschoolId) return;
    try {
      const supabase = assertSupabase();
      const { data: preschool } = await supabase
        .from('preschools')
        .select('name, logo_url, city, province, phone, contact_email, website_url')
        .eq('id', preschoolId)
        .maybeSingle();

      if (preschool) {
        setSchoolInfo({
          name: preschool.name,
          logoUrl: preschool.logo_url,
          city: preschool.city,
          province: preschool.province,
          phone: preschool.phone,
          email: preschool.contact_email,
          website: preschool.website_url,
        });
        setIncludeSchoolLogo(!!preschool.logo_url);
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('name, logo_url')
        .eq('id', preschoolId)
        .maybeSingle();
      if (org) {
        setSchoolInfo({
          name: org.name,
          logoUrl: org.logo_url,
        });
        setIncludeSchoolLogo(!!org.logo_url);
        return;
      }
    } catch (error) {
      console.warn('Failed to load school info:', error);
    }
    const fallbackName = (profile as any)?.organization_name || (profile as any)?.organization_membership?.organization_name;
    if (fallbackName) {
      setSchoolInfo({
        name: fallbackName,
      });
      setIncludeSchoolLogo(false);
    }
  };

  const openSharePreview = (jobPosting: any, inviteCode?: string | null) => {
    const message = buildWhatsAppMessage(jobPosting, inviteCode || undefined);
    setShareJobPosting(jobPosting);
    setShareInviteCode(inviteCode || null);
    setShareMessage(message);
    setIncludeSchoolHeader(true);
    setIncludeSchoolDetails(true);
    setShareModalVisible(true);
    void loadSchoolInfo();
  };

  const handleShareToWhatsApp = async () => {
    const message = shareMessage.trim();
    if (!message) return;
    const encoded = encodeURIComponent(message);
    const url = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;
    try {
      if (Platform.OS !== 'web') {
        const canOpen = await Linking.canOpenURL(url);
        await Linking.openURL(canOpen ? url : webUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!shareInviteCode) return;
    await Clipboard.setStringAsync(shareInviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const handleCopyMessage = async () => {
    if (!shareMessage.trim()) return;
    await Clipboard.setStringAsync(shareMessage);
    Alert.alert('Copied', 'WhatsApp message copied to clipboard.');
  };

  const handleWhatsAppBroadcast = async (jobPosting: any, messageOverride?: string): Promise<boolean> => {
    try {
      const whatsappMessage = messageOverride?.trim() || buildWhatsAppMessage(jobPosting, shareInviteCode || undefined);
      if (!whatsappMessage.trim()) {
        throw new Error('Message is empty');
      }

      // Call WhatsApp broadcast service
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message_type: 'text',
          content: whatsappMessage,
          broadcast: true, // Indicates broadcast to contact list
          preschool_id: preschoolId,
          job_posting_id: jobPosting.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send WhatsApp broadcast');
      }

      // Track distribution event
      await HiringHubService.trackJobDistribution({
        job_posting_id: jobPosting.id,
        channel: 'whatsapp',
        distributed_by: user.id,
        recipients_count: 0, // Will be updated by backend with actual count
      });

      Alert.alert(
        'Success! 🎉',
        'Job posting has been shared via WhatsApp to your contact list.',
        [{ text: 'OK' }]
      );
      return true;
    } catch (error: any) {
      console.error('Error sharing on WhatsApp:', error);
      Alert.alert(
        'Sharing Failed',
        'Could not share job posting via WhatsApp. You can still share it manually.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!preschoolId || !user?.id) {
      Alert.alert('Error', 'Missing user or school information');
      return;
    }

    setSubmitting(true);
    try {
      const minSalary = salaryMin ? parseFloat(salaryMin) : undefined;
      const maxSalary = salaryMax ? parseFloat(salaryMax) : undefined;

      const newJobPosting = await HiringHubService.createJobPosting(
        {
          preschool_id: preschoolId,
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim() || undefined,
          salary_range_min: minSalary,
          salary_range_max: maxSalary,
          location: location.trim() || undefined,
          employment_type: employmentType,
          expires_at: expiresAt || undefined,
        },
        user.id
      );

      let inviteCode: string | null = null;
      try {
        const invite = await InviteCodeService.createInviteCode({
          invitationType: 'teacher',
          preschoolId,
          organizationId: preschoolId,
          organizationKind: 'preschool',
          invitedBy: user.id,
          description: `${title.trim()} teacher invite`,
        });
        inviteCode = invite.code;
      } catch (inviteErr: any) {
        console.warn('Invite code creation failed:', inviteErr);
      }

      if (inviteCode) {
        openSharePreview(newJobPosting, inviteCode as string);
      } else {
        openSharePreview(newJobPosting, null);
      }
    } catch (error: any) {
      console.error('Error creating job posting:', error);
      Alert.alert('Error', error.message || 'Failed to create job posting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Create Job Posting', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job Posting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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

      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShareModalVisible(false);
          router.back();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={styles.modalTitle}>Job Posted 🎉</Text>
            <Text style={styles.modalSubtitle}>Preview and share your WhatsApp message.</Text>

            <View style={styles.toggleGroup}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Show school header</Text>
                <Switch
                  value={includeSchoolHeader}
                  onValueChange={setIncludeSchoolHeader}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={includeSchoolHeader ? theme.onPrimary : theme.textSecondary}
                />
              </View>
              {includeSchoolHeader && (
                <>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Include logo</Text>
                    <Switch
                      value={includeSchoolLogo}
                      onValueChange={setIncludeSchoolLogo}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={includeSchoolLogo ? theme.onPrimary : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Include details</Text>
                    <Switch
                      value={includeSchoolDetails}
                      onValueChange={setIncludeSchoolDetails}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={includeSchoolDetails ? theme.onPrimary : theme.textSecondary}
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.previewCard}>
              {includeSchoolHeader && schoolInfo ? (
                <View style={styles.schoolHeader}>
                  {includeSchoolLogo ? (
                    schoolInfo.logoUrl ? (
                      <Image source={{ uri: schoolInfo.logoUrl }} style={styles.schoolLogo} />
                    ) : (
                      <View style={styles.schoolLogoPlaceholder}>
                        <Text style={styles.schoolLogoText}>
                          {schoolInfo.name?.slice(0, 2).toUpperCase() || 'ED'}
                        </Text>
                      </View>
                    )
                  ) : null}
                  <View style={styles.schoolHeaderText}>
                    <Text style={styles.schoolName}>{schoolInfo.name}</Text>
                    {includeSchoolDetails ? (
                      <Text style={styles.schoolDetails}>{formatSchoolDetails(schoolInfo) || 'School details unavailable'}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.previewBody}>
                <Text style={styles.previewTitle}>{shareJobPosting?.title || title || 'Teaching Opportunity'}</Text>
                <Text style={styles.previewMeta}>
                  {formatEmploymentType(shareJobPosting?.employment_type || employmentType)} •{' '}
                  {shareJobPosting?.location || location || 'Location TBA'} •{' '}
                  {formatSalaryRange(shareJobPosting || {})}
                </Text>
                <Text style={styles.previewSectionLabel}>Description</Text>
                <Text style={styles.previewText} numberOfLines={4}>
                  {shareJobPosting?.description || description || 'Description will appear here.'}
                </Text>
                {(shareJobPosting?.requirements || requirements) ? (
                  <>
                    <Text style={styles.previewSectionLabel}>Requirements</Text>
                    <Text style={styles.previewText} numberOfLines={3}>
                      {shareJobPosting?.requirements || requirements}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            {shareInviteCode ? (
              <View style={styles.inviteRow}>
                <Text style={styles.inviteLabel}>Invite Code</Text>
                <View style={styles.inviteCodeRow}>
                  <Text style={styles.inviteValue}>{shareInviteCode}</Text>
                  <TouchableOpacity style={styles.inlineButton} onPress={handleCopyInviteCode}>
                    <Ionicons name="copy-outline" size={16} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Text style={styles.previewLabel}>WhatsApp Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={shareMessage}
              onChangeText={setShareMessage}
              placeholder="Message preview..."
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={handleCopyMessage}>
                <Text style={styles.secondaryActionText}>Copy Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={handleShareToWhatsApp}>
                <Text style={styles.primaryActionText}>Share to WhatsApp</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.secondaryAction, styles.broadcastAction]}
              disabled={broadcasting}
              onPress={() => {
                if (!shareJobPosting) return;
                Alert.alert(
                  'Broadcast to all contacts?',
                  'This will send the message to your full WhatsApp contact list. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Broadcast',
                      style: 'destructive',
                      onPress: async () => {
                        setBroadcasting(true);
                        const success = await handleWhatsAppBroadcast(shareJobPosting, shareMessage);
                        setBroadcasting(false);
                        if (success) {
                          setShareModalVisible(false);
                          router.back();
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.broadcastText}>
                {broadcasting ? 'Broadcasting…' : 'Broadcast to All Contacts'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setShareModalVisible(false);
                router.back();
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    modalSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    inviteRow: {
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inviteLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    inviteCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    inviteValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    inlineButton: {
      padding: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    previewLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    toggleGroup: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 10,
      backgroundColor: theme.card,
      gap: 8,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLabel: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
    },
    previewCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: theme.surface,
    },
    schoolHeader: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    schoolLogo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surface,
    },
    schoolLogoPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    schoolLogoText: {
      color: theme.onPrimary,
      fontWeight: '700',
    },
    schoolHeaderText: {
      flex: 1,
    },
    schoolName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    schoolDetails: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    previewBody: {
      padding: 12,
      gap: 6,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    previewMeta: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    previewSectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 6,
    },
    previewText: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    messageInput: {
      minHeight: 160,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
    },
    secondaryAction: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: theme.surface,
    },
    secondaryActionText: {
      color: theme.text,
      fontWeight: '600',
    },
    primaryAction: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    primaryActionText: {
      color: theme.onPrimary,
      fontWeight: '700',
    },
    broadcastAction: {
      backgroundColor: 'transparent',
      borderStyle: 'dashed',
    },
    broadcastText: {
      color: theme.error,
      fontWeight: '700',
    },
    doneButton: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    doneButtonText: {
      color: theme.textSecondary,
      fontWeight: '600',
    },
  });
