import React from 'react';
import { Platform, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import TutorHome from './TutorHome';

type LearnerContext = {
  learnerName?: string | null;
  grade?: string | null;
  ageBand?: string | null;
  schoolType?: string | null;
  role?: string | null;
};

export interface DashAssistantMessagesProps {
  flashListRef: any;
  messages: any[];
  renderMessage: (item: any, index: number) => React.ReactElement | null;
  styles: any;
  theme: any;
  isLoading: boolean;
  keyboardVisible?: boolean;
  isNearBottom: boolean;
  setIsNearBottom: (v: boolean) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  scrollToBottom: (opts: { animated?: boolean; delay?: number }) => void;
  renderTypingIndicator: () => React.ReactElement | null;
  renderSuggestedActions: () => React.ReactElement | null;
  onSendMessage?: (text: string) => void;
  onAgeBandChange?: (ageBand: string) => void;
  learnerContext?: LearnerContext | null;
  bottomInset?: number;
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
  onSendMessage,
  onAgeBandChange,
  learnerContext,
  bottomInset = 0,
  keyboardVisible = false,
}) => {
  const getTutorPhase = (message: any) => {
    const explicitPhase = message?.metadata?.tutor_phase || message?.metadata?.phase;
    if (explicitPhase) {
      return String(explicitPhase);
    }
    const content = (message?.content || '').toLowerCase();
    if (!content) return null;
    if (/(quiz|practice|exercise|try it|solve|work through)/.test(content)) {
      return 'Practice';
    }
    if (/(diagnose|check in|quick check|question|assess)/.test(content) || (content.endsWith('?') && content.length < 180)) {
      return 'Diagnose';
    }
    if (/(explain|example|step|here's how|why this works)/.test(content)) {
      return 'Teach';
    }
    return null;
  };

  const currentPhase = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.type === 'assistant') {
        return getTutorPhase(msg);
      }
    }
    return null;
  }, [messages]);

  const phaseOrder = ['Diagnose', 'Teach', 'Practice'];
  const phaseIndex = currentPhase ? phaseOrder.indexOf(currentPhase) : -1;

  const renderEmptyState = () => (
    <TutorHome
      styles={styles}
      theme={theme}
      onSendMessage={onSendMessage}
      onAgeBandChange={onAgeBandChange}
      learnerContext={learnerContext}
    />
  );

  const listStyle = StyleSheet.flatten([
    styles.messagesContainer,
    { backgroundColor: theme.background },
  ]) as ViewStyle;
  const listContentStyle = StyleSheet.flatten([
    styles.messagesContent,
    {
      backgroundColor: theme.background,
      flexGrow: 1,
      paddingBottom: Math.max(
        keyboardVisible ? 80 : 104,
        (styles.messagesContent?.paddingBottom || 0) + bottomInset + 16
      ),
    },
  ]) as ViewStyle;

  return (
    <FlashList
      ref={flashListRef}
      data={messages}
      keyExtractor={(item: any, index: number) => item.id || `msg-${index}`}
      renderItem={({ item, index }) => renderMessage(item, index)}
      style={listStyle}
      contentContainerStyle={listContentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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
      ListHeaderComponent={
        messages.length > 0 ? (
          <View style={[styles.phaseRailContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.phaseRailTrack, { backgroundColor: theme.border }]} />
            {phaseOrder.map((phase, index) => {
              const active = index === phaseIndex;
              const completed = phaseIndex >= 0 && index < phaseIndex;
              const dotColor = active ? theme.primary : completed ? theme.primary : theme.border;
              const labelColor = active ? theme.primary : completed ? theme.text : theme.textTertiary;
              return (
                <View key={phase} style={styles.phaseRailStep}>
                  <View style={[styles.phaseRailDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.phaseRailLabel, { color: labelColor }]}>{phase}</Text>
                </View>
              );
            })}
          </View>
        ) : null
      }
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
