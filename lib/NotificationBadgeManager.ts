/**
 * Notification Badge Manager
 * 
 * Manages the app icon badge (red dot with count) across the application.
 * Handles badge counts for different notification types and syncs with system.
 * 
 * Features:
 * - Unified badge count management
 * - Type-specific badge tracking (calls, messages, alerts)
 * - Automatic sync with system badge
 * - Lock screen badge visibility
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BADGE_STORAGE_KEY = 'edudash_badge_counts';

export interface BadgeCounts {
  missedCalls: number;
  unreadMessages: number;
  pendingAlerts: number;
  systemNotifications: number;
}

const DEFAULT_BADGE_COUNTS: BadgeCounts = {
  missedCalls: 0,
  unreadMessages: 0,
  pendingAlerts: 0,
  systemNotifications: 0,
};

class NotificationBadgeManager {
  private badgeCounts: BadgeCounts = { ...DEFAULT_BADGE_COUNTS };
  private isInitialized = false;

  /**
   * Initialize badge manager and load persisted counts
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(BADGE_STORAGE_KEY);
      if (stored) {
        this.badgeCounts = { ...DEFAULT_BADGE_COUNTS, ...JSON.parse(stored) };
      }
      this.isInitialized = true;
      console.log('[BadgeManager] Initialized with counts:', this.badgeCounts);
      
      // Sync with system on init
      await this.syncSystemBadge();
    } catch (error) {
      console.error('[BadgeManager] Failed to initialize:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Get total badge count
   */
  getTotalBadgeCount(): number {
    return (
      this.badgeCounts.missedCalls +
      this.badgeCounts.unreadMessages +
      this.badgeCounts.pendingAlerts +
      this.badgeCounts.systemNotifications
    );
  }

  /**
   * Get counts by category
   */
  getBadgeCounts(): BadgeCounts {
    return { ...this.badgeCounts };
  }

  /**
   * Increment badge for a specific type
   */
  async incrementBadge(type: keyof BadgeCounts, amount: number = 1): Promise<void> {
    this.badgeCounts[type] += amount;
    await this.persistAndSync();
    console.log(`[BadgeManager] Incremented ${type} by ${amount}, total: ${this.getTotalBadgeCount()}`);
  }

  /**
   * Set badge for a specific type
   */
  async setBadge(type: keyof BadgeCounts, count: number): Promise<void> {
    this.badgeCounts[type] = Math.max(0, count);
    await this.persistAndSync();
    console.log(`[BadgeManager] Set ${type} to ${count}, total: ${this.getTotalBadgeCount()}`);
  }

  /**
   * Clear badge for a specific type
   */
  async clearBadge(type: keyof BadgeCounts): Promise<void> {
    this.badgeCounts[type] = 0;
    await this.persistAndSync();
    console.log(`[BadgeManager] Cleared ${type}, total: ${this.getTotalBadgeCount()}`);
  }

  /**
   * Clear all badges
   */
  async clearAllBadges(): Promise<void> {
    this.badgeCounts = { ...DEFAULT_BADGE_COUNTS };
    await this.persistAndSync();
    console.log('[BadgeManager] Cleared all badges');
  }

  /**
   * Add a missed call
   */
  async addMissedCall(): Promise<void> {
    await this.incrementBadge('missedCalls');
  }

  /**
   * Clear missed calls (when user views call log)
   */
  async clearMissedCalls(): Promise<void> {
    await this.clearBadge('missedCalls');
  }

  /**
   * Add unread message(s)
   */
  async addUnreadMessages(count: number = 1): Promise<void> {
    await this.incrementBadge('unreadMessages', count);
  }

  /**
   * Clear unread messages (when user views messages)
   */
  async clearUnreadMessages(): Promise<void> {
    await this.clearBadge('unreadMessages');
  }

  /**
   * Persist counts and sync with system badge
   */
  private async persistAndSync(): Promise<void> {
    try {
      await AsyncStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(this.badgeCounts));
      await this.syncSystemBadge();
    } catch (error) {
      console.error('[BadgeManager] Failed to persist:', error);
    }
  }

  /**
   * Sync badge count with system (shows on app icon)
   */
  private async syncSystemBadge(): Promise<void> {
    try {
      const total = this.getTotalBadgeCount();
      await Notifications.setBadgeCountAsync(total);
      console.log(`[BadgeManager] System badge set to ${total}`);
    } catch (error) {
      console.error('[BadgeManager] Failed to set system badge:', error);
    }
  }

  /**
   * Get current system badge count
   */
  async getSystemBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('[BadgeManager] Failed to get system badge:', error);
      return 0;
    }
  }
}

// Singleton instance
export const badgeManager = new NotificationBadgeManager();

// Auto-initialize when module loads
badgeManager.initialize().catch(console.error);
