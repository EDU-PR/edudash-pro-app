import React from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export interface DashAssistantMessagesProps {
  flashListRef: any;
  messages: any[];
  renderMessage: (item: any, index: number) => React.ReactElement | null;
  styles: any;
  theme: any;
  isLoading: boolean;
  isNearBottom: boolean;
  setIsNearBottom: (v: boolean) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  scrollToBottom: (opts: { animated?: boolean; delay?: number }) => void;
  renderTypingIndicator: () => React.ReactElement | null;
  renderSuggestedActions: () => React.ReactElement | null;
}

export const DashAssistantMessages: React.FC<DashAssistantMessagesProps> = ({
  flashListRef,
  messages,
  renderMessage,
  styles,
  theme,
  isLoading,
  isNearBottom,
  setIsNearBottom,
  setUnreadCount,
  scrollToBottom,
  renderTypingIndicator,
  renderSuggestedActions,
}) => {
  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['#0a0a0f', '#1a0a2e', '#0a0a0f']}
        style={styles.emptyStateGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Dash Logo */}
        <View style={[styles.emptyStateLogo, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" size={40} color="#fff" />
        </View>
        
        {/* Welcome Text */}
        <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
          Hi! I'm Dash
        </Text>
        <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>
          Ask me anything! I can help with homework, explain concepts, solve problems, and more.
        </Text>
        
        {/* Quick Action Buttons */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="calculator-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Help with math</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="bulb-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Explain a concept</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="book-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Study guidance</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <FlashList
      ref={flashListRef}
      data={messages}
      keyExtractor={(item: any, index: number) => item.id || `msg-${index}`}
      renderItem={({ item, index }) => renderMessage(item, index)}
      estimatedItemSize={84}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      onScroll={(e: any) => {
        try {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent as any;
          const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
          const near = distanceFromBottom <= 200;
          if (near !== isNearBottom) {
            setIsNearBottom(near);
            if (near) setUnreadCount(0);
          }
        } catch {}
      }}
      scrollEventThrottle={16}
      onContentSizeChange={() => {
        // Auto-scroll when content grows (new messages)
        if (isLoading || isNearBottom) {
          scrollToBottom({ animated: true, delay: 80 });
        }
      }}
      ListEmptyComponent={messages.length === 0 ? renderEmptyState : null}
      ListFooterComponent={
        <>
          {renderTypingIndicator()}
          {renderSuggestedActions()}
        </>
      }
    />
  );
};

export default DashAssistantMessages;