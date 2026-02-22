/**
 * Parent Children Screen
 *
 * Lists all children linked to the parent, with avatar upload, status, and quick actions.
 *
 * State/handlers extracted → hooks/useParentChildren.ts
 * Styles extracted → parent-children.styles.ts
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useParentChildren } from '@/hooks/useParentChildren';
import { createParentChildrenStyles } from '@/lib/screen-styles/parent-children.styles';

const STATUS_TONES: Record<string, { bg: string; border: string; text: string }> = {
  inactive: { bg: '#DC262622', border: '#DC262655', text: '#B91C1C' },
  pending:  { bg: '#F59E0B22', border: '#F59E0B55', text: '#B45309' },
  active:   { bg: '#05966922', border: '#05966955', text: '#047857' },
};

export default function ParentChildrenScreen() {
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createParentChildrenStyles(theme), [theme]);
  const h = useParentChildren(showAlert);

  if (h.loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title="My Children" showBackButton onBackPress={h.handleBackPress} />
        <View style={[styles.section, { justifyContent: 'center', flex: 1 }]}>
          <Text style={{ color: theme.text, textAlign: 'center' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="My Children" showBackButton onBackPress={h.handleBackPress} />
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={h.refreshing} onRefresh={h.onRefresh} />}>
        <View style={styles.section}>
          {h.children.length > 0 ? (
            <>
              {h.children.map(child => {
                const initials = h.getChildInitials(child);
                const statusKey = child?.is_active === false || child?.status === 'inactive' ? 'inactive' : child?.status === 'pending' ? 'pending' : 'active';
                const tone = STATUS_TONES[statusKey] || STATUS_TONES.active;
                return (
                  <TouchableOpacity key={child.id} style={styles.childCard} onPress={() => router.push(`/screens/student-detail?id=${child.id}` as any)}>
                    <View style={styles.idTagPunchHole} />
                    <View style={styles.idTagGlow} />
                    <View style={styles.childHeader}>
                      <View style={styles.avatarShell}>
                        <View style={styles.avatar}>
                          {child.avatar_url ? <Image source={{ uri: child.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
                          <TouchableOpacity style={styles.avatarUploadButton} onPress={() => h.showAvatarOptions(child.id)} disabled={h.uploadingChildId === child.id}>
                            {h.uploadingChildId === child.id ? <EduDashSpinner size="small" color={theme.onPrimary} /> : <Ionicons name="camera" size={14} color={theme.onPrimary} />}
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.childInfo}>
                        <Text style={styles.childName} numberOfLines={1}>{child.first_name} {child.last_name}</Text>
                        <Text style={styles.childDetails}>{h.getChildAge(child.date_of_birth)} • {child.classes?.grade_level || 'Preschool'}</Text>
                        <Text style={styles.childDetails}>Class: {child.classes?.name || 'Not assigned'}</Text>
                      </View>
                      <View style={styles.childIdBadge}><Text style={styles.childIdBadgeText}>{(child.student_id || child.id).slice(0, 8).toUpperCase()}</Text></View>
                    </View>
                    <View style={styles.childFooter}>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}><Text style={[styles.statusPillText, { color: tone.text }]}>{statusKey.toUpperCase()}</Text></View>
                      <Text style={styles.cardSerialText}>#{child.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                    <View style={styles.childActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => router.push(`/screens/attendance?id=${child.id}` as any)}><Ionicons name="calendar" size={16} color={theme.primary} /><Text style={styles.actionButtonText}>Attendance</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.actionButton} onPress={() => {}}><Ionicons name="book" size={16} color={theme.primary} /><Text style={styles.actionButtonText}>Homework</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.actionButton} onPress={() => {}}><Ionicons name="trending-up" size={16} color={theme.primary} /><Text style={styles.actionButtonText}>Progress</Text></TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.addChildSection}>
                <TouchableOpacity style={styles.addChildButton} onPress={() => router.push('/screens/parent-child-registration')}>
                  <Ionicons name="person-add" size={20} color={theme.onPrimary} /><Text style={styles.addChildButtonText}>Register Another Child</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-add" size={64} color={theme.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Children Found</Text>
              <Text style={styles.emptySubtitle}>You don't have any children linked to your account yet. Register a new child or request to link an existing one.</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push('/screens/parent-child-registration')}><Text style={styles.addButtonText}>Register Child</Text></TouchableOpacity>
              <View style={{ height: 8 }} />
              <TouchableOpacity style={styles.addButton} onPress={() => router.push('/screens/parent-join-by-code')}><Text style={styles.addButtonText}>Have a school code? Join by Code</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <ImageConfirmModal visible={!!h.pendingAvatar} imageUri={h.pendingAvatar?.uri || null} title="Child Photo" confirmLabel="Set Photo" confirmIcon="checkmark-circle-outline" showCrop cropAspect={[1, 1]} loading={!!h.uploadingChildId} onConfirm={h.confirmAvatarUpload} onCancel={() => h.setPendingAvatar(null)} />
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}
