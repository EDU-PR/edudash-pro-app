/**
 * Quiz Activity Component
 * 
 * Multiple choice quiz questions.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuizActivityProps {
  content: {
    questions: Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswer: number; // index
    }>;
  };
  onComplete: (score: number) => void;
  theme: any;
}

export function QuizActivity({ content, onComplete, theme }: QuizActivityProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const currentQuestion = content.questions[currentIndex];
  const totalQuestions = content.questions.length;

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Move to next or finish
    setTimeout(() => {
      if (currentIndex + 1 < totalQuestions) {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        const finalScore = Math.round(((score + (isCorrect ? 1 : 0)) / totalQuestions) * 100);
        onComplete(finalScore);
      }
    }, 1500);
  };

  if (!currentQuestion) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            Question {currentIndex + 1} of {totalQuestions}
          </Text>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreText, { color: theme.success }]}>
              {score}
            </Text>
          </View>
        </View>

        <Text style={[styles.question, { color: theme.text }]}>
          {currentQuestion.question}
        </Text>

        <View style={styles.optionsList}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === currentQuestion.correctAnswer;
            const showFeedback = selectedAnswer !== null;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.cardSecondary },
                  isSelected && showFeedback && isCorrect && { backgroundColor: '#10B981' },
                  isSelected && showFeedback && !isCorrect && { backgroundColor: '#EF4444' },
                  showFeedback && isCorrect && !isSelected && { borderColor: '#10B981', borderWidth: 2 },
                ]}
                onPress={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.optionCircle, { borderColor: theme.border }]}>
                    {showFeedback && isSelected && (
                      <Ionicons
                        name={isCorrect ? 'checkmark' : 'close'}
                        size={20}
                        color="#FFF"
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      { color: theme.text },
                      isSelected && showFeedback && { color: '#FFF' },
                    ]}
                  >
                    {option}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    lineHeight: 28,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    padding: 16,
    borderRadius: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
});
