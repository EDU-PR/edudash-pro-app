/**
 * Organization Selection Step
 * First step of registration - selecting which organization to join
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  member_count?: number;
}

interface OrganizationStepProps {
  selectedOrgId: string | null;
  onSelectOrganization: (org: Organization) => void;
  theme: any;
  /** If an invite code was used, the org is pre-selected and locked */
  lockedOrganization?: Organization | null;
}

export function OrganizationStep({ 
  selectedOrgId, 
  onSelectOrganization, 
  theme,
  lockedOrganization,
}: OrganizationStepProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If organization is locked from invite, don't fetch others
    if (lockedOrganization) {
      setOrganizations([lockedOrganization]);
      setLoading(false);
      // Auto-select the locked organization
      onSelectOrganization(lockedOrganization);
      return;
    }

    fetchOrganizations();
  }, [lockedOrganization]);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = assertSupabase();

      // Fetch active organizations that allow member registration
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, description')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;

      // Fetch member counts for each organization
      const orgsWithCounts = await Promise.all(
        (orgsData || []).map(async (org) => {
          const { count } = await supabase
            .from('organization_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id);

          return {
            ...org,
            member_count: count || 0,
          };
        })
      );

      setOrganizations(orgsWithCounts);
    } catch (err: any) {
      console.error('[OrganizationStep] Error:', err);
      setError(err.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading organizations...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.error || '#EF4444'} />
        <Text style={[styles.errorText, { color: theme.error || '#EF4444' }]}>
          {error}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={fetchOrganizations}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If locked to a specific organization (via invite code)
  if (lockedOrganization) {
    return (
      <View style={styles.stepContent}>
        <View style={styles.lockedBanner}>
          <Ionicons name="link" size={20} color={theme.primary} />
          <Text style={[styles.lockedText, { color: theme.text }]}>
            You're joining via an invite link
          </Text>
        </View>
        
        <View style={[
          styles.orgCard,
          styles.lockedOrgCard,
          { 
            backgroundColor: theme.card,
            borderColor: theme.primary,
          }
        ]}>
          <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
          
          {lockedOrganization.logo_url ? (
            <Image 
              source={{ uri: lockedOrganization.logo_url }} 
              style={styles.orgLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.orgLogoPlaceholder, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="business" size={32} color={theme.primary} />
            </View>
          )}
          
          <Text style={[styles.orgName, { color: theme.text }]}>
            {lockedOrganization.name}
          </Text>
          
          {lockedOrganization.description && (
            <Text style={[styles.orgDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {lockedOrganization.description}
            </Text>
          )}
          
          {lockedOrganization.member_count !== undefined && (
            <Text style={[styles.orgMembers, { color: theme.textSecondary }]}>
              {lockedOrganization.member_count.toLocaleString()} members
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Organization</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Choose the organization you want to join
      </Text>
      
      <View style={styles.orgGrid}>
        {organizations.map(org => (
          <TouchableOpacity
            key={org.id}
            style={[
              styles.orgCard,
              { 
                backgroundColor: theme.card,
                borderColor: selectedOrgId === org.id ? theme.primary : theme.border,
                borderWidth: selectedOrgId === org.id ? 2 : 1,
              }
            ]}
            onPress={() => onSelectOrganization(org)}
          >
            {selectedOrgId === org.id && (
              <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            )}
            
            {org.logo_url ? (
              <Image 
                source={{ uri: org.logo_url }} 
                style={styles.orgLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.orgLogoPlaceholder, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="business" size={32} color={theme.primary} />
              </View>
            )}
            
            <Text style={[styles.orgName, { color: theme.text }]} numberOfLines={2}>
              {org.name}
            </Text>
            
            {org.description && (
              <Text style={[styles.orgDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                {org.description}
              </Text>
            )}
            
            {org.member_count !== undefined && (
              <Text style={[styles.orgMembers, { color: theme.textSecondary }]}>
                {org.member_count.toLocaleString()} members
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  stepContent: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  orgGrid: {
    gap: 12,
  },
  orgCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    alignItems: 'center',
  },
  lockedOrgCard: {
    borderWidth: 2,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 12,
  },
  orgLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  orgDescription: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  orgMembers: {
    fontSize: 12,
    fontWeight: '500',
  },
});
