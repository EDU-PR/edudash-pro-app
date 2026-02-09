/**
 * Claim Child Screen
 *
 * Parent searches for their child and submits a link request to the school.
 *
 * State/handlers extracted → hooks/useClaimChild.ts
 * Styles extracted → parent-claim-child.styles.ts
 */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useClaimChild } from '@/hooks/useClaimChild';
import { claimChildStyles as styles } from '@/lib/screen-styles/parent-claim-child.styles';

export default function ParentClaimChildScreen() {
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const h = useClaimChild(showAlert);

  const renderSearchStep = () => (
    <>
      {!h.preschoolId && (
        <View style={[styles.helpCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="school" size={24} color={theme.primary} />
          <View style={styles.helpContent}>
            <Text style={[styles.helpTitle, { color: theme.text }]}>Link your school first</Text>
            <Text style={[styles.helpText, { color: theme.textSecondary }]}>Enter your school's invitation code to link your account, then search for your child.</Text>
            <TouchableOpacity style={[styles.linkButton, { backgroundColor: theme.background }]} onPress={() => router.push('/screens/parent-join-by-code')}>
              <Text style={[styles.linkButtonText, { color: theme.primary }]}>Join School by Code</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Find Your Child</Text>
        <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Search by name to find your child in our system</Text>

        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Enter child's name..." placeholderTextColor={theme.textSecondary} value={h.searchQuery} onChangeText={h.setSearchQuery} onSubmitEditing={() => h.handleSearch()} autoCapitalize="words" returnKeyType="search" />
          </View>
          <TouchableOpacity style={[styles.searchButton, { backgroundColor: theme.primary }]} onPress={() => h.handleSearch()} disabled={h.searching || !h.searchQuery.trim()}>
            {h.searching ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.searchButtonText}>Search</Text>}
          </TouchableOpacity>
        </View>

        {h.searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={[styles.resultsTitle, { color: theme.text }]}>{h.searchResults.length} {h.searchResults.length === 1 ? 'child' : 'children'} found</Text>
            {h.searchResults.map(child => (
              <TouchableOpacity key={child.id} style={[styles.resultItem, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => h.handleSelectChild(child)}>
                <View style={styles.resultContent}>
                  <Text style={[styles.childName, { color: theme.text }]}>{child.first_name} {child.last_name}</Text>
                  <View style={styles.childDetails}>
                    <Text style={[styles.childDetail, { color: theme.textSecondary }]}>🎂 Age {h.calculateAge(child.date_of_birth)}</Text>
                    {child.age_group && <Text style={[styles.childDetail, { color: theme.textSecondary }]}>🎓 {child.age_group.name}</Text>}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="information-circle" size={24} color={theme.primary} />
        <View style={styles.helpContent}>
          <Text style={[styles.helpTitle, { color: theme.text }]}>Can't find your child?</Text>
          <Text style={[styles.helpText, { color: theme.textSecondary }]}>If your child isn't enrolled yet, you can register them as a new student.</Text>
          <TouchableOpacity style={[styles.linkButton, { backgroundColor: theme.background }]} onPress={() => router.push('/screens/parent-child-registration')}>
            <Text style={[styles.linkButtonText, { color: theme.primary }]}>Register New Child</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderConfirmStep = () => {
    if (!h.selectedChild) return null;
    return (
      <>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Confirm Child Details</Text>
          <View style={styles.confirmDetails}>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.textSecondary }]}>📝 Child Name:</Text><Text style={[styles.detailValue, { color: theme.text }]}>{h.selectedChild.first_name} {h.selectedChild.last_name}</Text></View>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.textSecondary }]}>🎂 Age:</Text><Text style={[styles.detailValue, { color: theme.text }]}>{h.calculateAge(h.selectedChild.date_of_birth)} years old</Text></View>
            {h.selectedChild.age_group && <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.textSecondary }]}>🎓 Class:</Text><Text style={[styles.detailValue, { color: theme.text }]}>{h.selectedChild.age_group.name}</Text></View>}
          </View>
          <View style={[styles.warningBox, { backgroundColor: `${theme.primary}15`, borderColor: theme.primary }]}>
            <Ionicons name="alert-circle" size={20} color={theme.primary} />
            <Text style={[styles.warningText, { color: theme.text }]}>Your request will be sent to the school for verification before access is granted.</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Your Relationship *</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>How are you related to this child?</Text>
          <View style={styles.relationshipGrid}>
            {(['mother', 'father', 'guardian', 'other'] as const).map(rel => (
              <TouchableOpacity key={rel} style={[styles.relationshipButton, { backgroundColor: theme.background, borderColor: theme.border }, h.relationship === rel && { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }]} onPress={() => h.setRelationship(rel)}>
                <Text style={[styles.relationshipText, { color: theme.textSecondary }, h.relationship === rel && { color: theme.primary, fontWeight: '600' }]}>{rel.charAt(0).toUpperCase() + rel.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => h.setStep('search')} disabled={h.submitting}>
            <Ionicons name="arrow-back" size={20} color={theme.text} /><Text style={[styles.backButtonText, { color: theme.text }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={h.handleSubmit} disabled={h.submitting}>
            {h.submitting ? <EduDashSpinner size="small" color="#fff" /> : <><Text style={styles.submitButtonText}>Submit Request</Text><Ionicons name="checkmark-circle" size={20} color="#fff" /></>}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: h.step === 'search' ? 'Claim Your Child' : 'Confirm Details', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.primary, headerShadowVisible: false }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {h.step === 'search' ? renderSearchStep() : renderConfirmStep()}
      </ScrollView>
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}
