import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import EduDashProLoader from '@/components/ui/EduDashProLoader';

const STUCK_THRESHOLD_MS = 12000;

type GlobalLoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export default function GlobalLoadingOverlay({ visible, message }: GlobalLoadingOverlayProps) {
  const { theme } = useTheme();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStuck(false);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const ms = Date.now() - start;
      if (Platform.OS === 'web' && ms >= STUCK_THRESHOLD_MS) {
        setStuck(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const handleRefresh = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <View style={[styles.overlay, { backgroundColor: theme.modalOverlay || 'rgba(0,0,0,0.45)' }]}>
      <View style={styles.loaderCard}>
        {stuck && Platform.OS === 'web' ? (
          <View style={styles.stuckCard}>
            <Text style={[styles.stuckTitle, { color: theme.text }]}>Taking longer than usual?</Text>
            <Text style={[styles.stuckSubtext, { color: theme.textSecondary }]}>
              The app may be stuck loading. Try refreshing the page.
            </Text>
            <TouchableOpacity
              style={[styles.refreshBtn, { backgroundColor: theme.primary }]}
              onPress={handleRefresh}
            >
              <Text style={styles.refreshBtnText}>Refresh page</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <EduDashProLoader
            message={message || 'Loading...'}
            fullScreen={false}
            variant="default"
            showIcon
            showSpinner
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCard: {
    width: '88%',
    maxWidth: 380,
  },
  stuckCard: {
    padding: 24,
    alignItems: 'center',
  },
  stuckTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  stuckSubtext: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  refreshBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
