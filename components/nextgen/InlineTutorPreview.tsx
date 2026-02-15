import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ROBOT_MASCOT = require('@/assets/images/robot-mascot.png');

type TutorQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

interface InlineTutorPreviewProps {
  childName: string;
  /** Open full tutor session */
  onOpenFullSession: () => void;
}

const SAMPLE_QUESTIONS: TutorQuestion[] = [
  {
    id: 'fraction-simplify',
    prompt: 'What is 5/10 simplified to its lowest terms?',
    options: ['1/2', '2/5', '5/5', '3/4'],
    correctIndex: 0,
    explanation: 'Great work. Divide top and bottom by 5: 5/10 = 1/2.',
  },
  {
    id: 'fraction-compare',
    prompt: 'Which fraction is greater?',
    options: ['1/4', '3/4', '2/8', '1/2'],
    correctIndex: 1,
    explanation: 'Correct. 3/4 is larger than 1/2, 1/4, and 2/8.',
  },
];

export default function InlineTutorPreview({
  childName,
  onOpenFullSession,
}: InlineTutorPreviewProps) {
  const [isActive, setIsActive] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const question = useMemo(
    () => SAMPLE_QUESTIONS[questionIndex % SAMPLE_QUESTIONS.length],
    [questionIndex]
  );

  const handleStop = useCallback(() => {
    setIsActive(false);
    setIsListening(false);
  }, []);

  const handleResume = useCallback(() => {
    setIsActive(true);
  }, []);

  const handleMicToggle = useCallback(() => {
    if (!isActive) return;
    setIsListening((prev) => !prev);
  }, [isActive]);

  const handleChooseAnswer = useCallback((index: number) => {
    if (!isActive) return;
    setSelectedIndex(index);
  }, [isActive]);

  const handleNextQuestion = useCallback(() => {
    setQuestionIndex((prev) => prev + 1);
    setSelectedIndex(null);
  }, []);

  const isCorrect = selectedIndex !== null && selectedIndex === question.correctIndex;

  return (
    <View style={styles.container}>
      <Image source={ROBOT_MASCOT} style={styles.floatingMascot} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Current Tutor Session</Text>
        <TouchableOpacity onPress={onOpenFullSession} hitSlop={8}>
          <Text style={styles.expandText}>Expand ↗</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.chatArea, !isActive && styles.chatAreaCollapsed]}>
        <View style={styles.identityRow}>
          <View style={styles.liveDot} />
          <View style={styles.identityText}>
            <Text style={styles.identityName}>Interactive Tutor Session</Text>
            <Text style={styles.identityHint}>Personalized • Diagnose → Teach → Practice</Text>
          </View>
        </View>

        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>
            Hello {childName}! Let’s explore one concept step by step.
          </Text>
        </View>

        <Text style={styles.practiceHint}>
          This is a tutor practice question, not a formal exam.
        </Text>

        <View style={styles.sampleCards}>
          <View style={styles.sampleCard}>
            <Text style={styles.sampleCardIcon}>✦</Text>
            <Text style={styles.sampleCardText}>{question.prompt}</Text>
          </View>

          <View style={styles.answerGrid}>
            {question.options.map((option, idx) => {
              const selected = selectedIndex === idx;
              const showResult = selectedIndex !== null;
              const isAnswerCorrect = idx === question.correctIndex;

              return (
                <TouchableOpacity
                  key={`${question.id}-${option}`}
                  style={[
                    styles.answerChip,
                    selected && styles.answerChipSelected,
                    showResult && isAnswerCorrect && styles.answerChipCorrect,
                    showResult && selected && !isAnswerCorrect && styles.answerChipWrong,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleChooseAnswer(idx)}
                >
                  <Text
                    style={[
                      styles.answerLabel,
                      selected && styles.answerLabelSelected,
                      showResult && isAnswerCorrect && styles.answerLabelCorrect,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedIndex !== null ? (
            <View style={[styles.feedbackCard, isCorrect ? styles.feedbackGood : styles.feedbackRetry]}>
              <Text style={styles.feedbackTitle}>{isCorrect ? 'Nice work!' : 'Good try!'}</Text>
              <Text style={styles.feedbackText}>{question.explanation}</Text>
              <TouchableOpacity style={styles.nextBtn} onPress={handleNextQuestion}>
                <Text style={styles.nextBtnText}>Next question</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        {isActive ? (
          <TouchableOpacity style={styles.controlBtn} onPress={handleStop}>
            <View style={styles.stopDot} />
            <Text style={styles.controlLabel}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.resumeBtn} onPress={handleResume}>
            <Ionicons name="play" size={12} color="#3C8E62" />
            <Text style={styles.resumeLabel}>Resume</Text>
          </TouchableOpacity>
        )}

        <View style={styles.langPills}>
          <Text style={styles.langPill}>EN</Text>
          <Text style={styles.langPillInactive}>AF</Text>
        </View>

        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          onPress={handleMicToggle}
          disabled={!isActive}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={18}
            color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  floatingMascot: {
    position: 'absolute',
    top: -20,
    left: 12,
    width: 76,
    height: 76,
    resizeMode: 'contain',
    zIndex: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    paddingLeft: 84,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  expandText: {
    color: 'rgba(234,240,255,0.56)',
    fontSize: 12,
    fontWeight: '600',
  },
  chatArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chatAreaCollapsed: {
    opacity: 0.45,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(90,64,157,0.15)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(90,64,157,0.20)',
    gap: 10,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34D399',
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  identityHint: {
    color: 'rgba(234,240,255,0.58)',
    fontSize: 10,
    marginTop: 2,
  },
  messageBubble: {
    backgroundColor: 'rgba(60,142,98,0.15)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(60,142,98,0.20)',
  },
  messageText: {
    color: 'rgba(234,240,255,0.90)',
    fontSize: 13,
    lineHeight: 19,
  },
  practiceHint: {
    color: 'rgba(234,240,255,0.62)',
    fontSize: 12,
    marginBottom: 10,
  },
  sampleCards: {
    gap: 8,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  sampleCardIcon: {
    color: '#C7BFFF',
    fontSize: 14,
    marginTop: 1,
  },
  sampleCardText: {
    color: 'rgba(234,240,255,0.82)',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  answerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  answerChip: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  answerChipSelected: {
    borderColor: 'rgba(99,102,241,0.9)',
    backgroundColor: 'rgba(99,102,241,0.22)',
  },
  answerChipCorrect: {
    borderColor: 'rgba(52,211,153,0.9)',
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  answerChipWrong: {
    borderColor: 'rgba(248,113,113,0.9)',
    backgroundColor: 'rgba(239,68,68,0.16)',
  },
  answerLabel: {
    color: 'rgba(234,240,255,0.88)',
    fontSize: 13,
    fontWeight: '600',
  },
  answerLabelSelected: {
    color: '#FFFFFF',
  },
  answerLabelCorrect: {
    color: '#DCFCE7',
  },
  feedbackCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  feedbackGood: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(52,211,153,0.38)',
  },
  feedbackRetry: {
    backgroundColor: 'rgba(245,158,11,0.13)',
    borderColor: 'rgba(251,191,36,0.35)',
  },
  feedbackTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackText: {
    color: 'rgba(234,240,255,0.84)',
    fontSize: 12,
    lineHeight: 18,
  },
  nextBtn: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#4F46E5',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  controlLabel: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,142,98,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  resumeLabel: {
    color: '#3C8E62',
    fontSize: 12,
    fontWeight: '600',
  },
  langPills: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  langPill: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(60,142,98,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  langPillInactive: {
    color: 'rgba(234,240,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3C8E62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
  },
});
