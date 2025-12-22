import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from "expo-image-picker";
import { Stack } from 'expo-router';
import {
  getEnabled as getBiometricsEnabled,
  setEnabled as setBiometricsEnabled,
  isHardwareAvailable,
  isEnrolled,
} from "@/lib/biometrics";
import { BiometricAuthService } from "@/services/BiometricAuthService";
import { assertSupabase } from "@/lib/supabase";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useThemedStyles, themedStyles } from "@/hooks/useThemedStyles";
import ProfileImageService from '@/services/ProfileImageService';

// Extracted components
import {
  ProfileHeader,
  ProfileInfoCards,
  SettingsModal,
  EditProfileModal,
  ThemeSettingsModal,
  AccountActions,
} from '@/components/account';

export default function AccountScreen() {
  const { theme, mode } = useTheme();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);

  const styles = useThemedStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    settingsButton: { padding: 8 },
    profileHeader: {
      alignItems: "center" as const,
      paddingVertical: 32,
      paddingHorizontal: 20,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    avatarContainer: { position: "relative" as const, marginBottom: 16 },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: theme.primary,
      justifyContent: "center" as const, alignItems: "center" as const,
    },
    avatarText: { fontSize: 36, fontWeight: "600" as const, color: theme.onPrimary },
    cameraIconContainer: {
      position: "absolute" as const, bottom: 0, right: 0,
      backgroundColor: theme.secondary, borderRadius: 20,
      width: 32, height: 32,
      justifyContent: "center" as const, alignItems: "center" as const,
      borderWidth: 3, borderColor: theme.surface,
    },
    loadingIcon: { width: 32, height: 32, justifyContent: "center" as const, alignItems: "center" as const },
    loadingText: { fontSize: 16, color: theme.onSecondary },
    displayName: { fontSize: 24, fontWeight: "600" as const, color: theme.text, marginBottom: 4 },
    email: { fontSize: 16, color: theme.textSecondary, marginBottom: 12 },
    roleBadge: { backgroundColor: theme.primaryLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    roleText: { fontSize: 12, fontWeight: "600" as const, color: theme.onPrimary },
    infoSection: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: "600" as const, color: theme.text, marginBottom: 16 },
    infoCard: themedStyles.card(theme),
    infoRow: { flexDirection: "row" as const, alignItems: "center" as const },
    infoContent: { flex: 1, marginLeft: 16 },
    infoLabel: { fontSize: 14, color: theme.textTertiary, marginBottom: 2 },
    infoValue: { fontSize: 16, color: theme.text },
    editButton: { padding: 8 },
    signOutButton: {
      flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
      marginHorizontal: 20, marginTop: 20, paddingVertical: 16,
      backgroundColor: theme.error, borderRadius: 12,
      shadowColor: theme.error, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    signOutText: { fontSize: 17, fontWeight: "700" as const, color: theme.onError, marginLeft: 8, letterSpacing: 0.5 },
    modalOverlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "flex-end" as const },
    modalContent: {
      backgroundColor: theme.modalBackground, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingTop: 20, paddingBottom: 40, maxHeight: "80%" as const,
    },
    modalHeader: {
      flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const,
      paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.divider,
    },
    modalTitle: { fontSize: 20, fontWeight: "600" as const, color: theme.text },
    settingItem: {
      flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const,
      paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.divider,
    },
    settingLeft: { flexDirection: "row" as const, alignItems: "center" as const, flex: 1 },
    settingText: { marginLeft: 16, flex: 1 },
    settingTitle: { fontSize: 16, fontWeight: "500" as const, color: theme.text, marginBottom: 2 },
    settingSubtitle: { fontSize: 14, color: theme.textSecondary },
    switchContainer: { marginLeft: 12 },
    editModalContainer: { flex: 1, backgroundColor: theme.background },
    editModalHeader: {
      flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const,
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
      borderBottomColor: theme.divider, backgroundColor: theme.surface,
    },
    editModalCancel: { fontSize: 16, color: theme.error },
    editModalTitle: { fontSize: 18, fontWeight: "600" as const, color: theme.text },
    editModalSave: { fontSize: 16, color: theme.primary, fontWeight: "600" as const },
    editModalContent: { flex: 1 },
    editSection: { padding: 20 },
    editSectionTitle: { fontSize: 16, fontWeight: "600" as const, color: theme.text, marginBottom: 20 },
    editFieldContainer: { marginBottom: 20 },
    editFieldLabel: { fontSize: 14, color: theme.textSecondary, marginBottom: 8 },
    editFieldInput: { ...themedStyles.input(theme) },
    themeSettingsModal: { flex: 1, backgroundColor: theme.background },
    themeSettingsHeader: {
      flexDirection: "row" as const, alignItems: "center" as const,
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
      borderBottomColor: theme.divider, backgroundColor: theme.surface,
    },
    themeSettingsTitle: { fontSize: 18, fontWeight: "600" as const, color: theme.text, marginLeft: 16 },
  }));

  // Load user data
  const load = useCallback(async () => {
    const { data } = await assertSupabase().auth.getUser();
    const u = data.user;
    setEmail(u?.email ?? null);

    let r = (u?.user_metadata as Record<string, unknown>)?.role as string ?? null;
    let s = (u?.user_metadata as Record<string, unknown>)?.preschool_id as string ?? null;
    let fn = (u?.user_metadata as Record<string, unknown>)?.first_name as string ?? null;
    let ln = (u?.user_metadata as Record<string, unknown>)?.last_name as string ?? null;
    let img = (u?.user_metadata as Record<string, unknown>)?.avatar_url as string ?? null;

    if (u?.id) {
      try {
        const { data: p } = await assertSupabase()
          .from("profiles")
          .select("role,preschool_id,first_name,last_name,avatar_url")
          .eq("id", u.id)
          .maybeSingle();
        r = r || (p as Record<string, unknown>)?.role as string || null;
        s = s || (p as Record<string, unknown>)?.preschool_id as string || null;
        fn = fn || (p as Record<string, unknown>)?.first_name as string || null;
        ln = ln || (p as Record<string, unknown>)?.last_name as string || null;
        img = img || (p as Record<string, unknown>)?.avatar_url as string || null;
      } catch { /* noop */ }
    }

    setRole(r);
    setSchool(s);
    setFirstName(fn);
    setLastName(ln);
    setProfileImage(img);
    setEditFirstName(fn || "");
    setEditLastName(ln || "");
  }, []);

  useEffect(() => { load(); }, [load]);

  // Convert profile image URI for web compatibility
  useEffect(() => {
    const convertImageUri = async () => {
      if (profileImage) {
        try {
          if (Platform.OS === 'web' && (profileImage.startsWith('blob:') || profileImage.startsWith('file:'))) {
            const dataUri = await ProfileImageService.convertToDataUri(profileImage);
            setDisplayUri(dataUri);
          } else {
            setDisplayUri(profileImage);
          }
        } catch {
          setDisplayUri(profileImage);
        }
      } else {
        setDisplayUri(null);
      }
    };
    convertImageUri();
  }, [profileImage]);

  // Load biometric settings
  useEffect(() => {
    (async () => {
      try {
        const securityInfo = await BiometricAuthService.getSecurityInfo();
        setBiometricSupported(securityInfo.capabilities.isAvailable);
        setBiometricEnrolled(securityInfo.capabilities.isEnrolled);
        setBiometricEnabled(securityInfo.isEnabled);
      } catch {
        try {
          const [supported, enrolled, enabled] = await Promise.all([
            isHardwareAvailable(), isEnrolled(), getBiometricsEnabled(),
          ]);
          setBiometricSupported(supported);
          setBiometricEnrolled(enrolled);
          setBiometricEnabled(enabled);
        } catch { /* noop */ }
      }
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Image handling
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "We need camera roll permissions to select a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch { Alert.alert("Error", "Failed to select image"); }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "We need camera permissions to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch { Alert.alert("Error", "Failed to take photo"); }
  };

  const uploadProfileImage = async (uri: string) => {
    try {
      setUploadingImage(true);
      const { data } = await assertSupabase().auth.getUser();
      if (!data.user?.id) { Alert.alert('Error', 'User not found'); return; }

      const validation = await ProfileImageService.validateImage(uri);
      if (!validation.valid) {
        Alert.alert('Invalid Image', validation.error || 'Please select a valid image');
        return;
      }

      const result = await ProfileImageService.uploadProfileImage(data.user.id, uri, {
        quality: 0.8, maxWidth: 800, maxHeight: 800, format: 'jpeg'
      });

      if (result.success && result.publicUrl) {
        setProfileImage(result.publicUrl);
        Alert.alert("Success", "Profile picture updated!");
      } else {
        const errorMessage = result.error?.includes('Bucket not found') 
          ? "Avatar storage is not set up. Please contact support."
          : result.error || "Failed to update profile picture.";
        Alert.alert("Upload Failed", errorMessage);
      }
    } catch {
      Alert.alert("Error", "Failed to update profile picture.");
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert("Update Profile Picture", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // Biometric toggle
  const toggleBiometric = async () => {
    if (!biometricEnrolled) {
      Alert.alert("Biometric Setup Required", "Please set up fingerprint or face recognition in device settings.");
      return;
    }
    try {
      const { data } = await assertSupabase().auth.getUser();
      if (!data.user) { Alert.alert("Error", "User not found"); return; }

      if (biometricEnabled) {
        await BiometricAuthService.disableBiometric();
        await setBiometricsEnabled(false);
        setBiometricEnabled(false);
        Alert.alert("Biometric Login Disabled", "You will need to use your password to sign in.");
      } else {
        const success = await BiometricAuthService.enableBiometric(data.user.id, data.user.email || "");
        if (success) {
          await setBiometricsEnabled(true);
          setBiometricEnabled(true);
          Alert.alert("Biometric Login Enabled", "You can now use biometric authentication.");
        }
      }
    } catch {
      Alert.alert("Error", "Failed to update biometric settings.");
    }
    setShowSettingsMenu(false);
  };

  // Profile save
  const saveProfileChanges = async () => {
    try {
      setSavingProfile(true);
      const { data } = await assertSupabase().auth.getUser();
      if (!data.user?.id) { Alert.alert("Error", "User not found"); return; }

      const { error } = await assertSupabase()
        .from("profiles")
        .update({ first_name: editFirstName.trim() || null, last_name: editLastName.trim() || null })
        .eq("id", data.user.id);

      if (error) Alert.alert("Warning", "Profile updated locally but failed to sync.");

      setFirstName(editFirstName.trim() || null);
      setLastName(editLastName.trim() || null);
      setShowEditProfile(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch {
      Alert.alert("Error", "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelProfileEdit = () => {
    setEditFirstName(firstName || "");
    setEditLastName(lastName || "");
    setShowEditProfile(false);
  };

  const getDisplayName = () => {
    if (firstName && lastName) return `${firstName} ${lastName}`;
    return firstName || lastName || email?.split("@")[0] || "User";
  };

  const getInitials = () => {
    if (firstName && lastName) return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    if (firstName) return firstName.charAt(0).toUpperCase();
    return email?.charAt(0).toUpperCase() || "U";
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: t('navigation.account', { defaultValue: 'Account' }),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text, fontWeight: '600' },
        }} 
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <ProfileHeader
          profileImage={profileImage}
          displayUri={displayUri}
          displayName={getDisplayName()}
          email={email}
          role={role}
          initials={getInitials()}
          uploadingImage={uploadingImage}
          onImagePress={showImageOptions}
          theme={theme}
          styles={styles}
        />

        <ProfileInfoCards
          firstName={firstName}
          lastName={lastName}
          email={email}
          role={role}
          school={school}
          onEditPress={() => setShowEditProfile(true)}
          theme={theme}
          styles={styles}
        />

        <AccountActions theme={theme} styles={styles} />
      </ScrollView>

      <SettingsModal
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        biometricSupported={biometricSupported}
        biometricEnrolled={biometricEnrolled}
        biometricEnabled={biometricEnabled}
        themeMode={mode}
        onToggleBiometric={toggleBiometric}
        onOpenThemeSettings={() => { setShowSettingsMenu(false); setShowThemeSettings(true); }}
        theme={theme}
        styles={styles}
      />

      <EditProfileModal
        visible={showEditProfile}
        onClose={cancelProfileEdit}
        onSave={saveProfileChanges}
        saving={savingProfile}
        firstName={editFirstName}
        lastName={editLastName}
        onFirstNameChange={setEditFirstName}
        onLastNameChange={setEditLastName}
        theme={theme}
        styles={styles}
      />

      <ThemeSettingsModal
        visible={showThemeSettings}
        onClose={() => setShowThemeSettings(false)}
        theme={theme}
        styles={styles}
      />
    </SafeAreaView>
  );
}
