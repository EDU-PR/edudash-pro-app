import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useUpdates } from '@/contexts/UpdatesProvider';
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DebugUpdatesScreen() {
  const { checkForUpdates, applyUpdate, isDownloading, isUpdateDownloaded, updateError } = useUpdates();
  const [checking, setChecking] = useState(false);

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const hasUpdate = await checkForUpdates();
      Alert.alert(
        'Update Check Complete',
        hasUpdate ? 'Update found and downloaded!' : 'No updates available',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    Alert.alert(
      'Apply Update',
      'This will restart the app. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart', onPress: applyUpdate }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update Debug</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Update Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Build Info</Text>
          <InfoRow label="Updates Enabled" value={Updates.isEnabled ? 'Yes' : 'No'} />
          <InfoRow label="Channel" value={Updates.channel || 'N/A'} />
          <InfoRow label="Runtime Version" value={Updates.runtimeVersion || 'N/A'} />
          <InfoRow label="Update ID" value={Updates.updateId?.substring(0, 8) || 'N/A'} />
          <InfoRow label="Created At" value={Updates.createdAt?.toLocaleString() || 'N/A'} />
          <InfoRow label="Dev Mode" value={__DEV__ ? 'Yes' : 'No'} />
        </View>

        {/* Update Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update Status</Text>
          <InfoRow label="Downloading" value={isDownloading ? 'Yes' : 'No'} />
          <InfoRow label="Update Downloaded" value={isUpdateDownloaded ? 'Yes' : 'No'} />
          <InfoRow label="Error" value={updateError || 'None'} />
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={[styles.button, checking && styles.buttonDisabled]}
            onPress={handleCheckUpdates}
            disabled={checking || isDownloading}
          >
            <Text style={styles.buttonText}>
              {checking ? 'Checking...' : 'Check for Updates'}
            </Text>
          </TouchableOpacity>

          {isUpdateDownloaded && (
            <TouchableOpacity
              style={[styles.button, styles.applyButton]}
              onPress={handleApplyUpdate}
            >
              <Text style={styles.buttonText}>Apply Update & Restart</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Environment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environment Variables</Text>
          <InfoRow 
            label="EXPO_PUBLIC_ENABLE_OTA_UPDATES" 
            value={process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES || 'undefined'} 
          />
          <InfoRow 
            label="EXPO_PUBLIC_ENVIRONMENT" 
            value={process.env.EXPO_PUBLIC_ENVIRONMENT || 'undefined'} 
          />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  infoLabel: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    flex: 2,
    textAlign: 'right',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#4b5563',
  },
  applyButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
