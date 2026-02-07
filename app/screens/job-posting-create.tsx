import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Linking, Platform, Switch, Image } from 'react-native';
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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { base64ToUint8Array } from '@/lib/utils/base64';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function JobPostingCreateScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, AlertModalComponent } = useAlertModal();

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
  const [jobLogoUrl, setJobLogoUrl] = useState<string | null>(null);
  const [jobLogoUploading, setJobLogoUploading] = useState(false);
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
      showAlert({ title: 'Validation Error', message: 'Job title is required', type: 'warning' });
      return false;
    }
    if (!description.trim()) {
      showAlert({ title: 'Validation Error', message: 'Job description is required', type: 'warning' });
      return false;
    }
    if (!employmentType) {
      showAlert({ title: 'Validation Error', message: 'Employment type is required', type: 'warning' });
      return false;
    }

    const minSalary = salaryMin ? parseFloat(salaryMin) : null;
    const maxSalary = salaryMax ? parseFloat(salaryMax) : null;

    if (minSalary && isNaN(minSalary)) {
      showAlert({ title: 'Validation Error', message: 'Minimum salary must be a valid number', type: 'warning' });
      return false;
    }
    if (maxSalary && isNaN(maxSalary)) {
      showAlert({ title: 'Validation Error', message: 'Maximum salary must be a valid number', type: 'warning' });
      return false;
    }
    if (minSalary && maxSalary && minSalary > maxSalary) {
      showAlert({ title: 'Validation Error', message: 'Minimum salary cannot be greater than maximum salary', type: 'warning' });
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
      ? `${appUrl}/sign-up/teacher?invite=${encodeURIComponent(inviteCode)}&job=${encodeURIComponent(jobPosting.id)}`
      : `${appUrl}/sign-up/teacher?job=${encodeURIComponent(jobPosting.id)}`;
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
        setIncludeSchoolLogo(Boolean(jobLogoUrl || preschool.logo_url));
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
        setIncludeSchoolLogo(Boolean(jobLogoUrl || org.logo_url));
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
      setIncludeSchoolLogo(Boolean(jobLogoUrl));
    }
  };

  const handlePickJobLogo = async () => {
    try {
      if (!preschoolId) {
        showAlert({ title: 'Error', message: 'Missing school information', type: 'error' });
        return;
      }

      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        showAlert({ title: 'Permission Required', message: 'Please grant photo library access to upload a logo', type: 'warning' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setJobLogoUploading(true);

      const processed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: SaveFormat.PNG }
      );

      const base64Data = await FileSystem.readAsStringAsync(processed.uri, { encoding: 'base64' });
      const body = base64ToUint8Array(base64Data);

      if (body.byteLength === 0) {
        throw new Error('Failed to prepare logo for upload');
      }

      const bucket = 'school-assets';
      const timestamp = Date.now();
      const path = `${preschoolId}/job-postings/logo_${timestamp}.png`;

      const { error: uploadError } = await assertSupabase().storage
        .from(bucket)
        .upload(path, body as any, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicData } = assertSupabase().storage.from(bucket).getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) {
        throw new Error('Failed to generate logo URL');
      }

      setJobLogoUrl(publicUrl);
      setIncludeSchoolLogo(true);

      // Sync logo to branding so invoices/receipts pick it up
      try {
        await assertSupabase()
          .from('school_branding')
          .upsert(
            {
              preschool_id: preschoolId,
              logo_url: publicUrl,
            },
            { onConflict: 'preschool_id' }
          )
          .select('id')
          .single();
      } catch (brandingErr) {
        console.warn('Failed to sync school branding logo:', brandingErr);
      }

      // Keep organization/preschool logos aligned if possible
      try {
        await assertSupabase()
          .from('organizations')
          .update({ logo_url: publicUrl })
          .eq('id', preschoolId);
      } catch (orgErr) {
        console.warn('Failed to update organization logo:', orgErr);
      }

      try {
        await assertSupabase()
          .from('preschools')
          .update({ logo_url: publicUrl })
          .eq('id', preschoolId);
      } catch (schoolErr) {
        console.warn('Failed to update preschool logo:', schoolErr);
      }
    } catch (error: any) {
      showAlert({ title: 'Logo Upload Failed', message: error.message || 'Failed to upload logo', type: 'error' });
    } finally {
      setJobLogoUploading(false);
    }
  };

  const handleClearJobLogo = () => {
    setJobLogoUrl(null);
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
    showAlert({ title: 'Copied', message: 'Invite code copied to clipboard.', type: 'success' });
  };

  const handleCopyMessage = async () => {
    if (!shareMessage.trim()) return;
    await Clipboard.setStringAsync(shareMessage);
    showAlert({ title: 'Copied', message: 'WhatsApp message copied to clipboard.', type: 'success' });
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

      showAlert({
        title: 'Success! 🎉',
        message: 'Job posting has been shared via WhatsApp to your contact list.',
        type: 'success',
        buttons: [{ text: 'OK' }],
      });
      return true;
    } catch (error: any) {
      console.error('Error sharing on WhatsApp:', error);
      showAlert({
        title: 'Sharing Failed',
        message: 'Could not share job posting via WhatsApp. You can still share it manually.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!preschoolId || !user?.id) {
      showAlert({ title: 'Error', message: 'Missing user or school information', type: 'error' });
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
          logo_url: jobLogoUrl || null,
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
      showAlert({ title: 'Error', message: error.message || 'Failed to create job posting', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

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
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShareModalVisible(false);
          router.back();
        }}
      >
        <SafeAreaView style={styles.shareScreenContainer} edges={['top', 'bottom']}>
          {/* Share Screen Header */}
          <View style={styles.shareHeader}>
            <TouchableOpacity
              style={styles.shareHeaderClose}
              onPress={() => {
                setShareModalVisible(false);
                router.back();
              }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.shareHeaderCenter}>
              <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              <Text style={styles.shareHeaderTitle}>Job Posted!</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.shareScrollView}
            contentContainerStyle={styles.shareScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Job Preview Card */}
            <View style={styles.previewCard}>
              {includeSchoolHeader && (schoolInfo || jobLogoUrl) ? (
                <View style={styles.schoolHeader}>
                  {includeSchoolLogo ? (
                    (jobLogoUrl || schoolInfo?.logoUrl) ? (
                      <Image source={{ uri: jobLogoUrl || schoolInfo?.logoUrl || undefined }} style={styles.schoolLogo} />
                    ) : (
                      <View style={styles.schoolLogoPlaceholder}>
                        <Text style={styles.schoolLogoText}>
                          {schoolInfo?.name?.slice(0, 2).toUpperCase() || 'ED'}
                        </Text>
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
                
                {/* Job Meta Tags */}
                <View style={styles.previewMetaRow}>
                  <View style={styles.previewMetaTag}>
                    <Ionicons name="briefcase-outline" size={13} color={theme.primary} />
                    <Text style={styles.previewMetaTagText}>
                      {formatEmploymentType(shareJobPosting?.employment_type || employmentType)}
                    </Text>
                  </View>
                  <View style={styles.previewMetaTag}>
                    <Ionicons name="location-outline" size={13} color={theme.primary} />
                    <Text style={styles.previewMetaTagText}>
                      {shareJobPosting?.location || location || 'Location TBA'}
                    </Text>
                  </View>
                  <View style={styles.previewMetaTag}>
                    <Ionicons name="cash-outline" size={13} color="#22c55e" />
                    <Text style={[styles.previewMetaTagText, { color: '#22c55e' }]}>
                      {formatSalaryRange(shareJobPosting || {})}
                    </Text>
                  </View>
                </View>

                <View style={styles.previewDivider} />

                <Text style={styles.previewSectionLabel}>Description</Text>
                <Text style={styles.previewText} numberOfLines={6}>
                  {shareJobPosting?.description || description || 'Description will appear here.'}
                </Text>

                {(shareJobPosting?.requirements || requirements) ? (
                  <>
                    <Text style={styles.previewSectionLabel}>Requirements</Text>
                    <Text style={styles.previewText} numberOfLines={5}>
                      {shareJobPosting?.requirements || requirements}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            {/* Invite Code Section */}
            {shareInviteCode ? (
              <View style={styles.inviteCodeCard}>
                <View style={styles.inviteCodeHeader}>
                  <View style={styles.inviteCodeIconBg}>
                    <Ionicons name="key" size={16} color="#6366f1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteCodeLabel}>Teacher Invite Code</Text>
                    <Text style={styles.inviteCodeValue}>{shareInviteCode}</Text>
                  </View>
                  <TouchableOpacity style={styles.inviteCodeCopyBtn} onPress={handleCopyInviteCode}>
                    <Ionicons name="copy-outline" size={18} color={theme.primary} />
                    <Text style={styles.inviteCodeCopyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Branding Toggles */}
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleGroupTitle}>Customise Preview</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelRow}>
                  <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
                  <Text style={styles.toggleLabel}>School header</Text>
                </View>
                <Switch
                  value={includeSchoolHeader}
                  onValueChange={setIncludeSchoolHeader}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={includeSchoolHeader ? '#fff' : theme.textSecondary}
                />
              </View>
              {includeSchoolHeader && (
                <>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLabelRow}>
                      <Ionicons name="image-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.toggleLabel}>Logo</Text>
                    </View>
                    <Switch
                      value={includeSchoolLogo}
                      onValueChange={setIncludeSchoolLogo}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={includeSchoolLogo ? '#fff' : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLabelRow}>
                      <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.toggleLabel}>Contact details</Text>
                    </View>
                    <Switch
                      value={includeSchoolDetails}
                      onValueChange={setIncludeSchoolDetails}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={includeSchoolDetails ? '#fff' : theme.textSecondary}
                    />
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

                <TouchableOpacity
                  style={styles.broadcastBtn}
                  disabled={broadcasting}
                  onPress={() => {
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
                            if (success) {
                              setShareModalVisible(false);
                              router.back();
                            }
                          },
                        },
                      ],
                    });
                  }}
                >
                  <Ionicons name="megaphone-outline" size={18} color="#f59e0b" />
                  <Text style={styles.broadcastBtnText}>
                    {broadcasting ? 'Sending…' : 'Broadcast'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Done / Footer */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setShareModalVisible(false);
                router.back();
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>

            <Text style={styles.shareFooterText}>Posted via EduDash Pro Hiring Hub</Text>
          </ScrollView>
        </SafeAreaView>
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
