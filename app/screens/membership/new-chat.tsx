/**
 * SOA New Chat Screen
 * Create new message threads - regional, wing, or direct
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useSOACreateThread } from '@/hooks/useSOAMessaging';
import { 
  WING_CONFIG, 
  THREAD_TYPE_CONFIG,
  SOAWing,
  SOAThreadType,
} from '@/components/soa-messaging/types';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// Chat type options
const CHAT_TYPE_OPTIONS: {
  type: SOAThreadType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  requiresRole?: string[];
}[] = [
  {
    type: 'regional_chat',
    title: 'Regional Chat',
    description: 'Connect with members in your region',
    icon: 'location',
    color: '#3B82F6',
  },
  {
    type: 'wing_chat',
    title: 'Wing Chat',
    description: 'Chat with your wing members',
    icon: 'people',
    color: '#10B981',
  },
  {
    type: 'direct',
    title: 'Direct Message',
    description: 'Start a private conversation',
    icon: 'chatbubble',
    color: '#8B5CF6',
  },
  {
    type: 'broadcast',
    title: 'Announcement',
    description: 'Send official announcements',
    icon: 'megaphone',
    color: '#F59E0B',
    requiresRole: ['admin', 'regional_manager', 'wing_leader'],
  },
];

// Wing options for wing chat
const WING_OPTIONS: { wing: SOAWing; label: string; color: string; icon: string }[] = [
  { wing: 'youth', ...WING_CONFIG.youth },
  { wing: 'women', ...WING_CONFIG.women },
  { wing: 'men', ...WING_CONFIG.men },
  { wing: 'seniors', ...WING_CONFIG.seniors },
];

export default function NewChatScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();

  const [selectedType, setSelectedType] = useState<SOAThreadType | null>(null);
  const [selectedWing, setSelectedWing] = useState<SOAWing | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const { createThread, creating, error } = useSOACreateThread();

  // Get organization and region from profile
  const organizationId = (profile as any)?.organization_id || '';
  const regionId = (profile as any)?.region_id || null;
  const memberType = (profile as any)?.member_type || '';

  // Check if user can create broadcast
  const canCreateBroadcast = ['admin', 'regional_manager', 'wing_leader', 'principal'].some(
    role => memberType.toLowerCase().includes(role.toLowerCase())
  );

  const handleSelectType = (type: SOAThreadType) => {
    if (type === 'broadcast' && !canCreateBroadcast) {
      showAlert({
        title: 'Permission Required',
        message: 'Only leadership members can create announcements.',
        buttons: [{ text: 'OK' }],
      });
      return;
    }
    setSelectedType(type);
    setSelectedWing(null);
  };

  const handleSelectWing = (wing: SOAWing) => {
    setSelectedWing(wing);
  };

  const handleCreateThread = async () => {
    if (!selectedType || !organizationId) {
      showAlert({ title: 'Error', message: 'Please select a chat type' });
      return;
    }

    if (selectedType === 'wing_chat' && !selectedWing) {
      showAlert({ title: 'Error', message: 'Please select a wing' });
      return;
    }

    try {
      const thread = await createThread({
        organization_id: organizationId,
        region_id: selectedType === 'regional_chat' ? regionId : undefined,
        wing: selectedType === 'wing_chat' ? selectedWing! : undefined,
        thread_type: selectedType,
        subject: subject.trim() || undefined,
        description: description.trim() || undefined,
      });

      // Navigate to the new thread
      router.replace({
        pathname: '/screens/membership/chat',
        params: {
          thread_id: thread.id,
          subject: thread.subject || '',
          wing: thread.wing || '',
          thread_type: thread.thread_type,
        },
      });
    } catch (err: any) {
      showAlert({ title: 'Error', message: err.message || 'Failed to create chat' });
    }
  };

  const handleBack = () => {
    if (selectedWing) {
      setSelectedWing(null);
    } else if (selectedType) {
      setSelectedType(null);
    } else {
      router.back();
    }
  };

  const renderTypeSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Chat Type</Text>
      <Text style={styles.sectionDescription}>
        Choose the type of conversation you want to start
      </Text>

      <View style={styles.optionsGrid}>
        {CHAT_TYPE_OPTIONS.map((option) => {
          const isDisabled = option.requiresRole && !canCreateBroadcast;
          
          return (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.optionCard,
                isDisabled && styles.optionCardDisabled,
              ]}
              onPress={() => handleSelectType(option.type)}
              disabled={isDisabled}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                <Ionicons name={option.icon} size={28} color={option.color} />
              </View>
              <Text style={[styles.optionTitle, isDisabled && styles.optionTitleDisabled]}>
                {option.title}
              </Text>
              <Text style={[styles.optionDescription, isDisabled && styles.optionDescriptionDisabled]}>
                {option.description}
              </Text>
              {isDisabled && (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                  <Text style={styles.lockedText}>Leadership Only</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderWingSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Wing</Text>
      <Text style={styles.sectionDescription}>
        Choose which wing chat to join or create
      </Text>

      <View style={styles.wingList}>
        {WING_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.wing}
            style={[
              styles.wingCard,
              selectedWing === option.wing && styles.wingCardSelected,
              selectedWing === option.wing && { borderColor: option.color },
            ]}
            onPress={() => handleSelectWing(option.wing)}
            activeOpacity={0.7}
          >
            <View style={[styles.wingIcon, { backgroundColor: `${option.color}20` }]}>
              <Ionicons name={option.icon as any} size={24} color={option.color} />
            </View>
            <Text style={styles.wingLabel}>{option.label}</Text>
            {selectedWing === option.wing && (
              <Ionicons name="checkmark-circle" size={24} color={option.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderDetailsForm = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Chat Details</Text>
      <Text style={styles.sectionDescription}>
        Optional: Add a subject and description
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Subject (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Enter chat subject..."
            placeholderTextColor={theme.textSecondary}
            maxLength={100}
          />
        </View>

        {selectedType === 'broadcast' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe this announcement channel..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>
        )}
      </View>
    </View>
  );

  const renderSummary = () => {
    const typeOption = CHAT_TYPE_OPTIONS.find(o => o.type === selectedType);
    const wingOption = selectedWing ? WING_OPTIONS.find(o => o.wing === selectedWing) : null;

    return (
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Creating:</Text>
        <View style={styles.summaryContent}>
          <Ionicons 
            name={typeOption?.icon || 'chatbubbles'} 
            size={20} 
            color={wingOption?.color || typeOption?.color || theme.primary} 
          />
          <Text style={styles.summaryText}>
            {wingOption ? `${wingOption.label} Chat` : typeOption?.title || 'Chat'}
          </Text>
        </View>
      </View>
    );
  };

  // Determine which step to show
  const showWingSelection = selectedType === 'wing_chat' && !selectedWing;
  const showDetails = selectedType && (selectedType !== 'wing_chat' || selectedWing);

  return (
    <>
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'New Chat',
          headerBackTitle: 'Cancel',
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
              <Ionicons 
                name={selectedType ? 'arrow-back' : 'close'} 
                size={24} 
                color={theme.primary} 
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!selectedType && renderTypeSelection()}
        {showWingSelection && renderWingSelection()}
        {showDetails && (
          <>
            {renderSummary()}
            {renderDetailsForm()}
          </>
        )}
      </ScrollView>

      {showDetails && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              creating && styles.createButtonDisabled,
            ]}
            onPress={handleCreateThread}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <EduDashSpinner color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Chat</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
    <AlertModal {...alertProps} />
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerButton: {
      padding: 8,
      marginLeft: -8,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    sectionDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    optionCard: {
      width: '47%',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionCardDisabled: {
      opacity: 0.5,
    },
    optionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    optionTitleDisabled: {
      color: theme.textSecondary,
    },
    optionDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    optionDescriptionDisabled: {
      color: theme.textTertiary,
    },
    lockedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 4,
    },
    lockedText: {
      fontSize: 10,
      color: theme.textSecondary,
    },
    wingList: {
      gap: 12,
    },
    wingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: theme.border,
    },
    wingCardSelected: {
      borderWidth: 2,
    },
    wingIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    wingLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    summary: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    summaryTitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    summaryContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    summaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    form: {
      gap: 16,
    },
    inputGroup: {
      gap: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    textInput: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    footer: {
      padding: 16,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      gap: 8,
    },
    createButtonDisabled: {
      opacity: 0.7,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
