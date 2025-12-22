/**
 * Empty State Component for Campaigns
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  theme: any;
  onCreateCampaign: () => void;
}

export function EmptyState({ theme, onCreateCampaign }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="megaphone-outline" size={64} color={theme.muted} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No Campaigns Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
        Create your first marketing campaign to attract more enrollments
      </Text>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={onCreateCampaign}
      >
        <Ionicons name="add" size={20} color="#ffffff" />
        <Text style={styles.createButtonText}>Create Campaign</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
