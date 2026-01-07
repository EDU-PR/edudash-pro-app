/**
 * Counting Activity Component
 * 
 * Count objects and select the correct number.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';

interface CountingActivityProps {
  content: {
    items: Array<{
      id: string;
      image?: string;
      emoji?: string;
      correctCount: number;
      options: number[];
    }>;
  };
  onComplete: (score: number) => void;
  theme: any;
}

export function CountingActivity({ content, onComplete, theme }: CountingActivityProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const currentItem = content.items[currentIndex];
  const totalItems = content.items.length;

  const handleAnswer = (answer: number) => {
    setSelectedAnswer(answer);
    
    const isCorrect = answer === currentItem.correctCount;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Move to next or finish
    setTimeout(() => {
      if (currentIndex + 1 < totalItems) {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        const finalScore = Math.round(((score + (isCorrect ? 1 : 0)) / totalItems) * 100);
        onComplete(finalScore);
      }
    }, 1000);
  };

  if (!currentItem) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.question, { color: theme.text }]}>
          Count the items:
        </Text>

        {/* Items to count */}
        <View style={styles.itemsGrid}>
          {[...Array(currentItem.correctCount)].map((_, index) => (
            <View key={index} style={styles.itemWrapper}>
              {currentItem.image ? (
                <Image source={{ uri: currentItem.image }} style={styles.itemImage} />
              ) : (
                <Text style={styles.itemEmoji}>{currentItem.emoji || '⭐'}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Answer options */}
        <View style={styles.optionsGrid}>
          {currentItem.options.map(option => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === currentItem.correctCount;
            const showFeedback = selectedAnswer !== null;

            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.cardSecondary },
                  isSelected && showFeedback && isCorrect && styles.correctButton,
                  isSelected && showFeedback && !isCorrect && styles.incorrectButton,
                ]}
                onPress={() => handleAnswer(option)}
                disabled={selectedAnswer !== null}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.text },
                    isSelected && showFeedback && { color: '#FFF' },
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress */}
        <Text style={[styles.progress, { color: theme.textSecondary }]}>
          Question {currentIndex + 1} of {totalItems}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 24,
    borderRadius: 16,
  },
  question: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  itemWrapper: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  itemEmoji: {
    fontSize: 48,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 24,
  },
  optionButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  correctButton: {
    backgroundColor: '#10B981',
  },
  incorrectButton: {
    backgroundColor: '#EF4444',
  },
  optionText: {
    fontSize: 32,
    fontWeight: '700',
  },
  progress: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
