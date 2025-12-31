/**
 * Badge Coordinator - Centralized app icon badge management
 * 
 * This service coordinates badge counts across multiple notification sources
 * to prevent different parts of the app from fighting over the badge count.
 * 
 * Usage:
 * - NotificationContext sets counts for messages, calls, announcements
 * - CallProvider clears 'incomingCall' category (not all badges)
 * - UpdatesProvider manages 'updates' category
 * 
 * The total badge = sum of all category counts
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'edudash_badge_categories';

// Badge categories - each component manages its own category
export type BadgeCategory = 
  | 'messages'      // Unread messages (NotificationContext)
  | 'calls'         // Missed calls (NotificationContext)  
  | 'announcements' // Unread announcements (NotificationContext)
  | 'incomingCall'  // Active incoming call (CallHeadlessTask/CallProvider)
  | 'updates';      // App updates available (UpdatesProvider)

interface BadgeCounts {
  messages: number;
  calls: number;
  announcements: number;
  incomingCall: number;
  updates: number;
}

const DEFAULT_COUNTS: BadgeCounts = {
  messages: 0,
  calls: 0,
  announcements: 0,
  incomingCall: 0,
  updates: 0,
};

class BadgeCoordinatorClass {
  private counts: BadgeCounts = { ...DEFAULT_COUNTS };
  private isInitialized = false;
  private syncPromise: Promise<void> | null = null;

  /**
   * Initialize the coordinator and load persisted counts
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.counts = { ...DEFAULT_COUNTS, ...parsed };
      }
      this.isInitialized = true;
      console.log('[BadgeCoordinator] Initialized with counts:', this.counts);
    } catch (error) {
      console.error('[BadgeCoordinator] Init error:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Get the current total badge count
   */
  getTotal(): number {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Get counts for a specific category
   */
  getCategory(category: BadgeCategory): number {
    return this.counts[category];
  }

  /**
   * Get all category counts
   */
  getAllCounts(): BadgeCounts {
    return { ...this.counts };
  }

  /**
   * Set the count for a specific category
   * This is the primary method for NotificationContext to update counts
   */
  async setCategory(category: BadgeCategory, count: number): Promise<void> {
    const oldCount = this.counts[category];
    this.counts[category] = Math.max(0, count);
    
    if (oldCount !== this.counts[category]) {
      console.log(`[BadgeCoordinator] ${category}: ${oldCount} → ${this.counts[category]}`);
      await this.persistAndSync();
    }
  }

  /**
   * Set multiple categories at once (more efficient)
   * Used by NotificationContext when it has all counts
   */
  async setCategories(updates: Partial<BadgeCounts>): Promise<void> {
    let changed = false;
    
    for (const [key, value] of Object.entries(updates)) {
      const category = key as BadgeCategory;
      if (this.counts[category] !== value) {
        this.counts[category] = Math.max(0, value ?? 0);
        changed = true;
      }
    }
    
    if (changed) {
      console.log('[BadgeCoordinator] Batch update:', this.counts, '→ total:', this.getTotal());
      await this.persistAndSync();
    }
  }

  /**
   * Increment a category count
   */
  async increment(category: BadgeCategory, amount: number = 1): Promise<void> {
    this.counts[category] = Math.max(0, this.counts[category] + amount);
    console.log(`[BadgeCoordinator] ${category} +${amount} → ${this.counts[category]}`);
    await this.persistAndSync();
  }

  /**
   * Clear a specific category (set to 0)
   * This is what CallProvider should use instead of setBadgeCountAsync(0)
   */
  async clearCategory(category: BadgeCategory): Promise<void> {
    if (this.counts[category] !== 0) {
      this.counts[category] = 0;
      console.log(`[BadgeCoordinator] Cleared ${category}, total: ${this.getTotal()}`);
      await this.persistAndSync();
    }
  }

  /**
   * Clear all badge categories
   */
  async clearAll(): Promise<void> {
    this.counts = { ...DEFAULT_COUNTS };
    console.log('[BadgeCoordinator] Cleared all badges');
    await this.persistAndSync();
  }

  /**
   * Persist counts to storage and sync with system badge
   */
  private async persistAndSync(): Promise<void> {
    // Debounce rapid updates
    if (this.syncPromise) return;
    
    this.syncPromise = (async () => {
      try {
        // Persist to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.counts));
        
        // Sync to system badge (app icon)
        if (Platform.OS !== 'web') {
          const total = this.getTotal();
          await Notifications.setBadgeCountAsync(total);
          console.log(`[BadgeCoordinator] System badge set to ${total}`);
        }
      } catch (error) {
        console.error('[BadgeCoordinator] Sync error:', error);
      } finally {
        this.syncPromise = null;
      }
    })();
    
    await this.syncPromise;
  }

  /**
   * Force sync the system badge to match our counts
   * Useful after app comes to foreground
   */
  async forceSync(): Promise<void> {
    if (Platform.OS !== 'web') {
      const total = this.getTotal();
      await Notifications.setBadgeCountAsync(total);
      console.log(`[BadgeCoordinator] Force synced badge to ${total}`);
    }
  }
}

// Singleton instance
export const BadgeCoordinator = new BadgeCoordinatorClass();

// Auto-initialize when module loads
BadgeCoordinator.initialize().catch(console.error);

export default BadgeCoordinator;
