import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles, themedStyles, type Theme } from '@/hooks/useThemedStyles';
import { useAppPreferencesSafe } from '@/contexts/AppPreferencesContext';

/**
 * App Preferences Section - FAB & Tutorial settings
 * Extracted from settings.tsx for WARP.md compliance
 */
export function AppPreferencesSection() {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const { 
    showDashFAB, 
    setShowDashFAB, 
    tutorialCompleted, 
    setTutorialCompleted,
    isLoaded 
  } = useAppPreferencesSafe();
  const [showTutorial, setShowTutorial] = useState(false);

  const prefStyles = useThemedStyles((theme: Theme) => ({
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600' as const,
      color: theme.text,
      marginBottom: 16,
    },
    settingsCard: {
      ...themedStyles.card(theme),
      padding: 0,
      overflow: 'hidden' as const,
    },
    settingItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    lastSettingItem: {
      borderBottomWidth: 0,
    },
    settingLeft: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      flex: 1,
    },
    settingIcon: {
      marginRight: 16,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: theme.text,
      marginBottom: 2,
    },
    settingSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
  }));

  // Show tutorial modal when triggered
  useEffect(() => {
    if (showTutorial) {
      setTutorialCompleted(false);
      setShowTutorial(false);
      Alert.alert(
        t('settings.tutorial.replaying_title', { defaultValue: 'Tutorial' }),
        t('settings.tutorial.replaying_message', { defaultValue: 'The app tutorial will show on next app restart or when you return to the home screen.' }),
        [{ text: t('common.ok') }]
      );
    }
  }, [showTutorial, setTutorialCompleted, t]);

  if (!isLoaded) {
    return null;
  }

  return (
    <View style={prefStyles.section}>
      <Text style={prefStyles.sectionTitle}>
        {t('settings.app_preferences.title', { defaultValue: 'App Preferences' })}
      </Text>
      
      <View style={prefStyles.settingsCard}>
        {/* Dash AI FAB Toggle */}
        <View style={prefStyles.settingItem}>
          <View style={prefStyles.settingLeft}>
            <Ionicons 
              name="sparkles" 
              size={24} 
              color={showDashFAB ? '#8B5CF6' : theme.textSecondary} 
              style={prefStyles.settingIcon} 
            />
            <View style={prefStyles.settingContent}>
              <Text style={prefStyles.settingTitle}>
                {t('settings.app_preferences.dash_fab_title', { defaultValue: 'Show Dash AI Button' })}
              </Text>
              <Text style={prefStyles.settingSubtitle}>
                {t('settings.app_preferences.dash_fab_subtitle', { defaultValue: 'Floating button to chat with Dash AI' })}
              </Text>
            </View>
          </View>
          <Switch
            value={showDashFAB}
            onValueChange={setShowDashFAB}
            trackColor={{ false: theme.border, true: '#8B5CF6' }}
            thumbColor={showDashFAB ? '#FFFFFF' : theme.textTertiary}
          />
        </View>

        {/* Replay Tutorial */}
        <TouchableOpacity
          style={[prefStyles.settingItem, prefStyles.lastSettingItem]}
          onPress={() => setShowTutorial(true)}
        >
          <View style={prefStyles.settingLeft}>
            <Ionicons 
              name="school" 
              size={24} 
              color={theme.textSecondary} 
              style={prefStyles.settingIcon} 
            />
            <View style={prefStyles.settingContent}>
              <Text style={prefStyles.settingTitle}>
                {t('settings.app_preferences.replay_tutorial_title', { defaultValue: 'Replay App Tutorial' })}
              </Text>
              <Text style={prefStyles.settingSubtitle}>
                {tutorialCompleted 
                  ? t('settings.app_preferences.replay_tutorial_completed', { defaultValue: 'View the app introduction again' })
                  : t('settings.app_preferences.replay_tutorial_not_completed', { defaultValue: 'Tutorial not yet completed' })
                }
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
