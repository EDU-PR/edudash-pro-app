/**
 * RegionalLeaderboard Component
 * 
 * Shows member counts from all regions for healthy competition.
 * Highlights the current user's region.
 * Only shows aggregated numbers, no personal data.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PROVINCE_COLORS } from './types';
import type { RegionMemberCounts } from '@/hooks/useRegionalDashboard';

interface RegionalLeaderboardProps {
  regions: RegionMemberCounts[];
  currentRegionId: string | null;
  theme: any;
  maxVisible?: number;
  onViewAll?: () => void;
}

export function RegionalLeaderboard({
  regions,
  currentRegionId,
  theme,
  maxVisible = 5,
  onViewAll,
}: RegionalLeaderboardProps) {
  const visibleRegions = regions.slice(0, maxVisible);
  const currentRegionRank = regions.findIndex(r => r.regionId === currentRegionId) + 1;
  const currentRegion = regions.find(r => r.regionId === currentRegionId);

  // If current region is not in visible list, we'll show it separately
  const showCurrentRegionSeparately = currentRegionRank > maxVisible && currentRegion;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={20} color="#F59E0B" />
          <Text style={[styles.title, { color: theme.text }]}>Regional Standings</Text>
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={[styles.viewAll, { color: theme.primary }]}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Leaderboard List */}
      <View style={styles.list}>
        {visibleRegions.map((region, index) => {
          const isCurrentRegion = region.regionId === currentRegionId;
          const rank = index + 1;
          const provinceConfig = PROVINCE_COLORS[region.regionName] || { primary: '#6B7280', code: '??' };
          
          return (
            <View
              key={region.regionId}
              style={[
                styles.regionRow,
                isCurrentRegion && styles.currentRegionRow,
                isCurrentRegion && { borderColor: provinceConfig.primary },
              ]}
            >
              {/* Rank Badge */}
              <View style={[
                styles.rankBadge,
                rank === 1 && styles.goldBadge,
                rank === 2 && styles.silverBadge,
                rank === 3 && styles.bronzeBadge,
                rank > 3 && { backgroundColor: theme.border },
              ]}>
                {rank <= 3 ? (
                  <Ionicons 
                    name={rank === 1 ? 'medal' : 'ribbon'} 
                    size={14} 
                    color="#fff" 
                  />
                ) : (
                  <Text style={styles.rankText}>{rank}</Text>
                )}
              </View>

              {/* Region Info */}
              <View style={styles.regionInfo}>
                <View style={styles.regionNameRow}>
                  <View style={[styles.regionDot, { backgroundColor: provinceConfig.primary }]} />
                  <Text style={[
                    styles.regionName, 
                    { color: theme.text },
                    isCurrentRegion && styles.currentRegionName,
                  ]}>
                    {region.regionName}
                    {isCurrentRegion && ' (You)'}
                  </Text>
                </View>
                <Text style={[styles.regionStats, { color: theme.textSecondary }]}>
                  +{region.newThisMonth} this month
                </Text>
              </View>

              {/* Member Count */}
              <View style={styles.memberCount}>
                <Text style={[
                  styles.memberNumber, 
                  { color: theme.text },
                  isCurrentRegion && { color: provinceConfig.primary },
                ]}>
                  {region.totalMembers}
                </Text>
                <Text style={[styles.memberLabel, { color: theme.textSecondary }]}>
                  members
                </Text>
              </View>
            </View>
          );
        })}

        {/* Show current region separately if not in top visible */}
        {showCurrentRegionSeparately && currentRegion && (
          <>
            <View style={styles.separator}>
              <Text style={[styles.separatorText, { color: theme.textSecondary }]}>• • •</Text>
            </View>
            <View
              style={[
                styles.regionRow,
                styles.currentRegionRow,
                { borderColor: PROVINCE_COLORS[currentRegion.regionName]?.primary || '#3B82F6' },
              ]}
            >
              <View style={[styles.rankBadge, { backgroundColor: theme.border }]}>
                <Text style={styles.rankText}>{currentRegionRank}</Text>
              </View>
              <View style={styles.regionInfo}>
                <View style={styles.regionNameRow}>
                  <View style={[
                    styles.regionDot, 
                    { backgroundColor: PROVINCE_COLORS[currentRegion.regionName]?.primary || '#3B82F6' }
                  ]} />
                  <Text style={[styles.regionName, { color: theme.text }, styles.currentRegionName]}>
                    {currentRegion.regionName} (You)
                  </Text>
                </View>
                <Text style={[styles.regionStats, { color: theme.textSecondary }]}>
                  +{currentRegion.newThisMonth} this month
                </Text>
              </View>
              <View style={styles.memberCount}>
                <Text style={[
                  styles.memberNumber, 
                  { color: PROVINCE_COLORS[currentRegion.regionName]?.primary || '#3B82F6' },
                ]}>
                  {currentRegion.totalMembers}
                </Text>
                <Text style={[styles.memberLabel, { color: theme.textSecondary }]}>
                  members
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Motivation Message */}
      {currentRegionRank > 0 && (
        <View style={[styles.motivationBanner, { backgroundColor: `${theme.primary}15` }]}>
          <Ionicons name="flame" size={16} color={theme.primary} />
          <Text style={[styles.motivationText, { color: theme.primary }]}>
            {currentRegionRank === 1 
              ? "You're leading! Keep up the great work! 🏆"
              : currentRegionRank <= 3
              ? `You're #${currentRegionRank}! Push for the top spot! 💪`
              : `You're #${currentRegionRank}. Let's climb the ranks! 🚀`
            }
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  currentRegionRow: {
    borderWidth: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goldBadge: {
    backgroundColor: '#F59E0B',
  },
  silverBadge: {
    backgroundColor: '#9CA3AF',
  },
  bronzeBadge: {
    backgroundColor: '#CD7F32',
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  regionInfo: {
    flex: 1,
  },
  regionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  regionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentRegionName: {
    fontWeight: '700',
  },
  regionStats: {
    fontSize: 12,
    marginTop: 2,
  },
  memberCount: {
    alignItems: 'flex-end',
  },
  memberNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  memberLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  separator: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  separatorText: {
    fontSize: 12,
    letterSpacing: 4,
  },
  motivationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  motivationText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default RegionalLeaderboard;
