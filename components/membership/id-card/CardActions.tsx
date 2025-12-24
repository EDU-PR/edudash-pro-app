/**
 * Card Actions Component
 * Print, Save PDF, Share actions for ID card
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IDCardActionsProps } from './types';

export function CardActions({ 
  member, 
  card,
  theme, 
  onPrint, 
  onSavePDF, 
  onShare, 
  isGeneratingPDF 
}: IDCardActionsProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: theme.card }]}
          onPress={onPrint}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <View style={[styles.actionIcon, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="print" size={24} color="#3B82F6" />
              </View>
              <Text style={[styles.actionLabel, { color: theme.text }]}>Print Card</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: theme.card }]}
          onPress={onSavePDF}
          disabled={isGeneratingPDF}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="download" size={24} color="#10B981" />
          </View>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Save PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: theme.card }]}
          onPress={onShare}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#F59E0B15' }]}>
            <Ionicons name="share-social" size={24} color="#F59E0B" />
          </View>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
