import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { useUpdates } from '@/contexts/UpdatesProvider';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UpdateDebugScreen() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string>('');
  const { checkForUpdates, isDownloading, isUpdateDownloaded, updateError } = useUpdates();

  const handleCheckUpdates = async () => {
    setChecking(true);
    setResult('Checking...');
    try {
      const hasUpdate = await checkForUpdates();
      setResult(hasUpdate ? '✅ Update available!' : 'No updates available');
    } catch (error) {
      setResult(`❌ Error: ${error}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>OTA Update Debug</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Build Info</Text>
          <Text style={styles.info}>App Version: {Constants.expoConfig?.version}</Text>
          <Text style={styles.info}>Runtime Version: {Updates.runtimeVersion}</Text>
          <Text style={styles.info}>Update ID: {Updates.updateId || 'None (dev build)'}</Text>
          <Text style={styles.info}>Channel: {Updates.channel || 'None'}</Text>
          <Text style={styles.info}>Created At: {Updates.createdAt?.toISOString() || 'N/A'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update Status</Text>
          <Text style={styles.info}>Updates Enabled: {Updates.isEnabled ? '✅ Yes' : '❌ No (dev build)'}</Text>
          <Text style={styles.info}>Dev Mode: {__DEV__ ? '⚠️ Yes' : '✅ No'}</Text>
          <Text style={styles.info}>OTA Enabled (env): {process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES}</Text>
          <Text style={styles.info}>Is Downloading: {isDownloading ? 'Yes' : 'No'}</Text>
          <Text style={styles.info}>Update Downloaded: {isUpdateDownloaded ? 'Yes' : 'No'}</Text>
          {updateError && <Text style={styles.error}>Error: {updateError}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Check</Text>
          <TouchableOpacity 
            style={[styles.button, checking && styles.buttonDisabled]} 
            onPress={handleCheckUpdates}
            disabled={checking}
          >
            <Text style={styles.buttonText}>
              {checking ? 'Checking...' : 'Check for Updates'}
            </Text>
          </TouchableOpacity>
          {result ? <Text style={styles.result}>{result}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.infoText}>
            • If "Updates Enabled" is NO, you're running a development build{'\n'}
            • Development builds cannot receive OTA updates{'\n'}
            • You need a preview or production build{'\n'}
            • Build with: eas build --profile preview --platform android{'\n'}
            • Or use expo-dev-client for updates in dev builds
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4ade80',
    marginBottom: 12,
  },
  info: {
    fontSize: 14,
    color: '#e5e5e5',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  infoText: {
    fontSize: 14,
    color: '#a3a3a3',
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#374151',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  result: {
    fontSize: 16,
    color: '#4ade80',
    textAlign: 'center',
    marginTop: 8,
  },
});
