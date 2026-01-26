import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export interface ChildSwitcherProps {
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  }>;
  activeChildId: string | null;
  onChildChange: (childId: string) => void;
}

export const ChildSwitcher: React.FC<ChildSwitcherProps> = ({ 
  children, 
  activeChildId, 
  onChildChange 
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (children.length === 0) return null;

  const getInitials = (firstName: string, lastName: string) => {
    const firstInitial = firstName?.trim().charAt(0) ?? '';
    const lastInitial = lastName?.trim().charAt(0) ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || '?';
  };

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }}>
      <Text style={{
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 12,
      }}>{t('parent.selectChild')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {children.map((child) => {
            const isActive = child.id === activeChildId;
            return (
              <TouchableOpacity
                key={child.id}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isActive ? theme.primary : theme.elevated,
                  borderWidth: isActive ? 0 : 1,
                  borderColor: theme.border,
                }}
                onPress={() => onChildChange(child.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {child.avatarUrl ? (
                    <Image
                      source={{ uri: child.avatarUrl }}
                      style={{ width: 24, height: 24, borderRadius: 12 }}
                    />
                  ) : (
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: isActive ? theme.onPrimary + '30' : theme.primary + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? theme.onPrimary : theme.primary }}>
                        {getInitials(child.firstName, child.lastName)}
                      </Text>
                    </View>
                  )}
                  <Text style={{
                    fontSize: 14,
                    fontWeight: isActive ? '600' : '500',
                    color: isActive ? theme.onPrimary : theme.text,
                  }}>
                    {child.firstName} {child.lastName}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => router.push('/screens/parent-children')}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: theme.elevated,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
              {t('common.viewAll')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
