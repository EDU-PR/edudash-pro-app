import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Safe icon component that handles potential undefined icons
const SafeIcon = ({ name, size, color, fallback = "●" }: { 
  name: any; 
  size?: number; 
  color?: string; 
  fallback?: string 
}) => {
  if (Ionicons && typeof Ionicons === 'function') {
    try {
      return <Ionicons name={name} size={size} color={color} />;
    } catch (error) {
      console.warn('Icon rendering error:', error);
    }
  }
  return <Text style={{ fontSize: size, color }}>{fallback}</Text>;
};

export const IconTest = () => {
  return (
    <View style={{ padding: 20, flexDirection: 'row', gap: 10 }}>
      <SafeIcon name="camera" size={24} color="#000" fallback="📷" />
      <SafeIcon name="person-outline" size={24} color="#000" fallback="👤" />
      <SafeIcon name="mail-outline" size={24} color="#000" fallback="✉️" />
      <SafeIcon name="log-out-outline" size={24} color="#000" fallback="🚪" />
    </View>
  );
};

export default IconTest;