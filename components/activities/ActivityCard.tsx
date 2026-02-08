/**
 * ActivityCard — Renders a single activity feed item
 *
 * Displays activity type badge, title, description, media gallery,
 * timestamp, teacher name, emoji reactions, and comment thread.
 * Designed for WhatsApp-style, mobile-first UX.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  FlatList,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ActivityItem, ActivityReaction, ActivityComment } from '@/hooks/useActivityFeed';

// ── Constants ───────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = (SCREEN_WIDTH - 64) / 3;

const ACTIVITY_META: Record<string, { icon: string; color: string; label: string }> = {
  learning: { icon: 'school', color: '#3B82F6', label: 'Learning' },
  play: { icon: 'game-controller', color: '#10B981', label: 'Play' },
  meal: { icon: 'restaurant', color: '#EF4444', label: 'Meal' },
  rest: { icon: 'moon', color: '#6366F1', label: 'Rest' },
  art: { icon: 'color-palette', color: '#EC4899', label: 'Art' },
  music: { icon: 'musical-notes', color: '#8B5CF6', label: 'Music' },
  story: { icon: 'book', color: '#0EA5E9', label: 'Story' },
  outdoor: { icon: 'sunny', color: '#F59E0B', label: 'Outdoor' },
  special: { icon: 'star', color: '#F97316', label: 'Special' },
  milestone: { icon: 'trophy', color: '#EAB308', label: 'Milestone' },
  social: { icon: 'people', color: '#06B6D4', label: 'Social' },
};

const REACTION_EMOJIS = ['💝', '👏', '😍', '🎉', '💪', '🌟'];

// ── Props ───────────────────────────────────────────────────────────────────

interface ActivityCardProps {
  activity: ActivityItem;
  currentUserId?: string;
  onReaction?: (activityId: string, emoji: string) => void;
  onComment?: (activityId: string, text: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatActivityTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function profileName(p: { first_name: string; last_name: string } | null | undefined): string {
  if (!p) return '';
  return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function groupReactions(reactions: ActivityReaction[]): { emoji: string; count: number; parentIds: string[] }[] {
  const map: Record<string, { count: number; parentIds: string[] }> = {};
  reactions.forEach((r) => {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, parentIds: [] };
    map[r.emoji].count += 1;
    map[r.emoji].parentIds.push(r.parent_id);
  });
  return Object.entries(map)
    .map(([emoji, v]) => ({ emoji, ...v }))
    .sort((a, b) => b.count - a.count);
}

// ── Component ───────────────────────────────────────────────────────────────

export function ActivityCard({
  activity,
  currentUserId,
  onReaction,
  onComment,
  onDeleteComment,
}: ActivityCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const meta = ACTIVITY_META[activity.activity_type] || ACTIVITY_META.special;
  const teacherName = profileName(activity.teacher);
  const studentName = profileName(activity.student);
  const className = activity.class?.name;
  const mediaUrls = (activity.media_urls || []) as string[];
  const reactions = activity.activity_reactions || [];
  const comments = (activity.activity_comments || []).filter((c) => c.is_approved !== false);
  const grouped = groupReactions(reactions);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim()) return;
    onComment?.(activity.id, commentText.trim());
    setCommentText('');
  }, [activity.id, commentText, onComment]);

  const handleReaction = useCallback(
    (emoji: string) => {
      onReaction?.(activity.id, emoji);
      setShowReactionPicker(false);
    },
    [activity.id, onReaction],
  );

  // ── Render ─────────────────────────────────────

  return (
    <View style={styles.card}>
      {/* ── Header row ─── */}
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: meta.color + '22' }]}>
          <Ionicons name={meta.icon as any} size={16} color={meta.color} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {activity.title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {teacherName ? `${teacherName}` : ''}
            {className ? ` · ${className}` : ''}
            {studentName ? ` · ${studentName}` : ''}
          </Text>
        </View>
        <View style={[styles.typeTag, { backgroundColor: meta.color + '18', borderColor: meta.color + '33' }]}>
          <Text style={[styles.typeTagText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* ── Description ─── */}
      {activity.description ? (
        <Text style={[styles.description, { color: theme.text }]}>{activity.description}</Text>
      ) : null}

      {/* ── Duration ─── */}
      {activity.duration_minutes ? (
        <View style={styles.durationRow}>
          <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
          <Text style={[styles.durationText, { color: theme.textSecondary }]}>
            {activity.duration_minutes} min
          </Text>
        </View>
      ) : null}

      {/* ── Media gallery ─── */}
      {mediaUrls.length > 0 && (
        <View style={styles.mediaGrid}>
          {mediaUrls.slice(0, 4).map((url, i) => (
            <TouchableOpacity key={i} onPress={() => setLightboxUrl(url)} activeOpacity={0.85}>
              <Image source={{ uri: url }} style={styles.mediaThumbnail} resizeMode="cover" />
              {i === 3 && mediaUrls.length > 4 && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{mediaUrls.length - 4}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Timestamp ─── */}
      <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
        {formatActivityTime(activity.activity_at)}
      </Text>

      {/* ── Reactions bar ─── */}
      <View style={styles.reactionsRow}>
        {grouped.map((r) => (
          <TouchableOpacity
            key={r.emoji}
            style={[
              styles.reactionPill,
              r.parentIds.includes(currentUserId || '') && styles.reactionPillActive,
            ]}
            onPress={() => onReaction?.(activity.id, r.emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
            {r.count > 1 && <Text style={styles.reactionCount}>{r.count}</Text>}
          </TouchableOpacity>
        ))}

        {/* Add reaction button */}
        <TouchableOpacity
          style={styles.addReactionBtn}
          onPress={() => setShowReactionPicker((p) => !p)}
          activeOpacity={0.7}
        >
          <Ionicons name="heart-outline" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Reaction picker ─── */}
      {showReactionPicker && (
        <View style={[styles.reactionPicker, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity key={emoji} style={styles.pickerEmoji} onPress={() => handleReaction(emoji)} activeOpacity={0.7}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Actions bar (comment toggle) ─── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.commentToggle}
          onPress={() => setShowComments((p) => !p)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={15} color={theme.textSecondary} />
          <Text style={[styles.commentToggleText, { color: theme.textSecondary }]}>
            {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Comment'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Comments section ─── */}
      {showComments && (
        <View style={styles.commentsSection}>
          {comments.map((c) => (
            <View key={c.id} style={[styles.commentRow, { borderLeftColor: theme.primary + '44' }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: theme.primary }]}>
                  {profileName(c.profiles) || 'Parent'}
                </Text>
                <Text style={[styles.commentTime, { color: theme.textSecondary }]}>
                  {formatActivityTime(c.created_at)}
                </Text>
              </View>
              <Text style={[styles.commentBody, { color: theme.text }]}>{c.comment_text}</Text>
              {c.parent_id === currentUserId && onDeleteComment && (
                <TouchableOpacity onPress={() => onDeleteComment(c.id)} style={styles.deleteCommentBtn}>
                  <Ionicons name="trash-outline" size={12} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Comment input */}
          <View style={[styles.commentInputRow, { borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.commentInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              placeholder="Write a comment..."
              placeholderTextColor={theme.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendCommentBtn, { opacity: commentText.trim() ? 1 : 0.4 }]}
              onPress={handleSendComment}
              disabled={!commentText.trim()}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Lightbox modal for images ─── */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxUrl(null)}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {lightboxUrl && (
            <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card || '#1a1a2e',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 12,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: theme.border || '#2a2a4a',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
    },
    typeBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    subtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    typeTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    typeTagText: {
      fontSize: 11,
      fontWeight: '600',
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
    durationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    durationText: {
      fontSize: 12,
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    mediaThumbnail: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 10,
      backgroundColor: '#1e293b',
    },
    moreOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
    timestamp: {
      fontSize: 11,
      marginBottom: 8,
    },
    reactionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center',
      marginBottom: 4,
    },
    reactionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      gap: 3,
    },
    reactionPillActive: {
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    reactionEmoji: {
      fontSize: 14,
    },
    reactionCount: {
      fontSize: 11,
      color: '#94a3b8',
      fontWeight: '600',
    },
    addReactionBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
    },
    reactionPicker: {
      flexDirection: 'row',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 6,
      marginBottom: 8,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    pickerEmoji: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    commentToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
    },
    commentToggleText: {
      fontSize: 13,
    },
    commentsSection: {
      marginTop: 8,
    },
    commentRow: {
      borderLeftWidth: 2,
      paddingLeft: 10,
      marginBottom: 8,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    commentAuthor: {
      fontSize: 12,
      fontWeight: '700',
    },
    commentTime: {
      fontSize: 10,
    },
    commentBody: {
      fontSize: 13,
      lineHeight: 18,
    },
    deleteCommentBtn: {
      position: 'absolute',
      right: 0,
      top: 0,
      padding: 4,
    },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
    },
    commentInput: {
      flex: 1,
      minHeight: 36,
      maxHeight: 80,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      borderWidth: 1,
    },
    sendCommentBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lightboxOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lightboxClose: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lightboxImage: {
      width: SCREEN_WIDTH - 24,
      height: SCREEN_WIDTH - 24,
      borderRadius: 8,
    },
  });
}
