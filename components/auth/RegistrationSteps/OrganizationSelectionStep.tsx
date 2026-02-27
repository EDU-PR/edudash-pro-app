// 🔐 Organization Selection Step Component
// Handles school/organization selection for parent registration

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { RegistrationFormState, PublicOrganization, COMMUNITY_SCHOOL_ID } from '../../../hooks/useEnhancedRegistration';
import { registrationStepStyles as styles } from './styles';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
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
  const [searchQuery, setSearchQuery] = React.useState('');

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

  const selectedOrganization = React.useMemo(
    () => organizations.find(org => org.id === formState.selectedOrganizationId),
    [organizations, formState.selectedOrganizationId]
  );

  const filteredOrganizations = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return organizations;

    return organizations.filter(org => {
      const fields = [org.name, org.city, org.school_type, getOrgTypeLabel(org)];
      return fields.some(field => (field || '').toLowerCase().includes(normalizedQuery));
    });
  }, [organizations, searchQuery]);

  const hasCommunitySchool = organizations.some(org => org.id === COMMUNITY_SCHOOL_ID);

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
        Search and select your child&apos;s school to continue. You can still choose EduDash Pro Community School if needed.
      </Text>

      {selectedOrganization ? (
        <View style={[styles.helpBox, { backgroundColor: theme.colors.primaryContainer, marginTop: 0 }]}>
          <Text style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
            Selected school: {selectedOrganization.name}
          </Text>
        </View>
      ) : (
        <View style={[styles.warningBox, { backgroundColor: theme.colors.surfaceVariant, marginTop: 0 }]}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
            Select a school before moving to the next step.
          </Text>
        </View>
      )}

      {loadingOrganizations ? (
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
            Loading schools...
          </Text>
        </View>
      ) : (
        <>
          {organizationError ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.colors.error, textAlign: 'center' }]}>
                {organizationError}
              </Text>
            </View>
          ) : null}

          <TextInput
            style={[
              styles.textInput,
              {
                borderColor: theme.colors.outline,
                color: theme.colors.onSurface,
                backgroundColor: theme.colors.surface,
                marginTop: 12,
              },
            ]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search school by name or city"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <View style={styles.row}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 10, flex: 1 }}>
              Showing {filteredOrganizations.length} of {organizations.length} active schools
            </Text>
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 10, fontWeight: '600' }}>
                  Clear
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {filteredOrganizations.length === 0 ? (
            <View style={[styles.helpBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>
                No schools matched your search.
              </Text>
              {hasCommunitySchool ? (
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      borderColor: theme.colors.primary,
                      alignSelf: 'center',
                      marginTop: 10,
                    },
                  ]}
                  onPress={() => onFieldChange('selectedOrganizationId', COMMUNITY_SCHOOL_ID)}
                  disabled={loading}
                >
                  <Text style={[styles.selectOptionText, { color: theme.colors.primary }]}>
                    Use EduDash Pro Community School
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {filteredOrganizations.map(org => {
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
                      },
                    ]}
                    onPress={() => onFieldChange('selectedOrganizationId', org.id)}
                    disabled={loading}
                  >
                    <View style={styles.orgContent}>
                      <View style={styles.orgHeader}>
                        <Text
                          style={[
                            styles.orgName,
                            {
                              color: isSelected
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurface,
                            },
                          ]}
                        >
                          {org.name}
                        </Text>
                        {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <View style={styles.orgMeta}>
                        <Text style={{
                          color: isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant,
                          fontSize: 12,
                        }}>
                          {getOrgTypeLabel(org)}
                        </Text>
                        {org.city ? (
                          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                            📍 {org.city}
                          </Text>
                        ) : null}
                        {isCommunitySchool ? (
                          <Text
                            style={[
                              styles.defaultBadge,
                              {
                                color: theme.colors.primary,
                                backgroundColor: theme.colors.primaryContainer,
                              },
                            ]}
                          >
                            Community fallback
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
      
      {errors.selectedOrganizationId && touched.selectedOrganizationId && (
        <Text style={[styles.errorText, { color: theme.colors.error, marginTop: 8 }]}>
          {errors.selectedOrganizationId[0]}
        </Text>
      )}
      
      <View style={[styles.helpBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>
          💡 Tip: If your school is not listed yet, select EduDash Pro Community School and ask your school admin to publish the school profile.
        </Text>
      </View>
    </View>
  );
};

export default OrganizationSelectionStep;
