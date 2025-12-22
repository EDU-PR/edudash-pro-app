/**
 * Reply Preview Component
 * Shows quoted message when replying
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Message } from './types';

interface ReplyPreviewProps {
  message: Message;
  onClose: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onClose }) => (
  <View style={styles.container}>
    <View style={styles.content}>
      <Text style={styles.label}>
        Replying to {message.sender?.first_name || 'message'}
      </Text>
      <Text numberOfLines={1} style={styles.text}>
        {message.content}
      </Text>
    </View>
    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
      <Ionicons name="close" size={20} color="#64748b" />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  content: { 
    flex: 1 
  },
  label: { 
    fontSize: 12, 
    color: '#3b82f6', 
    fontWeight: '600', 
    marginBottom: 2 
  },
  text: { 
    fontSize: 13, 
    color: '#94a3b8' 
  },
  closeBtn: { 
    padding: 4 
  },
});
