// 🔐 Organization Selection Step Component
// Handles school/organization selection for parent registration

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { RegistrationFormState, PublicOrganization, COMMUNITY_SCHOOL_ID } from '../../../hooks/useEnhancedRegistration';
import { registrationStepStyles as styles } from './styles';

interface StepTheme {
  colors: {
    background: string;
    onBackground: string;
    surface: string;
    surfaceVariant: string;
    outline: string;
    error: string;
    onSurface: string;
    onSurfaceVariant: string;
    primary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
  };
  typography: {
    body1: { fontSize: number };
    titleLarge: { fontSize: number; fontWeight?: string | number };
  };
}

interface OrganizationSelectionStepProps {
  theme: StepTheme;
  formState: RegistrationFormState;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  loading: boolean;
  loadingOrganizations: boolean;
  organizationError: string | null;
  organizations: PublicOrganization[];
  onFieldChange: (fieldName: keyof RegistrationFormState, value: any) => void;
}

export const OrganizationSelectionStep: React.FC<OrganizationSelectionStepProps> = ({
  theme,
  formState,
  errors,
  touched,
  loading,
  loadingOrganizations,
  organizationError,
  organizations,
  onFieldChange
}) => {
  const getOrgTypeLabel = (org: PublicOrganization): string => {
    const typeMap: Record<string, string> = {
      'preschool': '🏫 Preschool',
      'primary': '📚 Primary School',
      'secondary': '🎓 Secondary School',
      'k12': '🎓 K-12 School',
      'combined': '🏫 Combined School',
      'community_school': '🏠 Community School',
      'training_center': '📚 Training Center',
    };
    return typeMap[org.school_type || 'preschool'] || '📍 School';
  };

  return (
    <View style={styles.stepContent}>
      <Text style={[
        styles.stepTitle,
        { 
          color: theme.colors.onBackground,
          fontSize: theme.typography.titleLarge.fontSize,
          fontWeight: theme.typography.titleLarge.fontWeight as any
        }
      ]}>
        Select Your Child's School
      </Text>
      
      <Text style={[
        styles.stepDescription,
        { 
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.typography.body1.fontSize
        }
      ]}>
        Choose the school your child attends. If not listed, select EduDash Pro Community School.
      </Text>

      {loadingOrganizations ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
            Loading schools...
          </Text>
        </View>
      ) : organizationError ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error, textAlign: 'center' }]}>
            {organizationError}
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled
        >
          {organizations.map(org => {
            const isSelected = formState.selectedOrganizationId === org.id;
            const isCommunitySchool = org.id === COMMUNITY_SCHOOL_ID;
            
            return (
              <TouchableOpacity
                key={org.id}
                style={[
                  styles.orgOption,
                  {
                    backgroundColor: isSelected 
                      ? theme.colors.primaryContainer 
                      : theme.colors.surface,
                    borderColor: isSelected 
                      ? theme.colors.primary 
                      : theme.colors.outline,
                    borderWidth: isCommunitySchool ? 2 : 1,
                  }
                ]}
                onPress={() => onFieldChange('selectedOrganizationId', org.id)}
                disabled={loading}
              >
                <View style={styles.orgContent}>
                  <View style={styles.orgHeader}>
                    <Text style={[
                      styles.orgName,
                      { 
                        color: isSelected 
                          ? theme.colors.onPrimaryContainer 
                          : theme.colors.onSurface,
                      }
                    ]}>
                      {org.name}
                    </Text>
                    {isSelected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <View style={styles.orgMeta}>
                    <Text style={{ 
                      color: isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant, 
                      fontSize: 12 
                    }}>
                      {getOrgTypeLabel(org)}
                    </Text>
                    {org.city && (
                      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                        📍 {org.city}
                      </Text>
                    )}
                    {isCommunitySchool && (
                      <Text style={[
                        styles.defaultBadge,
                        { 
                          color: theme.colors.primary, 
                          backgroundColor: theme.colors.primaryContainer,
                        }
                      ]}>
                        Default
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      
      {errors.selectedOrganizationId && touched.selectedOrganizationId && (
        <Text style={[styles.errorText, { color: theme.colors.error, marginTop: 8 }]}>
          {errors.selectedOrganizationId[0]}
        </Text>
      )}
      
            <View style={[styles.helpBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>
          💡 Don't see your school? Select "EduDash Pro Community School" and you can request to join a specific school later.
        </Text>
      </View>
    </View>
  );
};

export default OrganizationSelectionStep;
