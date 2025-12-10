import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface UpdateInfo {
  updateId: string | null;
  runtimeVersion: string | null;
  channel: string | null;
  isEmergencyLaunch: boolean;
  lastCheckTime: Date | null;
  manifestString: string | null;
}

export function UpdateDebugPanel() {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    updateId: null,
    runtimeVersion: null,
    channel: null,
    isEmergencyLaunch: false,
    lastCheckTime: null,
    manifestString: null,
  });
  const [checking, setChecking] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Only show in preview builds
  const isPreview = process.env.EXPO_PUBLIC_ENVIRONMENT === 'preview';

  useEffect(() => {
    if (visible) {
      loadUpdateInfo();
    }
  }, [visible]);

  const loadUpdateInfo = async () => {
    try {
      const manifest = Updates.manifest;
      
      setUpdateInfo({
        updateId: Updates.updateId || 'embedded',
        runtimeVersion: Updates.runtimeVersion || 'unknown',
        channel: Updates.channel || 'unknown',
        isEmergencyLaunch: Updates.isEmergencyLaunch,
        lastCheckTime: null,
        manifestString: manifest ? JSON.stringify(manifest, null, 2) : null,
      });
    } catch (error) {
      console.warn('Failed to load update info:', error);
    }
  };

  const handleCheckForUpdate = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Updates Disabled', 'Updates are disabled in this build.');
      return;
    }
    
    // Skip in development builds - Updates API not supported
    if (__DEV__) {
      Alert.alert('Development Build', 'Update checks are not supported in development builds.');
      return;
    }

    try {
      setChecking(true);
      console.log('[UpdateDebug] Checking for updates...');
      
      const result = await Updates.checkForUpdateAsync();
      console.log('[UpdateDebug] Check result:', result);
      
      if (result.isAvailable) {
        Alert.alert(
          'Update Available',
          `New update found!\nManifest ID: ${result.manifest?.id}\nWould you like to fetch it?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Fetch Now', onPress: handleFetchUpdate }
          ]
        );
      } else {
        Alert.alert('No Update', 'You are already running the latest version.');
      }
      
      // Reload info after check
      await loadUpdateInfo();
    } catch (error) {
      console.error('[UpdateDebug] Check failed:', error);
      Alert.alert('Check Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setChecking(false);
    }
  };

  const handleFetchUpdate = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Updates Disabled', 'Updates are disabled in this build.');
      return;
    }

    try {
      setFetching(true);
      console.log('[UpdateDebug] Fetching update...');
      
      const result = await Updates.fetchUpdateAsync();
      console.log('[UpdateDebug] Fetch result:', result);
      
      if (result.isNew) {
        Alert.alert(
          'Update Downloaded',
          'New update has been downloaded and is ready to apply. The app will restart.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restart Now', onPress: handleReload }
          ]
        );
      } else {
        Alert.alert('No New Update', 'The latest update was already cached.');
      }
      
      // Reload info after fetch
      await loadUpdateInfo();
    } catch (error) {
      console.error('[UpdateDebug] Fetch failed:', error);
      Alert.alert('Fetch Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFetching(false);
    }
  };

  const handleReload = async () => {
    try {
      console.log('[UpdateDebug] Reloading app...');
      await Updates.reloadAsync();
    } catch (error) {
      console.error('[UpdateDebug] Reload failed:', error);
      Alert.alert('Reload Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Don't render anything if not preview build
  if (!isPreview) {
    return null;
  }

  return (
    <>
      {/* Hidden trigger - triple tap on screen bottom-right corner */}
      <TouchableOpacity
        style={styles.hiddenTrigger}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      />

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              🔧 Update Debug Panel
            </Text>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
            {/* App Info */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>App Info</Text>
              <InfoRow label="App Version" value={Constants.expoConfig?.version || 'unknown'} theme={theme} />
              <InfoRow label="Platform" value={Platform.OS} theme={theme} />
              <InfoRow label="Environment" value={process.env.EXPO_PUBLIC_ENVIRONMENT || 'unknown'} theme={theme} />
              <InfoRow label="Updates Enabled" value={Updates.isEnabled ? 'Yes' : 'No'} theme={theme} />
            </View>

            {/* Update Info */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Update</Text>
              <InfoRow label="Update ID" value={updateInfo.updateId || 'embedded'} theme={theme} />
              <InfoRow label="Runtime Version" value={updateInfo.runtimeVersion || 'unknown'} theme={theme} />
              <InfoRow label="Channel" value={updateInfo.channel || 'unknown'} theme={theme} />
              <InfoRow 
                label="Emergency Launch" 
                value={updateInfo.isEmergencyLaunch ? 'Yes' : 'No'} 
                theme={theme} 
              />
              <InfoRow 
                label="Last Check" 
                value={updateInfo.lastCheckTime ? updateInfo.lastCheckTime.toLocaleString() : 'Never'} 
                theme={theme} 
              />
            </View>

            {/* Actions */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions</Text>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={handleCheckForUpdate}
                disabled={checking || fetching}
              >
                {checking ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="refresh" size={20} color="#ffffff" />
                )}
                <Text style={styles.actionButtonText}>
                  {checking ? 'Checking...' : 'Check for Update'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.secondary }]}
                onPress={handleFetchUpdate}
                disabled={checking || fetching}
              >
                {fetching ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="download" size={20} color="#ffffff" />
                )}
                <Text style={styles.actionButtonText}>
                  {fetching ? 'Fetching...' : 'Fetch Update'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                onPress={handleReload}
                disabled={checking || fetching}
              >
                <Ionicons name="reload" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Reload App</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.textSecondary }]}
                onPress={loadUpdateInfo}
                disabled={checking || fetching}
              >
                <Ionicons name="information" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Refresh Info</Text>
              </TouchableOpacity>
            </View>

            {/* Manifest (if available) */}
            {updateInfo.manifestString && (
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Manifest</Text>
                <ScrollView 
                  horizontal 
                  style={[styles.manifestContainer, { backgroundColor: theme.background }]}
                >
                  <Text style={[styles.manifestText, { color: theme.textSecondary }]}>
                    {updateInfo.manifestString}
                  </Text>
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Preview Build Only • Triple-tap bottom-right to open
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  theme: any;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, theme }) => (
  <View style={styles.infoRow}>
    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}:</Text>
    <Text style={[styles.infoValue, { color: theme.text }]} selectable>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  hiddenTrigger: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 120,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  manifestContainer: {
    maxHeight: 200,
    borderRadius: 8,
    padding: 12,
  },
  manifestText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});