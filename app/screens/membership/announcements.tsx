/**
 * Announcements Screen - Youth President
 * Create and manage announcements for SOA members
 * WARP.md compliant: <500 lines, separate styles, React Query
 */
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnnouncements, useCreateAnnouncement, ANNOUNCEMENT_TYPES, AUDIENCE_OPTIONS, Announcement } from '@/hooks/membership/useAnnouncements';
import { styles } from './announcements.styles';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'general', label: 'General' },
  { id: 'event', label: 'Events' },
  { id: 'urgent', label: 'Urgent' },
];

export default function AnnouncementsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', type: 'general' as const, audience: 'all' as const, isPinned: false });
  
  const { data: announcements = [], isLoading, refetch } = useAnnouncements(activeFilter);
  const createMutation = useCreateAnnouncement();

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    await createMutation.mutateAsync({ ...formData, author: 'Youth President' });
    setFormData({ title: '', content: '', type: 'general', audience: 'all', isPinned: false });
    setModalVisible(false);
  };

  const getTypeConfig = (type: string) => ANNOUNCEMENT_TYPES.find(t => t.id === type) || ANNOUNCEMENT_TYPES[0];

  const formatDate = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const renderAnnouncement = ({ item }: { item: Announcement }) => {
    const typeConfig = getTypeConfig(item.type);
    return (
      <View style={[styles.announcementCard, { backgroundColor: colors.card }]}>
        {item.isPinned && (
          <View style={[styles.pinnedBadge, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="pin" size={12} color={colors.primary} />
            <Text style={[styles.pinnedText, { color: colors.primary }]}>Pinned</Text>
          </View>
        )}
        <View style={styles.announcementHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeConfig.color + '20' }]}>
            <Ionicons name={typeConfig.icon as any} size={20} color={typeConfig.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.announcementTitle, { color: colors.text }]}>{item.title}</Text>
            <View style={styles.meta}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.author} • {formatDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '20' }]}>
            <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
        </View>
        <Text style={[styles.announcementContent, { color: colors.textSecondary }]} numberOfLines={3}>{item.content}</Text>
        <View style={styles.announcementFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{item.readCount} views</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{item.audience === 'all' ? 'Everyone' : item.audience}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading announcements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Announcements</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{announcements.length} total</Text>
          </View>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersList}>
            {FILTERS.map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterChip, { backgroundColor: activeFilter === filter.id ? colors.primary : colors.card, borderColor: activeFilter === filter.id ? colors.primary : colors.border }]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text style={[styles.filterText, { color: activeFilter === filter.id ? '#fff' : colors.text }]}>{filter.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <FlatList
          data={announcements}
          renderItem={renderAnnouncement}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No announcements</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Create your first announcement</Text>
            </View>
          }
        />

        {/* Create Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Announcement</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalForm}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Title</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={formData.title}
                  onChangeText={text => setFormData(prev => ({ ...prev, title: text }))}
                  placeholder="Announcement title"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={[styles.inputLabel, { color: colors.text }]}>Content</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={formData.content}
                  onChangeText={text => setFormData(prev => ({ ...prev, content: text }))}
                  placeholder="Write your announcement..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={[styles.inputLabel, { color: colors.text }]}>Type</Text>
                <View style={styles.typeSelector}>
                  {ANNOUNCEMENT_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeOption, { backgroundColor: formData.type === type.id ? type.color + '20' : colors.background, borderColor: formData.type === type.id ? type.color : colors.border }]}
                      onPress={() => setFormData(prev => ({ ...prev, type: type.id as any }))}
                    >
                      <Ionicons name={type.icon as any} size={16} color={type.color} />
                      <Text style={[styles.typeOptionText, { color: formData.type === type.id ? type.color : colors.text }]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Audience</Text>
                <View style={styles.audienceSelector}>
                  {AUDIENCE_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.audienceOption, { backgroundColor: formData.audience === opt.id ? colors.primary + '20' : colors.background, borderColor: formData.audience === opt.id ? colors.primary : colors.border }]}
                      onPress={() => setFormData(prev => ({ ...prev, audience: opt.id as any }))}
                    >
                      <Text style={[styles.audienceOptionText, { color: formData.audience === opt.id ? colors.primary : colors.text }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.pinToggle, { backgroundColor: formData.isPinned ? colors.primary + '20' : colors.background, borderColor: formData.isPinned ? colors.primary : colors.border }]}
                  onPress={() => setFormData(prev => ({ ...prev, isPinned: !prev.isPinned }))}
                >
                  <Ionicons name={formData.isPinned ? 'pin' : 'pin-outline'} size={20} color={formData.isPinned ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.pinToggleText, { color: formData.isPinned ? colors.primary : colors.text }]}>Pin this announcement</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
                  <Text style={styles.submitButtonText}>{createMutation.isPending ? 'Posting...' : 'Post Announcement'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
