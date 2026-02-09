import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface InviteShareData {
  token: string;
  email: string;
  link: string;
  message: string;
}

interface InviteShareModalProps {
  visible: boolean;
  inviteShare: InviteShareData | null;
  onClose: () => void;
  onAction: (action: string) => void;
  styles: any;
  theme: ThemeColors;
}

export function InviteShareModal({
  visible, inviteShare, onClose, onAction, styles, theme,
}: InviteShareModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.inviteShareCard, { backgroundColor: theme?.card || '#0f172a', borderColor: theme?.border || '#1f2937' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme?.text }]}>Invite Ready</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme?.textSecondary || '#9ca3af'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSubtitle, { color: theme?.textSecondary }]}>
            Share this invite with the teacher to finish setup.
          </Text>
          <View style={styles.inviteMetaRow}>
            <View style={styles.inviteMetaPill}>
              <Text style={styles.inviteMetaLabel}>Email</Text>
              <Text style={styles.inviteMetaValue}>{inviteShare?.email || '-'}</Text>
            </View>
            <View style={styles.inviteMetaPill}>
              <Text style={styles.inviteMetaLabel}>Code</Text>
              <Text style={styles.inviteMetaValue}>{inviteShare?.token?.slice(0, 6)}…</Text>
            </View>
          </View>
          <View style={styles.inviteActionGrid}>
            <TouchableOpacity style={[styles.inviteActionButton, styles.invitePrimary]} onPress={() => onAction('whatsapp')}>
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={styles.inviteActionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.inviteActionButton, styles.inviteSecondary]} onPress={() => onAction('sms')}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              <Text style={styles.inviteActionText}>SMS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.inviteActionButton, styles.inviteSecondary]} onPress={() => onAction('email')}>
              <Ionicons name="mail" size={18} color="#fff" />
              <Text style={styles.inviteActionText}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.inviteActionButton, styles.inviteSecondary]} onPress={() => onAction('share')}>
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.inviteActionText}>Share</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inviteActionGrid}>
            <TouchableOpacity style={[styles.inviteActionButton, styles.inviteNeutral]} onPress={() => onAction('copyLink')}>
              <Ionicons name="link" size={18} color="#111827" />
              <Text style={[styles.inviteActionText, styles.inviteNeutralText]}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.inviteActionButton, styles.inviteNeutral]} onPress={() => onAction('copyCode')}>
              <Ionicons name="key" size={18} color="#111827" />
              <Text style={[styles.inviteActionText, styles.inviteNeutralText]}>Copy Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
