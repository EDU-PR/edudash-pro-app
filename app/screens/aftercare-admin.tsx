/**
 * Aftercare Admin Screen (Native App)
 * 
 * Mobile screen for managing aftercare registrations.
 * Part of the K-12 School Admin flow for EduDash Pro Community School.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import AftercareDetailModal from '@/components/principal/AftercareDetailModal';
import { logger } from '@/lib/logger';
import { AfterCareRegistration, statusConfig, createStyles } from '@/lib/screen-styles/aftercare-admin.styles';

export default function AfterCareAdminScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert, alertProps } = useAlertModal();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [registrations, setRegistrations] = useState<AfterCareRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<AfterCareRegistration | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  
  const fetchRegistrations = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('aftercare_registrations')
        .select('*')
        .eq('preschool_id', organizationId)
        .order('created_at', { ascending: false });
      
      if (error && error.code !== '42P01') {
        logger.error('[AfterCareAdmin] Error:', error);
        showAlert({ title: 'Error', message: 'Failed to load registrations' });
        return;
      }
      
      setRegistrations(data || []);
    } catch (err) {
      logger.error('[AfterCareAdmin] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);
  
  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRegistrations();
  }, [fetchRegistrations]);
  
  const updateStatus = async (id: string, newStatus: AfterCareRegistration['status']) => {
    setProcessing(id);
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('aftercare_registrations')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Only trigger enrollment processing when status is 'enrolled'
      // This is when parent and student accounts are created
      if (newStatus === 'enrolled') {
        try {
          const { data: enrollmentResult, error: enrollmentError } = await supabase.functions.invoke(
            'process-aftercare-enrollment',
            {
              body: { registration_id: id },
            }
          );

          if (enrollmentError) {
            logger.error('[AfterCareAdmin] Enrollment processing error:', enrollmentError);
            showAlert({
              title: 'Partial Success',
              message: `Student enrolled but account creation may have failed.\n\nError: ${enrollmentError.message || 'Unknown error'}`,
            });
          } else if (enrollmentResult?.success) {
            const messages = [];
            if (enrollmentResult.data?.parent_account_created) {
              messages.push('✓ Parent account created');
            }
            if (enrollmentResult.data?.student_created) {
              messages.push('✓ Student record created');
            }
            if (enrollmentResult.data?.welcome_email_sent) {
              messages.push('✓ Welcome email sent');
            }
            showAlert({
              title: '🎉 Student Enrolled!',
              message: messages.length > 0 
                ? `${messages.join('\n')}\n\nParent will receive login details via email.`
                : 'Student has been enrolled successfully.',
            });
          } else {
            showAlert({ title: 'Success', message: 'Student enrolled successfully' });
          }
        } catch (enrollmentErr) {
          logger.error('[AfterCareAdmin] Enrollment processing exception:', enrollmentErr);
          showAlert({ title: 'Success', message: 'Student enrolled (account creation pending)' });
        }
      } else if (newStatus === 'paid') {
        // Send payment verified notification email to parent
        const registration = registrations.find(r => r.id === id);
        if (registration) {
          try {
            await supabase.functions.invoke('send-aftercare-payment-verified', {
              body: {
                registration_id: id,
                parent_email: registration.parent_email,
                parent_name: `${registration.parent_first_name} ${registration.parent_last_name}`,
                child_name: `${registration.child_first_name} ${registration.child_last_name}`,
                payment_amount: registration.registration_fee,
              },
            });
            logger.debug('[AfterCareAdmin] ✅ Payment verified email sent');
          } catch (emailErr) {
            logger.warn('[AfterCareAdmin] Failed to send payment verified email:', emailErr);
            // Don't block the success - email is non-critical
          }
        }
        
        showAlert({
          title: 'Payment Verified ✓',
          message: 'Payment has been verified and the parent has been notified via email.\n\nClick "Enroll Student" when ready to create their account.',
        });
      } else if (newStatus === 'cancelled') {
        showAlert({ title: 'Registration Cancelled', message: 'This registration has been cancelled.' });
      } else {
        showAlert({ title: 'Status Updated', message: `Status changed to ${statusConfig[newStatus].label}` });
      }
      
      // Update local state
      setRegistrations(prev => 
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );
      
      if (selectedRegistration?.id === id) {
        setSelectedRegistration(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      // Refresh to get latest data
      await fetchRegistrations();
    } catch (err) {
      logger.error('[AfterCareAdmin] Update error:', err);
      showAlert({ title: 'Error', message: 'Failed to update status' });
    } finally {
      setProcessing(null);
    }
  };

  // Resend confirmation email to parent
  const resendConfirmationEmail = async (registration: AfterCareRegistration) => {
    setProcessing(registration.id);
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase.functions.invoke('send-aftercare-confirmation', {
        body: {
          registration_id: registration.id,
          parent_email: registration.parent_email,
          parent_name: `${registration.parent_first_name} ${registration.parent_last_name}`,
          child_name: `${registration.child_first_name} ${registration.child_last_name}`,
          payment_reference: registration.payment_reference || `AC-${registration.id.slice(0, 8).toUpperCase()}`,
          has_proof: !!registration.proof_of_payment_url,
          registration_fee: registration.registration_fee,
          is_early_bird: registration.registration_fee < registration.registration_fee_original,
        },
      });
      
      if (error) {
        logger.error('[AfterCareAdmin] Resend email error:', error);
        showAlert({ title: 'Error', message: `Failed to resend email: ${error.message || 'Unknown error'}` });
        return;
      }
      
      logger.debug('[AfterCareAdmin] ✅ Confirmation email resent:', data);
      showAlert({
        title: 'Email Sent ✓',
        message: `Confirmation email has been resent to:\n${registration.parent_email}\n\nThe email includes banking details${registration.proof_of_payment_url ? ' (POP already received)' : ''} and WhatsApp group link.`,
      });
    } catch (err) {
      logger.error('[AfterCareAdmin] Resend email exception:', err);
      showAlert({ title: 'Error', message: 'Failed to resend confirmation email. Please try again.' });
    } finally {
      setProcessing(null);
    }
  };
  
  const filteredRegistrations = statusFilter === 'all' 
    ? registrations 
    : registrations.filter(r => r.status === statusFilter);
  
  const stats = {
    total: registrations.length,
    pending: registrations.filter(r => r.status === 'pending_payment').length,
    paid: registrations.filter(r => r.status === 'paid').length,
    enrolled: registrations.filter(r => r.status === 'enrolled').length,
  };
  
  const renderRegistration = ({ item }: { item: AfterCareRegistration }) => {
    const config = statusConfig[item.status];
    
    return (
      <TouchableOpacity
        style={styles.registrationCard}
        onPress={() => setSelectedRegistration(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.child_first_name[0]}{item.child_last_name[0]}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.childName}>
              {item.child_first_name} {item.child_last_name}
            </Text>
            <Text style={styles.gradeText}>Grade {item.child_grade}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>
              {item.parent_first_name} {item.parent_last_name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>{item.payment_reference || 'No reference'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <EduDashSpinner size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading registrations...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#6D28D9']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Aftercare Registrations</Text>
            <Text style={styles.headerSubtitle}>{profile?.organization_name || 'My School'}</Text>
          </View>
        </View>
        
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.paid}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.enrolled}</Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {['all', 'pending_payment', 'paid', 'enrolled', 'cancelled'].map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              statusFilter === filter && styles.filterTabActive
            ]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text style={[
              styles.filterTabText,
              statusFilter === filter && styles.filterTabTextActive
            ]}>
              {filter === 'all' ? 'All' : statusConfig[filter as keyof typeof statusConfig]?.label || filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* List */}
      <FlatList
        data={filteredRegistrations}
        keyExtractor={item => item.id}
        renderItem={renderRegistration}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No registrations found</Text>
          </View>
        }
      />
      
      <AftercareDetailModal
        registration={selectedRegistration}
        onClose={() => setSelectedRegistration(null)}
        processing={processing}
        updateStatus={updateStatus}
        resendEmail={resendConfirmationEmail}
        showAlert={showAlert}
        theme={theme}
        styles={styles}
        topInset={insets.top}
      />
      <AlertModal {...alertProps} />
    </View>
  );
}
