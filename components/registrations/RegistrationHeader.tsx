/**
 * RegistrationHeader Component
 * 
 * Header with gradient background, stats, and sync button.
 * Extracted from principal-registrations.tsx per WARP.md file size standards.
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface RegistrationHeaderProps {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  syncing: boolean;
  onSync: () => void;
  topInset: number;
}

export const RegistrationHeader: React.FC<RegistrationHeaderProps> = ({
  pendingCount,
  approvedCount,
  rejectedCount,
  syncing,
  onSync,
  topInset,
}) => {
  const { isDark } = useTheme();

  return (
    <LinearGradient
      colors={isDark ? ['#1E3A5F', '#0F172A'] : ['#3B82F6', '#1D4ED8']}
      style={[styles.headerGradient, { paddingTop: topInset + 16 }]}
    >
      {/* Header Row with Back + Title + Sync */}
      <View style={styles.headerRow}>
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Registration Requests</Text>
          <Text style={styles.headerSubtitle}>Review and approve parent applications</Text>
        </View>
        <TouchableOpacity 
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={onSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sync" size={18} color="#fff" />
              <Text style={styles.syncButtonText}>Sync</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{rejectedCount}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerGradient: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
    marginTop: -4,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
});

export default RegistrationHeader;
