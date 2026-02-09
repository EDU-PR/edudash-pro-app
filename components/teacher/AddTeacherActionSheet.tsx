import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface AddTeacherActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onDirectAdd?: () => void;
  onInviteByEmail: () => void;
  onCopyInviteLink: () => void;
  onCreateAccount?: () => void;
  styles: any;
  theme: ThemeColors;
}

export function AddTeacherActionSheet({
  visible, onClose, onInviteByEmail, onCopyInviteLink, onCreateAccount, styles, theme,
}: AddTeacherActionSheetProps) {
  const actions = [
    {
      icon: 'person-add' as const,
      color: '#6366F1',
      title: 'Create Account',
      desc: 'Create teacher account with login credentials',
      onPress: () => { onClose(); onCreateAccount?.(); },
    },
    {
      icon: 'mail' as const,
      color: '#22c55e',
      title: 'Invite by Email',
      desc: 'Send an invite link via email',
      onPress: () => { onClose(); onInviteByEmail(); },
    },
    {
      icon: 'link' as const,
      color: '#f59e0b',
      title: 'Copy Invite Link',
      desc: 'Copy a shareable invite link',
      onPress: () => { onClose(); onCopyInviteLink(); },
    },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.actionSheet, { backgroundColor: theme?.card || '#0f172a', borderColor: theme?.border || '#1f2937' }]}>
          <Text style={[styles.actionSheetTitle, { color: theme?.text }]}>Add Teacher</Text>
          <Text style={[styles.actionSheetSubtitle, { color: theme?.textSecondary }]}>
            Choose how you'd like to add a teacher
          </Text>
          {actions.map((action) => (
            <TouchableOpacity key={action.title} style={styles.actionSheetCard} onPress={action.onPress}>
              <View style={[styles.actionSheetCardIcon, { backgroundColor: `${action.color}20` }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <View style={styles.actionSheetCardInfo}>
                <Text style={[styles.actionSheetCardTitle, { color: theme?.text }]}>{action.title}</Text>
                <Text style={[styles.actionSheetCardDesc, { color: theme?.textSecondary }]}>{action.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme?.textSecondary || '#9ca3af'} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.actionSheetCancelBtn} onPress={onClose}>
            <Text style={[styles.actionSheetCancelText, { color: theme?.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
