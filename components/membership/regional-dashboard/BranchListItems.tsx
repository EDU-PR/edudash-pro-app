/**
 * Branch List Item Component
 * Simple branch list items (alternative to BranchPerformanceList)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface SimpleBranch {
  id: string;
  name: string;
  members: number;
  status: string;
  manager?: string;
}

interface BranchListItemsProps {
  branches: SimpleBranch[];
  theme: any;
  maxItems?: number;
}

export function BranchListItems({ branches, theme, maxItems = 5 }: BranchListItemsProps) {
  return (
    <View style={styles.container}>
      {branches.slice(0, maxItems).map((branch) => (
        <TouchableOpacity 
          key={branch.id}
          style={[styles.branchCard, { backgroundColor: theme.card }]}
          onPress={() => router.push(`/screens/membership/branch-detail?id=${branch.id}`)}
        >
          <View style={styles.branchLeft}>
            <View style={[styles.branchIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="business" size={20} color="#10B981" />
            </View>
            <View style={styles.branchInfo}>
              <Text style={[styles.branchName, { color: theme.text }]}>{branch.name}</Text>
              {branch.manager && (
                <Text style={[styles.branchManager, { color: theme.textSecondary }]}>
                  Manager: {branch.manager}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.branchRight}>
            <Text style={[styles.branchMembers, { color: theme.text }]}>{branch.members}</Text>
            <Text style={[styles.branchMembersLabel, { color: theme.textSecondary }]}>members</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
  },
  branchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  branchIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 15,
    fontWeight: '600',
  },
  branchManager: {
    fontSize: 12,
    marginTop: 2,
  },
  branchRight: {
    alignItems: 'flex-end',
  },
  branchMembers: {
    fontSize: 18,
    fontWeight: '700',
  },
  branchMembersLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
