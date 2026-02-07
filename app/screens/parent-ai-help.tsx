/**
 * Parent AI Help Hub Screen
 * 
 * Quick-access cards for common AI assistance use cases.
 * Redirects to Dash Assistant with pre-filled prompts.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const QUICK_PROMPTS = [
  {
    icon: 'book' as const,
    title: 'Help with homework',
    description: 'Get step-by-step guidance on any homework assignment',
    prompt: "Help my child with their homework. I'll describe the problem.",
    color: '#3b82f6',
    gradient: ['#3b82f6', '#06b6d4'] as [string, string],
  },
  {
    icon: 'bulb' as const,
    title: 'Explain a concept',
    description: 'Simple explanations for complex topics',
    prompt: 'Explain this concept in a way my child can understand:',
    color: '#8b5cf6',
    gradient: ['#8b5cf6', '#a855f7'] as [string, string],
  },
  {
    icon: 'document-text' as const,
    title: 'Practice worksheet',
    description: 'Create CAPS-aligned practice exercises',
    prompt: 'Generate a practice worksheet for my child',
    color: '#10b981',
    gradient: ['#10b981', '#059669'] as [string, string],
  },
  {
    icon: 'ribbon' as const,
    title: 'Study tips for exams',
    description: 'Personalized study strategies and tips',
    prompt: "Give study tips and strategies for my child's upcoming exam",
    color: '#f59e0b',
    gradient: ['#f59e0b', '#d97706'] as [string, string],
  },
  {
    icon: 'sparkles' as const,
    title: 'Learning activities',
    description: 'Fun educational activities for home',
    prompt: 'Suggest fun learning activities I can do at home with my child',
    color: '#ec4899',
    gradient: ['#ec4899', '#db2777'] as [string, string],
  },
];

const FEATURES = [
  { icon: '💬', text: 'Natural conversation interface' },
  { icon: '📚', text: 'Subject-specific explanations' },
  { icon: '🔢', text: 'Step-by-step problem solving' },
  { icon: '🎙️', text: 'Voice interaction support' },
  { icon: '🌍', text: 'Multi-language support' },
  { icon: '✅', text: 'Homework checking and feedback' },
];

export default function ParentAIHelpScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);

  const handleQuickPrompt = (prompt: string) => {
    router.push({
      pathname: '/screens/dash-assistant',
      params: { initialMessage: prompt },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubPageHeader title={t('parent.ai_help', { defaultValue: 'AI Help & Tutoring' })} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main CTA */}
        <LinearGradient colors={['#7c3aed', '#ec4899']} style={styles.ctaCard}>
          <View style={styles.ctaContent}>
            <View style={styles.ctaIconContainer}>
              <Ionicons name="sparkles" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Chat with Dash AI</Text>
              <Text style={styles.ctaSubtitle}>Your 24/7 AI tutor for homework help and learning</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/screens/dash-assistant')}
          >
            <Ionicons name="chatbubbles" size={20} color="#7c3aed" />
            <Text style={styles.ctaButtonText}>Start Chatting</Text>
            <Ionicons name="arrow-forward" size={18} color="#7c3aed" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        {QUICK_PROMPTS.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.promptCard}
            activeOpacity={0.85}
            onPress={() => handleQuickPrompt(item.prompt)}
          >
            <View style={[styles.promptIcon, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promptTitle}>{item.title}</Text>
              <Text style={styles.promptDescription}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>AI Tutor Features 🤖</Text>
          <Text style={styles.featuresSubtitle}>
            Get instant help with homework and studying:
          </Text>
          {FEATURES.map((feat, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={{ fontSize: 16 }}>{feat.icon}</Text>
              <Text style={styles.featureText}>{feat.text}</Text>
            </View>
          ))}

          <View style={styles.tipBox}>
            <Ionicons name="sparkles-outline" size={20} color="#10b981" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>✨ Dash Chat is Now Available!</Text>
              <Text style={styles.tipText}>
                Full conversational AI with image upload, continuous chat, and conversation history!
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, bottomInset: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: 16, paddingBottom: bottomInset + 40, gap: 14 },
    ctaCard: { borderRadius: 18, padding: 20, gap: 16, marginTop: 16 },
    ctaContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    ctaIconContainer: {
      width: 56, height: 56, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    ctaTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    ctaSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
    ctaButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12,
    },
    ctaButtonText: { fontSize: 16, fontWeight: '700', color: '#7c3aed' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 8 },
    promptCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: theme.surface, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: theme.border,
    },
    promptIcon: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    promptTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 2 },
    promptDescription: { fontSize: 13, color: theme.textSecondary },
    featuresCard: {
      backgroundColor: theme.surface, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: theme.border, marginTop: 8, gap: 10,
    },
    featuresTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    featuresSubtitle: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    featureText: { fontSize: 14, color: theme.text },
    tipBox: {
      flexDirection: 'row', gap: 10, marginTop: 8,
      padding: 14, borderRadius: 10,
      backgroundColor: 'rgba(16,185,129,0.1)',
      borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    },
    tipTitle: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 4 },
    tipText: { fontSize: 13, color: theme.textSecondary },
  });
