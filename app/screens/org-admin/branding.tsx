import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useOrgSettings';
import * as ImagePicker from 'expo-image-picker';

export default function OrgBrandingScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const { data: orgSettings, isLoading } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();

  const [logoUrl, setLogoUrl] = useState(orgSettings?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(orgSettings?.brand_colors?.primary || '#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState(orgSettings?.brand_colors?.secondary || '#8B5CF6');
  const [accentColor, setAccentColor] = useState(orgSettings?.brand_colors?.accent || '#10B981');
  const [website, setWebsite] = useState(orgSettings?.social_media?.website || '');
  const [facebook, setFacebook] = useState(orgSettings?.social_media?.facebook || '');
  const [twitter, setTwitter] = useState(orgSettings?.social_media?.twitter || '');
  const [linkedin, setLinkedin] = useState(orgSettings?.social_media?.linkedin || '');
  const [instagram, setInstagram] = useState(orgSettings?.social_media?.instagram || '');

  React.useEffect(() => {
    if (orgSettings) {
      setLogoUrl(orgSettings.logo_url || '');
      setPrimaryColor(orgSettings.brand_colors?.primary || '#3B82F6');
      setSecondaryColor(orgSettings.brand_colors?.secondary || '#8B5CF6');
      setAccentColor(orgSettings.brand_colors?.accent || '#10B981');
      setWebsite(orgSettings.social_media?.website || '');
      setFacebook(orgSettings.social_media?.facebook || '');
      setTwitter(orgSettings.social_media?.twitter || '');
      setLinkedin(orgSettings.social_media?.linkedin || '');
      setInstagram(orgSettings.social_media?.instagram || '');
    }
  }, [orgSettings]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.permission_required', { defaultValue: 'Permission Required' }),
        t('common.photo_permission', { defaultValue: 'Please grant photo library access to upload a logo' })
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // TODO: Upload to Supabase Storage and get URL
      // For now, just set the local URI
      setLogoUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        logo_url: logoUrl || null,
        brand_colors: {
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor,
        },
        social_media: {
          website: website || undefined,
          facebook: facebook || undefined,
          twitter: twitter || undefined,
          linkedin: linkedin || undefined,
          instagram: instagram || undefined,
        },
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('branding.saved', { defaultValue: 'Branding settings saved successfully' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        error.message || t('common.save_failed', { defaultValue: 'Failed to save settings' })
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('branding.title', { defaultValue: 'Branding' }) }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('branding.title', { defaultValue: 'Branding & Appearance' }),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} style={{ marginRight: 16 }}>
              {updateSettings.isPending ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              )}
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Logo Section */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>{t('branding.logo', { defaultValue: 'Logo' })}</Text>
          <View style={styles.logoSection}>
            {logoUrl ? (
              <View style={styles.logoPreview}>
                {/* TODO: Use actual Image component with proper source */}
                <Text style={styles.logoPlaceholder}>Logo Preview</Text>
              </View>
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: theme.surface }]}>
                <Ionicons name="image-outline" size={48} color={theme.textSecondary} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: theme.primary }]}
              onPress={handlePickImage}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {logoUrl ? t('branding.change_logo', { defaultValue: 'Change Logo' }) : t('branding.upload_logo', { defaultValue: 'Upload Logo' })}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Brand Colors */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>{t('branding.brand_colors', { defaultValue: 'Brand Colors' })}</Text>
          
          <View style={styles.colorInputGroup}>
            <Text style={styles.label}>{t('branding.primary_color', { defaultValue: 'Primary Color' })}</Text>
            <View style={styles.colorInputRow}>
              <View style={[styles.colorPreview, { backgroundColor: primaryColor }]} />
              <TextInput
                style={[styles.colorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                value={primaryColor}
                onChangeText={setPrimaryColor}
                placeholder="#3B82F6"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>

          <View style={styles.colorInputGroup}>
            <Text style={styles.label}>{t('branding.secondary_color', { defaultValue: 'Secondary Color' })}</Text>
            <View style={styles.colorInputRow}>
              <View style={[styles.colorPreview, { backgroundColor: secondaryColor }]} />
              <TextInput
                style={[styles.colorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                value={secondaryColor}
                onChangeText={setSecondaryColor}
                placeholder="#8B5CF6"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>

          <View style={styles.colorInputGroup}>
            <Text style={styles.label}>{t('branding.accent_color', { defaultValue: 'Accent Color' })}</Text>
            <View style={styles.colorInputRow}>
              <View style={[styles.colorPreview, { backgroundColor: accentColor }]} />
              <TextInput
                style={[styles.colorInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                value={accentColor}
                onChangeText={setAccentColor}
                placeholder="#10B981"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        </Card>

        {/* Social Media */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>{t('branding.social_media', { defaultValue: 'Social Media' })}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('branding.website', { defaultValue: 'Website' })}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://example.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Facebook</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={facebook}
              onChangeText={setFacebook}
              placeholder="https://facebook.com/yourpage"
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Twitter</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={twitter}
              onChangeText={setTwitter}
              placeholder="https://twitter.com/yourhandle"
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>LinkedIn</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={linkedin}
              onChangeText={setLinkedin}
              placeholder="https://linkedin.com/company/yourcompany"
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Instagram</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={instagram}
              onChangeText={setInstagram}
              placeholder="https://instagram.com/yourhandle"
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 16, paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 16 },
  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  logoSection: { alignItems: 'center', gap: 16 },
  logoPreview: { width: 120, height: 120, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  logoPlaceholder: { width: 120, height: 120, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  colorInputGroup: { marginBottom: 16 },
  colorInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorPreview: { width: 40, height: 40, borderRadius: 8, borderWidth: 2, borderColor: theme.border },
  colorInput: { flex: 1, height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, fontSize: 16 },
  inputGroup: { marginBottom: 16 },
  label: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, fontSize: 16 },
});


