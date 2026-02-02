import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashProLoader from '@/components/ui/EduDashProLoader';

type GlobalLoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export default function GlobalLoadingOverlay({ visible, message }: GlobalLoadingOverlayProps) {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: theme.modalOverlay || 'rgba(0,0,0,0.45)' }]}>
      <View style={styles.loaderCard}>
        <EduDashProLoader
          message={message || 'Loading...'}
          fullScreen={false}
          variant="default"
          showIcon
          showSpinner
        />
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
});
