/**
 * Message Status Ticks Component
 * WhatsApp-style delivery status indicators
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import type { MessageStatus } from './types';

interface MessageTicksProps {
  status: MessageStatus;
}

export const MessageTicks: React.FC<MessageTicksProps> = ({ status }) => {
  if (status === 'sending') {
    return <Text style={styles.sending}>○</Text>;
  }
  if (status === 'sent') {
    return <Text style={styles.sent}>✓</Text>;
  }
  if (status === 'delivered') {
    return <Text style={styles.delivered}>✓✓</Text>;
  }
  // Read - green ticks like WhatsApp
  return <Text style={styles.read}>✓✓</Text>;
};

const styles = StyleSheet.create({
  sending: { 
    fontSize: 12, 
    color: 'rgba(255, 255, 255, 0.4)' 
  },
  sent: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.6)', 
    fontWeight: '500' 
  },
  delivered: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.6)', 
    fontWeight: '500', 
    letterSpacing: -3 
  },
  read: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#34d399', 
    letterSpacing: -3 
  },
});
