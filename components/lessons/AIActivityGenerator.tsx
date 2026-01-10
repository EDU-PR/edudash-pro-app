/**
 * AI Activity Generator Component
 * 
 * Generates age-appropriate AI learning activities
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface AIActivityGeneratorProps {
  ageGroup: string;
  onGenerate?: (prompt: string) => void;
}

export function AIActivityGenerator({ ageGroup, onGenerate }: AIActivityGeneratorProps) {
  const { theme } = useTheme();
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setGenerating(true);
    const prompt = `Create an age-appropriate AI learning activity for ${ageGroup} year olds about: ${topic}`;
    
    try {
      onGenerate?.(prompt);
    } finally {
      setGenerating(false);
    }
  };

  const quickTopics = [
    'Pattern Recognition',
    'Sorting & Categorizing',
    'Predicting Sequences',
    'Teaching a Robot',
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>AI Activity Generator</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Create age-appropriate AI learning activities for {ageGroup} year olds
      </Text>

      <View style={styles.quickTopics}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Topics:</Text>
        <View style={styles.topicGrid}>
          {quickTopics.map((topicName) => (
            <TouchableOpacity
              key={topicName}
              style={[styles.topicButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setTopic(topicName)}
            >
              <Text style={[styles.topicText, { color: theme.text }]}>{topicName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          value={topic}
          onChangeText={setTopic}
          placeholder="Enter a topic for AI activity..."
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <TouchableOpacity
        style={[styles.generateButton, { backgroundColor: theme.primary }]}
        onPress={handleGenerate}
        disabled={!topic.trim() || generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.generateButtonText}>Generate Activity</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  quickTopics: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
