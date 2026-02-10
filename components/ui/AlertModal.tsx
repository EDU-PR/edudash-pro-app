/**
 * AlertModal Component
 * 
 * Modern, visually appealing modal that replaces React Native's Alert.alert()
 * Features: Custom styling, theme support, icons, smooth animations, multiple buttons
 * 
 * Supports both confirmation (2 buttons) and info (1 button) modes
 */

import React, { useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export interface AlertButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  buttons?: AlertButton[];
  onClose: () => void;
  type?: 'info' | 'warning' | 'success' | 'error';
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  icon,
  iconColor,
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
  type = 'info',
}) => {
  const { theme } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, scaleAnim]);

  const getTypeColor = useCallback(() => {
    switch (type) {
      case 'success': return theme.success || '#10B981';
      case 'error': return theme.error || '#EF4444';
      case 'warning': return theme.warning || '#F59E0B';
      default: return theme.primary;
    }
  }, [type, theme]);

  const getTypeIcon = useCallback((): keyof typeof Ionicons.glyphMap => {
    if (icon) return icon;
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'alert-circle';
      default: return 'information-circle';
    }
  }, [type, icon]);

  const finalIconColor = iconColor || getTypeColor();

  const handleButtonPress = async (button: AlertButton) => {
    onClose();
    try {
      await button.onPress?.();
    } catch (error) {
      console.error('[AlertModal] Button action failed:', error);
    }
  };

  const getButtonStyle = (button: AlertButton, index: number) => {
    const isCancel = button.style === 'cancel';
    const isDestructive = button.style === 'destructive';
    const isPrimary = !isCancel && !isDestructive && index === buttons.length - 1;

    if (isCancel) {
      return {
        backgroundColor: theme.error || '#DC2626',
        borderColor: theme.error || '#DC2626',
      };
    }
    if (isDestructive) {
      return {
        backgroundColor: theme.error || '#EF4444',
        borderColor: theme.error || '#EF4444',
      };
    }
    if (isPrimary) {
      return {
        backgroundColor: getTypeColor(),
        borderColor: getTypeColor(),
      };
    }
    return {
      backgroundColor: theme.surface,
      borderColor: theme.border,
    };
  };

  const getButtonTextColor = (button: AlertButton, index: number) => {
    const isCancel = button.style === 'cancel';
    const isDestructive = button.style === 'destructive';
    const isPrimary = !isCancel && !isDestructive && index === buttons.length - 1;

    if (isCancel || isDestructive || isPrimary) return '#FFFFFF';
    return theme.text;
  };

  // Sort buttons: cancel LAST (at bottom), others first
  const sortedButtons = [...buttons].sort((a, b) => {
    if (a.style === 'cancel') return 1;
    if (b.style === 'cancel') return -1;
    return 0;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: finalIconColor + '15' }]}>
            <Ionicons name={getTypeIcon()} size={56} color={finalIconColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          {/* Message */}
          {message && (
            <ScrollView style={styles.messageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={[
            buttons.length >= 4 ? styles.buttonContainerVertical : styles.buttonContainer,
            buttons.length === 1 && styles.singleButtonContainer
          ]}>
            {sortedButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  buttons.length === 1 && styles.singleButton,
                  buttons.length >= 4 && styles.buttonFullWidth,
                  getButtonStyle(button, index),
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: getButtonTextColor(button, index) },
                    button.style !== 'cancel' && styles.primaryButtonText,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Hook for easier Alert replacement
interface UseAlertModalReturn {
  showAlert: (config: Omit<AlertModalProps, 'visible' | 'onClose'>) => void;
  hideAlert: () => void;
  AlertModalComponent: React.FC;
  alertProps: AlertModalProps;
}

export const useAlertModal = (): UseAlertModalReturn => {
  const [alertProps, setAlertProps] = React.useState<AlertModalProps>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    onClose: () => {},
  });

  const showAlert = useCallback((config: Omit<AlertModalProps, 'visible' | 'onClose'>) => {
    setAlertProps({
      ...config,
      visible: true,
      onClose: () => setAlertProps(prev => ({ ...prev, visible: false })),
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertProps(prev => ({ ...prev, visible: false }));
  }, []);

  const AlertModalComponent: React.FC = useCallback(() => (
    <AlertModal {...alertProps} />
  ), [alertProps]);

  return { showAlert, hideAlert, AlertModalComponent, alertProps };
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  messageScroll: {
    maxHeight: 150,
    marginBottom: 28,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  singleButtonContainer: {
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  buttonFullWidth: {
    flex: 0,
    width: '100%',
  },
  singleButton: {
    flex: 0,
    minWidth: 140,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    fontWeight: '700',
  },
});

export default AlertModal;
