import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface DashOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenSearch: () => void;
  onOpenOrb: () => void;
  onOpenScanner?: () => void;
  onRunScheduleTool?: () => void;
  onRunAssignmentsTool?: () => void;
  models?: Array<{
    id: string;
    displayName?: string;
    name?: string;
  }>;
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  isBusy?: boolean;
}

interface OptionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}

function OptionItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
}: OptionItemProps) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.optionButton,
        {
          backgroundColor: theme.surfaceVariant || '#1f2937',
          borderColor: theme.border || '#334155',
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={theme.primary || '#8b5cf6'}
      />
      <View style={styles.optionTextWrap}>
        <Text style={[styles.optionTitle, { color: theme.text || '#f8fafc' }]}>
          {title}
        </Text>
        <Text style={[styles.optionSubtitle, { color: theme.textSecondary || '#94a3b8' }]}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function DashOptionsSheet({
  visible,
  onClose,
  onNewChat,
  onOpenHistory,
  onOpenSearch,
  onOpenOrb,
  onOpenScanner,
  onRunScheduleTool,
  onRunAssignmentsTool,
  models = [],
  selectedModelId,
  onSelectModel,
  isBusy = false,
}: DashOptionsSheetProps) {
  const { theme } = useTheme();

  const closeThen = useCallback((next: () => void) => {
    onClose();
    setTimeout(() => {
      next();
    }, 40);
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface || '#111827',
              borderColor: theme.border || '#334155',
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Ionicons name="sparkles-outline" size={22} color={theme.primary || '#8b5cf6'} />
            <Text style={[styles.headerTitle, { color: theme.text || '#f8fafc' }]}>
              Dash Options
            </Text>
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary || '#94a3b8' }]}>
            Quick actions and tools
          </Text>

          {Array.isArray(models) && models.length > 0 && (
            <View style={styles.modelSection}>
              <Text style={[styles.modelTitle, { color: theme.textSecondary || '#94a3b8' }]}>
                Model
              </Text>
              <View style={styles.modelRow}>
                {models.map((model) => {
                  const active = model.id === selectedModelId;
                  const label = model.displayName || model.name || model.id;
                  return (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.modelChip,
                        {
                          backgroundColor: active ? (theme.primary || '#8b5cf6') + '24' : (theme.surfaceVariant || '#1f2937'),
                          borderColor: active ? (theme.primary || '#8b5cf6') : (theme.border || '#334155'),
                        },
                      ]}
                      activeOpacity={0.8}
                      disabled={isBusy}
                      onPress={() => {
                        if (onSelectModel) {
                          closeThen(() => onSelectModel(model.id));
                        }
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.modelChipText,
                          { color: active ? (theme.primary || '#8b5cf6') : (theme.text || '#f8fafc') },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <OptionItem
            icon="add-circle-outline"
            title="New Chat"
            subtitle="Start a fresh conversation"
            disabled={isBusy}
            onPress={() => closeThen(onNewChat)}
          />
          <OptionItem
            icon="time-outline"
            title="Conversation History"
            subtitle="Open recent chats"
            disabled={isBusy}
            onPress={() => closeThen(onOpenHistory)}
          />
          <OptionItem
            icon="search-outline"
            title="Find App Feature"
            subtitle="Search screens and tools"
            disabled={isBusy}
            onPress={() => closeThen(onOpenSearch)}
          />
          {!!onOpenScanner && (
            <OptionItem
              icon="camera-outline"
              title="Scan Homework"
              subtitle="Capture and analyze from camera"
              disabled={isBusy}
              onPress={() => closeThen(onOpenScanner)}
            />
          )}
          {!!onRunScheduleTool && (
            <OptionItem
              icon="calendar-outline"
              title="Upcoming Schedule"
              subtitle="Run agent tool for weekly events"
              disabled={isBusy}
              onPress={() => closeThen(onRunScheduleTool)}
            />
          )}
          {!!onRunAssignmentsTool && (
            <OptionItem
              icon="document-text-outline"
              title="Assignments Due"
              subtitle="Run agent tool for pending work"
              disabled={isBusy}
              onPress={() => closeThen(onRunAssignmentsTool)}
            />
          )}
          <OptionItem
            icon="planet-outline"
            title="Open Dash Orb"
            subtitle="Switch to voice-first mode"
            disabled={isBusy}
            onPress={() => closeThen(onOpenOrb)}
          />
          <TouchableOpacity
            style={[
              styles.closeButton,
              { backgroundColor: theme.error || '#ef4444' },
            ]}
            activeOpacity={0.85}
            onPress={onClose}
          >
            <Text style={[styles.closeText, { color: theme.onError || '#fff' }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  optionButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionSubtitle: {
    marginTop: 1,
    fontSize: 13,
  },
  modelSection: {
    marginBottom: 2,
  },
  modelTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    maxWidth: '48%',
  },
  modelChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DashOptionsSheet;
