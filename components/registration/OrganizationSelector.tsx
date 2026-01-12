import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createRegistrationStyles } from './child-registration.styles';
import type { Organization, RegistrationFormErrors } from '@/hooks/useChildRegistration';

interface OrganizationSelectorProps {
  organizations: Organization[];
  loadingOrganizations: boolean;
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string | null) => void;
  errors: RegistrationFormErrors;
  clearError: (field: keyof RegistrationFormErrors) => void;
}

export function OrganizationSelector({
  organizations,
  loadingOrganizations,
  selectedOrganizationId,
  setSelectedOrganizationId,
  errors,
  clearError,
}: OrganizationSelectorProps) {
  const { theme } = useTheme();
  const styles = createRegistrationStyles(theme);

  const getOrgTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      'preschool': '🏫 Preschool',
      'k12_school': '🎓 K-12 School',
      'training_center': '📚 Training Center',
      'tutoring_center': '✏️ Tutoring Center',
      'skills_development': '🛠️ Skills Development'
    };
    return typeMap[type] || `📍 ${type}`;
  };

  return (
    <>
      <Text style={[styles.label, { marginTop: 12 }]}>Select Organization *</Text>
      <Text style={styles.hint}>Choose the school or organization you want to register your child at</Text>
      
      {loadingOrganizations ? (
        <View style={[styles.organizationContainer, { paddingVertical: 20 }]}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>
            Loading organizations...
          </Text>
        </View>
      ) : organizations.length === 0 ? (
        <View style={[styles.organizationContainer, { paddingVertical: 30 }]}>
          <Ionicons name="school-outline" size={48} color={theme.textSecondary} style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
            No organizations available
          </Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14, marginTop: 4 }}>
            Please contact support
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.organizationScrollContainer} nestedScrollEnabled>
          {organizations.map((org) => {
            const isSelected = selectedOrganizationId === org.id;
            
            return (
              <TouchableOpacity
                key={org.id}
                style={[
                  styles.organizationOption,
                  isSelected && styles.organizationOptionActive,
                ]}
                onPress={() => {
                  setSelectedOrganizationId(org.id);
                  clearError('organization');
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.organizationName,
                    isSelected && styles.organizationNameActive,
                  ]}>
                    {org.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ color: isSelected ? theme.primary : theme.textSecondary, fontSize: 12 }}>
                      {getOrgTypeLabel(org.type)}
                    </Text>
                    {org.city && (
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        📍 {org.city}
                      </Text>
                    )}
                    {org.tenant_slug && (
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        @{org.tenant_slug}
                      </Text>
                    )}
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      {errors.organization ? <Text style={styles.error}>{errors.organization}</Text> : null}
    </>
  );
}
