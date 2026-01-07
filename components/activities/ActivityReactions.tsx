/**
 * Activity Reactions Component
 * 
 * Allows parents to react to student activities with emojis.
 * Features:
 * - Quick emoji reactions (❤️ 👍 😊 🎉 👏)
 * - Real-time updates via Supabase subscriptions
 * - Shows reaction counts
 * - Long-press to change reaction
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ActivityReactionsProps {
  activityId: string;
  theme: any;
  compact?: boolean;
}

interface Reaction {
  id: string;
  parent_id: string;
  emoji: string;
  created_at: string;
}

const AVAILABLE_EMOJIS = ['❤️', '👍', '😊', '🎉', '👏', '🌟', '💯', '😍'];

export function ActivityReactions({ activityId, theme, compact = false }: ActivityReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [myReaction, setMyReaction] = useState<Reaction | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReactions();

    // Real-time subscription
    const supabase = assertSupabase();
    const subscription = supabase
      .channel(`reactions_${activityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_reactions',
          filter: `activity_id=eq.${activityId}`,
        },
        (payload) => {
          console.log('[ActivityReactions] Realtime update:', payload);
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activityId]);

  const loadReactions = async () => {
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('activity_reactions')
        .select('*')
        .eq('activity_id', activityId);

      if (error) {
        console.error('[ActivityReactions] Error loading reactions:', error);
        return;
      }

      setReactions(data || []);
      
      // Find user's reaction
      const userReaction = data?.find((r: Reaction) => r.parent_id === user?.id);
      setMyReaction(userReaction || null);
    } catch (error) {
      console.error('[ActivityReactions] Error:', error);
    }
  };

  const addOrUpdateReaction = async (emoji: string) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const supabase = assertSupabase();

      if (myReaction) {
        // Update existing reaction
        const { error } = await supabase
          .from('activity_reactions')
          .update({ emoji })
          .eq('id', myReaction.id);

        if (error) throw error;
      } else {
        // Insert new reaction
        const { error } = await supabase
          .from('activity_reactions')
          .insert({
            activity_id: activityId,
            parent_id: user.id,
            emoji,
          });

        if (error) throw error;
      }

      setShowEmojiPicker(false);
    } catch (error) {
      console.error('[ActivityReactions] Error adding/updating reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeReaction = async () => {
    if (!myReaction) return;

    setLoading(true);
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('activity_reactions')
        .delete()
        .eq('id', myReaction.id);

      if (error) throw error;
      setMyReaction(null);
    } catch (error) {
      console.error('[ActivityReactions] Error removing reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  // Count reactions by emoji
  const reactionCounts = reactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalReactions = reactions.length;

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={() => setShowEmojiPicker(true)}
        onLongPress={() => setShowEmojiPicker(true)}
        disabled={loading}
      >
        {myReaction ? (
          <Text style={styles.compactEmoji}>{myReaction.emoji}</Text>
        ) : (
          <Text style={[styles.compactText, { color: theme.textSecondary }]}>React</Text>
        )}
        {totalReactions > 0 && (
          <Text style={[styles.compactCount, { color: theme.textTertiary }]}>
            {totalReactions}
          </Text>
        )}

        {/* Emoji Picker Modal */}
        <Modal
          visible={showEmojiPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmojiPicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowEmojiPicker(false)}>
            <View style={[styles.emojiPicker, { backgroundColor: theme.card }]}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>React with</Text>
              <View style={styles.emojiGrid}>
                {AVAILABLE_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiButton,
                      myReaction?.emoji === emoji && { backgroundColor: theme.primary + '20' },
                    ]}
                    onPress={() => addOrUpdateReaction(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {myReaction && (
                <TouchableOpacity
                  style={[styles.removeButton, { borderColor: theme.border }]}
                  onPress={removeReaction}
                >
                  <Text style={[styles.removeButtonText, { color: theme.danger }]}>
                    Remove Reaction
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Modal>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Reaction Summary */}
      {Object.keys(reactionCounts).length > 0 && (
        <View style={styles.reactionSummary}>
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <View key={emoji} style={[styles.reactionBadge, { backgroundColor: theme.cardSecondary }]}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>
                {count}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.reactButton,
            { borderColor: theme.border },
            myReaction && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
          ]}
          onPress={() => setShowEmojiPicker(true)}
          disabled={loading}
        >
          <Text style={[styles.reactButtonText, { color: myReaction ? theme.primary : theme.text }]}>
            {myReaction ? `${myReaction.emoji} Reacted` : '👍 React'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEmojiPicker(false)}>
          <View style={[styles.emojiPicker, { backgroundColor: theme.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>React with</Text>
            <View style={styles.emojiGrid}>
              {AVAILABLE_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiButton,
                    myReaction?.emoji === emoji && { backgroundColor: theme.primary + '20' },
                  ]}
                  onPress={() => addOrUpdateReaction(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {myReaction && (
              <TouchableOpacity
                style={[styles.removeButton, { borderColor: theme.border }]}
                onPress={removeReaction}
              >
                <Text style={[styles.removeButtonText, { color: theme.danger }]}>
                  Remove Reaction
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  compactEmoji: {
    fontSize: 16,
  },
  compactText: {
    fontSize: 14,
  },
  compactCount: {
    fontSize: 12,
  },
  reactionSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  reactButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  reactButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emojiPicker: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  emojiButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 32,
  },
  removeButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
