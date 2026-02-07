import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';
import StudentAvatarService from '@/services/StudentAvatarService';
import { fetchParentChildren } from '@/lib/parent-children';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function ParentChildrenScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingChildId, setUploadingChildId] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ childId: string; uri: string } | null>(null);
  
  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const loadChildren = useCallback(async () => {
    try {
      setLoading(true);
      
      if (user?.id) {
        const client = assertSupabase();
        
        // Get user's profile by auth_user_id (NOT profiles.id!)
        // auth_user_id links to auth.users.id, while profiles.id is the internal profile ID
        const { data: me } = await client
          .from('profiles')
          .select('id, preschool_id, organization_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        if (me?.id) {
          const studentsData = await fetchParentChildren(me.id, { includeInactive: false });
          const normalized = (studentsData || []).map((child: any) => ({
            ...child,
            classes: Array.isArray(child.classes) ? child.classes[0] ?? null : child.classes ?? null,
          }));
          setChildren(normalized);
        }
      }
    } catch (error) {
      console.error('Error loading children:', error);
      Alert.alert('Error', 'Failed to load children');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, [loadChildren]);

  const getChildAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 'Age unknown';
    try {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      const age = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age > 0 && age < 10 ? `${age} years old` : 'Age unknown';
    } catch {
      return 'Age unknown';
    }
  };

  const getChildInitials = (child: any) => {
    return `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`.toUpperCase() || 'ST';
  };

  const handleAvatarUpload = useCallback(async (childId: string, source: 'camera' | 'library') => {
    try {
      const hasPermission = source === 'camera'
        ? (await ImagePicker.requestCameraPermissionsAsync()).status === 'granted'
        : await ensureImageLibraryPermission();
      
      if (!hasPermission) {
        Alert.alert(
          'Permission required',
          source === 'camera'
            ? 'Camera permission is required to take a photo.'
            : 'Photo library permission is required to select a photo.'
        );
        return;
      }

      const pickerResult = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
        return;
      }

      // Show preview modal instead of uploading immediately
      setPendingAvatar({ childId, uri: pickerResult.assets[0].uri });
    } catch (error) {
      console.error('Error picking child photo:', error);
      Alert.alert('Error', 'Failed to select photo.');
    }
  }, []);

  const confirmAvatarUpload = useCallback(async (uri: string) => {
    if (!pendingAvatar) return;
    const { childId } = pendingAvatar;
    setPendingAvatar(null);

    try {
      setUploadingChildId(childId);
      const uploadResult = await StudentAvatarService.uploadStudentAvatar(childId, uri);

      if (uploadResult.success && uploadResult.publicUrl) {
        setChildren((prev) =>
          prev.map((child) =>
            child.id === childId ? { ...child, avatar_url: uploadResult.publicUrl } : child
          )
        );
        Alert.alert('Success', 'Child profile photo updated.');
      } else {
        Alert.alert('Upload Failed', uploadResult.error || 'Unable to upload profile photo.');
      }
    } catch (error) {
      console.error('Error uploading child photo:', error);
      Alert.alert('Error', 'Failed to upload profile photo.');
    } finally {
      setUploadingChildId(null);
    }
  }, [pendingAvatar]);

  const showAvatarOptions = useCallback((childId: string) => {
    Alert.alert('Update Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => handleAvatarUpload(childId, 'camera') },
      { text: 'Choose from Library', onPress: () => handleAvatarUpload(childId, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleAvatarUpload]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    childCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border + 'AA',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
      overflow: 'hidden',
      position: 'relative',
    },
    idTagPunchHole: {
      position: 'absolute',
      top: 10,
      right: 12,
      width: 14,
      height: 14,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: theme.text + '30',
      backgroundColor: theme.background,
      zIndex: 2,
    },
    idTagGlow: {
      position: 'absolute',
      right: -16,
      top: -12,
      width: 84,
      height: 84,
      borderRadius: 999,
      backgroundColor: theme.primary + '1F',
    },
    childHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarShell: {
      width: 60,
      height: 60,
      borderRadius: 14,
      overflow: 'hidden',
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border + '88',
      backgroundColor: theme.surfaceVariant || theme.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: 14,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 14,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.onPrimary || '#fff',
    },
    avatarUploadButton: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: theme.primary,
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.surface,
    },
    childInfo: {
      flex: 1,
    },
    childName: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    childDetails: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    childIdBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.primary + '66',
      backgroundColor: theme.primary + '12',
      paddingHorizontal: 8,
      paddingVertical: 4,
      maxWidth: 104,
    },
    childIdBadgeText: {
      color: theme.primary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    childFooter: {
      marginTop: 10,
      marginBottom: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border + '80',
      paddingTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cardSerialText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.8,
    },
    childActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.primary + '10',
      borderWidth: 1,
      borderColor: theme.primary + '20',
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.primary,
      marginLeft: 4,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    addButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    addButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    // Add child button section styles
    addChildSection: {
      marginTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    addChildButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
    },
    addChildButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginTop: 12,
      gap: 8,
    },
    secondaryButtonText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="My Children" showBackButton={true} onBackPress={handleBackPress} />
        <View style={[styles.section, { justifyContent: 'center', flex: 1 }]}>
          <Text style={{ color: theme.text, textAlign: 'center' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Children" showBackButton={true} onBackPress={handleBackPress} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          {children.length > 0 ? (
            <>
              {children.map((child) => {
                const initials = getChildInitials(child);
                const statusKey = child?.is_active === false || child?.status === 'inactive'
                  ? 'inactive'
                  : child?.status === 'pending'
                  ? 'pending'
                  : 'active';
                const statusTone =
                  statusKey === 'inactive'
                    ? { bg: '#DC262622', border: '#DC262655', text: '#B91C1C' }
                    : statusKey === 'pending'
                    ? { bg: '#F59E0B22', border: '#F59E0B55', text: '#B45309' }
                    : { bg: '#05966922', border: '#05966955', text: '#047857' };
                
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.childCard}
                    onPress={() => router.push(`/screens/student-detail?id=${child.id}` as any)}
                  >
                    <View style={styles.idTagPunchHole} />
                    <View style={styles.idTagGlow} />
                    <View style={styles.childHeader}>
                      <View style={styles.avatarShell}>
                        <View style={styles.avatar}>
                          {child.avatar_url ? (
                            <Image source={{ uri: child.avatar_url }} style={styles.avatarImage} />
                          ) : (
                            <Text style={styles.avatarText}>{initials}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.avatarUploadButton}
                            onPress={() => showAvatarOptions(child.id)}
                            disabled={uploadingChildId === child.id}
                          >
                            {uploadingChildId === child.id ? (
                              <EduDashSpinner size="small" color={theme.onPrimary} />
                            ) : (
                              <Ionicons name="camera" size={14} color={theme.onPrimary} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={styles.childInfo}>
                        <Text style={styles.childName} numberOfLines={1}>
                          {child.first_name} {child.last_name}
                        </Text>
                        <Text style={styles.childDetails}>
                          {getChildAge(child.date_of_birth)} • {child.classes?.grade_level || 'Preschool'}
                        </Text>
                        <Text style={styles.childDetails}>
                          Class: {child.classes?.name || 'Not assigned'}
                        </Text>
                      </View>

                      <View style={styles.childIdBadge}>
                        <Text style={styles.childIdBadgeText}>
                          {(child.student_id || child.id).slice(0, 8).toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.childFooter}>
                      <View style={[styles.statusPill, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
                        <Text style={[styles.statusPillText, { color: statusTone.text }]}>
                          {statusKey.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.cardSerialText}>#{child.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                    
                    <View style={styles.childActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => router.push(`/screens/attendance?id=${child.id}` as any)}
                      >
                        <Ionicons name="calendar" size={16} color={theme.primary} />
                        <Text style={styles.actionButtonText}>Attendance</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => console.log('Homework coming soon')}
                      >
                        <Ionicons name="book" size={16} color={theme.primary} />
                        <Text style={styles.actionButtonText}>Homework</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => console.log('Progress report coming soon')}
                      >
                        <Ionicons name="trending-up" size={16} color={theme.primary} />
                        <Text style={styles.actionButtonText}>Progress</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.addChildSection}>
                <TouchableOpacity 
                  style={styles.addChildButton}
                  onPress={() => router.push('/screens/parent-child-registration')}
                >
                  <Ionicons name="person-add" size={20} color={theme.onPrimary} />
                  <Text style={styles.addChildButtonText}>Register Another Child</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-add" size={64} color={theme.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Children Found</Text>
              <Text style={styles.emptySubtitle}>
                You don't have any children linked to your account yet. 
                Register a new child or request to link an existing one.
              </Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => router.push('/screens/parent-child-registration')}
              >
                <Text style={styles.addButtonText}>Register Child</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => router.push('/screens/parent-join-by-code')}
              >
                <Text style={styles.addButtonText}>Have a school code? Join by Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Image preview + confirm modal for child avatar */}
      <ImageConfirmModal
        visible={!!pendingAvatar}
        imageUri={pendingAvatar?.uri || null}
        title="Child Photo"
        confirmLabel="Set Photo"
        confirmIcon="checkmark-circle-outline"
        showCrop
        cropAspect={[1, 1]}
        loading={!!uploadingChildId}
        onConfirm={confirmAvatarUpload}
        onCancel={() => setPendingAvatar(null)}
      />
    </View>
  );
}
