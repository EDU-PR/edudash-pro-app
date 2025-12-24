/**
 * Region Selection Step
 * First step of registration - selecting province
 * Now fetches real data from database
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrganizationRegions } from '@/hooks/membership';
import type { RegionConfig } from './constants';
import type { RegistrationData } from './types';

interface RegionStepProps {
  data: RegistrationData;
  onSelectRegion: (region: RegionConfig) => void;
  theme: any;
}

export function RegionStep({ data, onSelectRegion, theme }: RegionStepProps) {
  const { regions, loading, error } = useOrganizationRegions({ soilOfAfrica: true });

  // Transform database regions to RegionConfig format
  const regionConfigs: RegionConfig[] = regions.map(r => ({
    id: r.id,
    name: r.name,
    code: r.province_code || r.code,
    members: r.member_count,
  }));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading regions...
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
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Your Region</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Choose the province where you'll be based
      </Text>
      
      <View style={styles.regionGrid}>
        {regionConfigs.map(region => (
          <TouchableOpacity
            key={region.id}
            style={[
              styles.regionCard,
              { 
                backgroundColor: theme.card,
                borderColor: data.region_id === region.id ? theme.primary : theme.border,
                borderWidth: data.region_id === region.id ? 2 : 1,
              }
            ]}
            onPress={() => onSelectRegion(region)}
          >
            {data.region_id === region.id && (
              <View style={[styles.regionCheck, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
            <Text style={[styles.regionCode, { color: theme.primary }]}>{region.code}</Text>
            <Text style={[styles.regionName, { color: theme.text }]}>{region.name}</Text>
            <Text style={[styles.regionMembers, { color: theme.textSecondary }]}>
              {region.members} members
            </Text>
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
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  regionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
  },
  regionCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionCode: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  regionName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  regionMembers: {
    fontSize: 12,
  },
});
