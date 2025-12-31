import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useParentPayments } from '@/hooks/useParentPayments';
import type { PaymentTabType, StudentFee } from '@/types/payments';

// Import components
import {
  ChildSelector,
  SelectedChildCard,
  BalanceCard,
  NextPaymentCard,
  RegistrationCard,
  UpcomingFeesList,
  FeeStructureList,
  PaymentHistoryList,
  POPUploadSection,
  PaymentUploadModal,
} from '@/components/payments';

export default function ParentPaymentsScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const router = useRouter();
  
  // Data hook
  const {
    loading,
    refreshing,
    children,
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    feeStructure,
    popUploads,
    upcomingFees,
    paidFees,
    outstandingBalance,
    onRefresh,
    reloadFees,
  } = useParentPayments();

  // Local UI state
  const [activeTab, setActiveTab] = useState<PaymentTabType>('upcoming');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFeeAmount, setSelectedFeeAmount] = useState('');

  const styles = useMemo(() => createStyles(theme), [theme]);

  const openUploadForFee = (fee: StudentFee) => {
    setSelectedFeeAmount(fee.amount.toString());
    setShowUploadModal(true);
  };

  const handlePayNow = (fee: StudentFee) => {
    if (!selectedChildId || !selectedChild) {
      Alert.alert('Error', 'Please select a child first');
      return;
    }

    // Navigate to payment flow screen with fee details
    router.push({
      pathname: '/screens/payment-flow',
      params: {
        feeId: fee.id,
        feeDescription: fee.description,
        feeAmount: fee.amount.toString(),
        childId: selectedChildId,
        childName: `${selectedChild.first_name} ${selectedChild.last_name}`,
        studentCode: selectedChild.student_code,
        preschoolId: selectedChild.preschool_id,
        preschoolName: selectedChild.preschool_name || '',
      },
    });
  };

  const handleUploadSuccess = () => {
    reloadFees();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Fees & Payments" subtitle={selectedChild?.preschool_name} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading payment information...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Fees & Payments" subtitle={selectedChild?.preschool_name} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Child Selector */}
        <ChildSelector 
          children={children}
          selectedChildId={selectedChildId}
          onSelectChild={setSelectedChildId}
          theme={theme}
        />

        {/* Selected Child Card */}
        {selectedChild && (
          <SelectedChildCard child={selectedChild} theme={theme} />
        )}

        {/* Balance Overview */}
        <BalanceCard 
          outstandingBalance={outstandingBalance} 
          upcomingFeesCount={upcomingFees.length}
          theme={theme} 
        />

        {/* Next Payment */}
        <NextPaymentCard upcomingFees={upcomingFees} theme={theme} />

        {/* Registration Fee */}
        {selectedChild && (
          <RegistrationCard child={selectedChild} theme={theme} />
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {(['upcoming', 'history', 'upload'] as PaymentTabType[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'upcoming' ? 'Upcoming' : tab === 'history' ? 'History' : 'Upload'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'upcoming' && (
            <>
              <Text style={styles.sectionTitle}>Upcoming Payments</Text>
              <UpcomingFeesList 
                fees={upcomingFees} 
                onUploadPress={openUploadForFee}
                onPayPress={handlePayNow}
                theme={theme} 
              />
              <FeeStructureList feeStructure={feeStructure} theme={theme} />
            </>
          )}

          {activeTab === 'history' && (
            <>
              <Text style={styles.sectionTitle}>Payment History</Text>
              <PaymentHistoryList paidFees={paidFees} theme={theme} />
            </>
          )}

          {activeTab === 'upload' && (
            <>
              <Text style={styles.sectionTitle}>Upload Proof of Payment</Text>
              <POPUploadSection 
                popUploads={popUploads}
                onUploadPress={() => setShowUploadModal(true)}
                theme={theme}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* Upload Modal */}
      <PaymentUploadModal
        visible={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedFeeAmount('');
        }}
        onSuccess={handleUploadSuccess}
        selectedChildId={selectedChildId}
        selectedChild={selectedChild}
        userId={user?.id || ''}
        preschoolId={profile?.preschool_id}
        initialAmount={selectedFeeAmount}
        theme={theme}
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.textSecondary,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    minHeight: 200,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
});
