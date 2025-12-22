import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useOrgSettings';

export default function OrgAISettingsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const { data: orgSettings, isLoading } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();

  const [automationEnabled, setAutomationEnabled] = useState(orgSettings?.ai_preferences?.automation_enabled || false);
  const [autoGenerateContent, setAutoGenerateContent] = useState(orgSettings?.ai_preferences?.auto_generate_content || false);
  const [preferredModel, setPreferredModel] = useState(orgSettings?.ai_preferences?.preferred_model || 'gpt-4');
  const [enabledServices, setEnabledServices] = useState<string[]>(orgSettings?.ai_preferences?.enabled_services || ['openai', 'anthropic']);

  React.useEffect(() => {
    if (orgSettings?.ai_preferences) {
      setAutomationEnabled(orgSettings.ai_preferences.automation_enabled || false);
      setAutoGenerateContent(orgSettings.ai_preferences.auto_generate_content || false);
      setPreferredModel(orgSettings.ai_preferences.preferred_model || 'gpt-4');
      setEnabledServices(orgSettings.ai_preferences.enabled_services || ['openai', 'anthropic']);
    }
  }, [orgSettings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        ai_preferences: {
          automation_enabled: automationEnabled,
          auto_generate_content: autoGenerateContent,
          preferred_model: preferredModel,
          enabled_services: enabledServices,
        },
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('ai_settings.saved', { defaultValue: 'AI settings saved successfully' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        error.message || t('common.save_failed', { defaultValue: 'Failed to save settings' })
      );
    }
  };

  const toggleService = (service: string) => {
    setEnabledServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('ai_settings.title', { defaultValue: 'AI Settings' }) }} />
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
          title: t('ai_settings.title', { defaultValue: 'AI & Automation' }),
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
        {/* Automation Settings */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ai_settings.automation', { defaultValue: 'Automation' })}</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {t('ai_settings.enable_automation', { defaultValue: 'Enable AI Automation' })}
              </Text>
              <Text style={styles.settingDescription}>
                {t('ai_settings.automation_desc', { defaultValue: 'Allow Dash AI to automate routine tasks and workflows' })}
              </Text>
            </View>
            <Switch
              value={automationEnabled}
              onValueChange={setAutomationEnabled}
              trackColor={{ false: theme.border, true: theme.primary + '80' }}
              thumbColor={automationEnabled ? theme.primary : theme.textSecondary}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {t('ai_settings.auto_generate', { defaultValue: 'Auto-Generate Content' })}
              </Text>
              <Text style={styles.settingDescription}>
                {t('ai_settings.auto_generate_desc', { defaultValue: 'Automatically generate announcements, reports, and other content' })}
              </Text>
            </View>
            <Switch
              value={autoGenerateContent}
              onValueChange={setAutoGenerateContent}
              trackColor={{ false: theme.border, true: theme.primary + '80' }}
              thumbColor={autoGenerateContent ? theme.primary : theme.textSecondary}
            />
          </View>
        </Card>

        {/* AI Services */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ai_settings.services', { defaultValue: 'AI Services' })}</Text>
          <Text style={styles.sectionDescription}>
            {t('ai_settings.services_desc', { defaultValue: 'Select which AI services to use for different tasks' })}
          </Text>
          
          {['openai', 'anthropic', 'google'].map((service) => (
            <TouchableOpacity
              key={service}
              style={styles.serviceItem}
              onPress={() => toggleService(service)}
            >
              <View style={styles.serviceInfo}>
                <Ionicons 
                  name={enabledServices.includes(service) ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={24} 
                  color={enabledServices.includes(service) ? theme.primary : theme.textSecondary} 
                />
                <Text style={styles.serviceLabel}>
                  {service === 'openai' ? 'OpenAI (GPT-4)' : service === 'anthropic' ? 'Anthropic (Claude)' : 'Google (Gemini)'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Preferred Model */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ai_settings.preferred_model', { defaultValue: 'Preferred Model' })}</Text>
          <Text style={styles.sectionDescription}>
            {t('ai_settings.model_desc', { defaultValue: 'Default AI model for content generation' })}
          </Text>
          
          {['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro'].map((model) => (
            <TouchableOpacity
              key={model}
              style={[styles.modelItem, preferredModel === model && { backgroundColor: theme.primary + '20' }]}
              onPress={() => setPreferredModel(model)}
            >
              <View style={styles.modelInfo}>
                <Text style={styles.modelLabel}>{model}</Text>
                {preferredModel === model && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </View>
            </TouchableOpacity>
          ))}
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
  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sectionDescription: { color: theme.textSecondary, fontSize: 14, marginBottom: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingDescription: { color: theme.textSecondary, fontSize: 13 },
  serviceItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  serviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceLabel: { color: theme.text, fontSize: 16 },
  modelItem: { padding: 12, borderRadius: 8, marginBottom: 8 },
  modelInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelLabel: { color: theme.text, fontSize: 16, fontWeight: '500' },
});






