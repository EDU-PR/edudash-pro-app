/**
 * ExercisePlayer
 *
 * Core exercise experience: shows one question at a time with immediate
 * feedback (correct/incorrect), auto-advances, and shows a celebration
 * screen on completion.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  DailyExerciseSet,
  SubjectExercise,
  ExerciseQuestion,
  SubjectCode,
} from '@/lib/daily-exercises/types';

/* ─── Props ───────────────────────────────────────────────────────── */

interface ExercisePlayerProps {
  exerciseSet: DailyExerciseSet | null;
  onExit: () => void;
  onComplete: (subjectCode: SubjectCode, score: number, timeSeconds: number) => void;
}

/* ─── Component ───────────────────────────────────────────────────── */

export function ExercisePlayer({ exerciseSet, onExit, onComplete }: ExercisePlayerProps) {
  const pendingSubjects = useMemo(() => {
    if (!exerciseSet) return [];
    return exerciseSet.subjects.filter((s) => s.status !== 'completed');
  }, [exerciseSet]);

  const [subjectIndex, setSubjectIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [subjectDone, setSubjectDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const currentSubject: SubjectExercise | undefined = pendingSubjects[subjectIndex];
  const currentQuestion: ExerciseQuestion | undefined = currentSubject?.questions[questionIndex];
  const totalQuestionsInSubject = currentSubject?.totalQuestions ?? 0;

  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [subjectIndex]);

  const formatTime = useCallback((s: number) => {
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }, []);

  const handleSelectAnswer = useCallback(
    (answer: string) => {
      if (showFeedback || !currentQuestion) return;
      setSelectedAnswer(answer);
      setShowFeedback(true);

      const correct =
        answer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
      setIsCorrectAnswer(correct);
      if (correct) setCorrectCount((c) => c + 1);

      Animated.sequence([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(feedbackOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        const nextQ = questionIndex + 1;
        if (nextQ >= totalQuestionsInSubject) {
          const finalCorrect = correct ? correctCount + 1 : correctCount;
          const score = Math.round((finalCorrect / totalQuestionsInSubject) * 100);
          const time = Math.floor((Date.now() - startTimeRef.current) / 1000);
          if (currentSubject) onComplete(currentSubject.subjectCode, score, time);

          const nextS = subjectIndex + 1;
          if (nextS >= pendingSubjects.length) {
            setAllDone(true);
          } else {
            setSubjectDone(true);
          }
        } else {
          setQuestionIndex(nextQ);
          setSelectedAnswer(null);
          setShowFeedback(false);
        }
      });
    },
    [showFeedback, currentQuestion, questionIndex, totalQuestionsInSubject, correctCount, subjectIndex, pendingSubjects.length, onComplete, currentSubject, feedbackOpacity],
  );

  const advanceToNextSubject = useCallback(() => {
    setSubjectIndex((i) => i + 1);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setCorrectCount(0);
    setSubjectDone(false);
    setElapsedSeconds(0);
  }, []);

  if (!exerciseSet || pendingSubjects.length === 0 || allDone) {
    return <CelebrationScreen onExit={onExit} />;
  }

  if (subjectDone) {
    const score = Math.round((correctCount / totalQuestionsInSubject) * 100);
    return (
      <SubjectCompleteScreen
        subjectLabel={currentSubject?.subjectLabel ?? ''}
        score={score}
        correctCount={correctCount}
        totalQuestions={totalQuestionsInSubject}
        hasNext={subjectIndex + 1 < pendingSubjects.length}
        onNext={advanceToNextSubject}
        onExit={onExit}
      />
    );
  }

  if (!currentQuestion) return <CelebrationScreen onExit={onExit} />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#070B16', '#0F121E']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.exitBtn}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.subjectName}>{currentSubject?.subjectLabel}</Text>
          <Text style={styles.questionCounter}>
            {questionIndex + 1} of {totalQuestionsInSubject}
          </Text>
        </View>
        <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: totalQuestionsInSubject }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < questionIndex && styles.dotDone,
              i === questionIndex && styles.dotCurrent,
            ]}
          />
        ))}
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.questionText}</Text>
      </View>

      <View style={styles.optionsContainer}>
        {currentQuestion.options?.map((option, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = selectedAnswer === option;
          const isCorrectOption = option === currentQuestion.correctAnswer;
          const showCorrectHighlight = showFeedback && isCorrectOption;
          const showWrongHighlight = showFeedback && isSelected && !isCorrectAnswer;

          return (
            <TouchableOpacity
              key={`${option}-${idx}`}
              style={[
                styles.optionButton,
                showCorrectHighlight && styles.optionCorrect,
                showWrongHighlight && styles.optionWrong,
                isSelected && !showFeedback && styles.optionSelected,
              ]}
              onPress={() => handleSelectAnswer(option)}
              disabled={showFeedback}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.optionLetter,
                  showCorrectHighlight && styles.optionLetterCorrect,
                  showWrongHighlight && styles.optionLetterWrong,
                ]}
              >
                <Text style={styles.optionLetterText}>{letter}</Text>
              </View>
              <Text style={styles.optionText}>{option}</Text>
              {showCorrectHighlight && <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />}
              {showWrongHighlight && <Ionicons name="close-circle" size={22} color="#F87171" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {showFeedback && (
        <Animated.View style={[styles.feedbackBanner, { opacity: feedbackOpacity }]}>
          <View style={[styles.feedbackInner, isCorrectAnswer ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <Text style={styles.feedbackTitle}>{isCorrectAnswer ? '✅ Correct!' : '❌ Not quite'}</Text>
            {currentQuestion.explanation ? (
              <Text style={styles.feedbackExplanation}>{currentQuestion.explanation}</Text>
            ) : null}
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

/* ─── Sub-screens ─────────────────────────────────────────────────── */

function SubjectCompleteScreen({
  subjectLabel,
  score,
  correctCount,
  totalQuestions,
  hasNext,
  onNext,
  onExit,
}: {
  subjectLabel: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  hasNext: boolean;
  onNext: () => void;
  onExit: () => void;
}) {
  const stars = score >= 80 ? 3 : score >= 60 ? 2 : 1;
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#070B16', '#0F121E']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.celebrationContent}>
        <Text style={styles.celebrationStars}>{'⭐'.repeat(stars)}</Text>
        <Text style={styles.celebrationTitle}>{subjectLabel} Complete!</Text>
        <Text style={styles.celebrationScore}>{score}%</Text>
        <Text style={styles.celebrationDetail}>
          {correctCount}/{totalQuestions} correct
        </Text>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={hasNext ? onNext : onExit}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#00C6CF', '#0070E0']} style={styles.nextGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.nextButtonText}>{hasNext ? 'Next Subject →' : 'Done 🎉'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function CelebrationScreen({ onExit }: { onExit: () => void }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#070B16', '#0F121E']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.celebrationContent}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
        <Text style={styles.celebrationTitle}>All Done!</Text>
        <Text style={styles.celebrationSubtitle}>Great work today. Keep the streak going!</Text>
        <TouchableOpacity style={styles.nextButton} onPress={onExit} activeOpacity={0.8}>
          <LinearGradient colors={['#00C6CF', '#0070E0']} style={styles.nextGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.nextButtonText}>Back to Dashboard</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B16' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  exitBtn: { width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  subjectName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  questionCounter: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  timer: { fontSize: 14, fontWeight: '600', color: '#00F5FF', width: 50, textAlign: 'right' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotDone: { backgroundColor: '#4ADE80' },
  dotCurrent: { backgroundColor: '#00F5FF', width: 20 },
  questionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  questionText: { fontSize: 17, color: '#E2E8F0', lineHeight: 26 },
  optionsContainer: { marginHorizontal: 20, marginTop: 20, gap: 10 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  optionSelected: { borderColor: '#00F5FF', backgroundColor: 'rgba(0,245,255,0.08)' },
  optionCorrect: { borderColor: '#4ADE80', backgroundColor: 'rgba(74,222,128,0.12)' },
  optionWrong: { borderColor: '#F87171', backgroundColor: 'rgba(248,113,113,0.12)' },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterCorrect: { backgroundColor: 'rgba(74,222,128,0.3)' },
  optionLetterWrong: { backgroundColor: 'rgba(248,113,113,0.3)' },
  optionLetterText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  optionText: { fontSize: 15, color: '#E2E8F0', flex: 1 },
  feedbackBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  feedbackInner: { padding: 16, borderRadius: 14 },
  feedbackCorrect: { backgroundColor: 'rgba(74,222,128,0.18)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  feedbackWrong: { backgroundColor: 'rgba(248,113,113,0.18)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
  feedbackTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  feedbackExplanation: { fontSize: 13, color: '#B0BEC5', lineHeight: 18 },
  celebrationContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  celebrationEmoji: { fontSize: 64, marginBottom: 16 },
  celebrationStars: { fontSize: 48, marginBottom: 12 },
  celebrationTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  celebrationScore: { fontSize: 48, fontWeight: '800', color: '#00F5FF', marginBottom: 4 },
  celebrationDetail: { fontSize: 16, color: '#9CA3AF', marginBottom: 32 },
  celebrationSubtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 32, textAlign: 'center' },
  nextButton: { borderRadius: 14, overflow: 'hidden', width: '100%' },
  nextGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  nextButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
