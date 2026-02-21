import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
  childGrade?: string | null;
  /** Open full tutor session */
  onOpenFullSession: () => void;
}

type GradeBand = 'foundation' | 'intermediate' | 'senior';

const shuffleArray = <T,>(input: T[]): T[] => {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
};

const parseGradeNumber = (value?: string | null): number => {
  if (!value) return 4;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'r' || normalized.includes('grade r')) return 0;
  const match = normalized.match(/\d{1,2}/);
  return match ? Number(match[0]) : 4;
};

const resolveGradeBand = (grade?: string | null): GradeBand => {
  const gradeNum = parseGradeNumber(grade);
  if (gradeNum <= 3) return 'foundation';
  if (gradeNum <= 6) return 'intermediate';
  return 'senior';
};

const buildQuestion = ({
  id,
  prompt,
  correctAnswer,
  distractors,
  explanation,
}: {
  id: string;
  prompt: string;
  correctAnswer: string | number;
  distractors: Array<string | number>;
  explanation: string;
}): TutorQuestion => {
  const normalizedCorrect = String(correctAnswer);
  const unique: string[] = [];

  [normalizedCorrect, ...distractors.map(String)].forEach((value) => {
    if (value && !unique.includes(value)) unique.push(value);
  });

  let guard = 0;
  while (unique.length < 4 && guard < 16) {
    const filler = String(randomInt(2, 99));
    if (!unique.includes(filler)) unique.push(filler);
    guard += 1;
  }

  const options = shuffleArray(unique.slice(0, 4));
  const correctIndex = options.findIndex((value) => value === normalizedCorrect);

  return {
    id,
    prompt,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation,
  };
};

const createFoundationQuestions = (childName: string): TutorQuestion[] => {
  const addA = randomInt(4, 16);
  const addB = randomInt(3, 9);
  const subtractA = randomInt(11, 20);
  const subtractB = randomInt(2, 9);
  const timesA = randomInt(2, 9);
  const timesB = randomInt(2, 5);
  const halfHour = 30;
  const placeNumber = randomInt(120, 980);
  const tensValue = Math.floor((placeNumber % 100) / 10) * 10;

  const spelling = [
    { word: 'because', wrong: ['becouse', 'beacause', 'becuase'] },
    { word: 'friend', wrong: ['freind', 'frend', 'friendd'] },
    { word: 'school', wrong: ['scool', 'schooll', 'schol'] },
  ][randomInt(0, 2)];

  return [
    buildQuestion({
      id: 'foundation-add',
      prompt: `${childName}, what is ${addA} + ${addB}?`,
      correctAnswer: addA + addB,
      distractors: [addA + addB + 1, addA + addB - 1, addA + addB + 2],
      explanation: `Great work. ${addA} + ${addB} = ${addA + addB}.`,
    }),
    buildQuestion({
      id: 'foundation-subtract',
      prompt: `What is ${subtractA} - ${subtractB}?`,
      correctAnswer: subtractA - subtractB,
      distractors: [subtractA - subtractB + 1, subtractA - subtractB - 1, subtractA - subtractB + 2],
      explanation: `Correct. ${subtractA} - ${subtractB} = ${subtractA - subtractB}.`,
    }),
    buildQuestion({
      id: 'foundation-times',
      prompt: `Multiply: ${timesA} × ${timesB}`,
      correctAnswer: timesA * timesB,
      distractors: [timesA * timesB + timesB, timesA * timesB - timesB, timesA * timesB + 1],
      explanation: `Nice. ${timesA} groups of ${timesB} gives ${timesA * timesB}.`,
    }),
    buildQuestion({
      id: 'foundation-time',
      prompt: 'How many minutes are in half an hour?',
      correctAnswer: halfHour,
      distractors: [20, 45, 60],
      explanation: 'Half of 60 minutes is 30 minutes.',
    }),
    buildQuestion({
      id: 'foundation-place-value',
      prompt: `In ${placeNumber}, what is the value of the tens digit?`,
      correctAnswer: tensValue,
      distractors: [Math.floor((placeNumber % 100) / 10), tensValue + 10, Math.max(0, tensValue - 10)],
      explanation: `The tens place value is ${tensValue}.`,
    }),
    buildQuestion({
      id: 'foundation-spelling',
      prompt: 'Choose the correctly spelled word.',
      correctAnswer: spelling.word,
      distractors: spelling.wrong,
      explanation: `Correct spelling: "${spelling.word}".`,
    }),
  ];
};

const createIntermediateQuestions = (childName: string): TutorQuestion[] => {
  let numerator = randomInt(6, 18);
  let denominator = randomInt(10, 24);
  while (numerator >= denominator || gcd(numerator, denominator) === 1) {
    numerator = randomInt(6, 18);
    denominator = randomInt(10, 24);
  }
  const divisor = gcd(numerator, denominator);
  const reduced = `${numerator / divisor}/${denominator / divisor}`;

  const sameDenominator = randomInt(6, 12);
  const leftFraction = randomInt(1, sameDenominator - 1);
  let rightFraction = randomInt(1, sameDenominator - 1);
  while (rightFraction === leftFraction) {
    rightFraction = randomInt(1, sameDenominator - 1);
  }
  const largerFraction = `${Math.max(leftFraction, rightFraction)}/${sameDenominator}`;

  const mulA = randomInt(11, 29);
  const mulB = randomInt(3, 9);
  const divB = randomInt(3, 9);
  const divA = divB * randomInt(3, 12);
  const perimeterL = randomInt(5, 14);
  const perimeterW = randomInt(3, 10);
  const decimal = randomInt(12, 98) / 10;
  const placeMap: Record<number, string> = { 0: 'ones', 1: 'tenths', 2: 'hundredths' };
  const placeIndex = 1;
  const decimalDigits = decimal.toFixed(1).replace('.', '');
  const placeDigit = Number(decimalDigits[placeIndex]);

  return [
    buildQuestion({
      id: 'intermediate-fraction-simplify',
      prompt: `Simplify ${numerator}/${denominator}.`,
      correctAnswer: reduced,
      distractors: [`${numerator}/${denominator}`, `${numerator / divisor}/${denominator}`, `${numerator}/${denominator / divisor}`],
      explanation: `Great work. Divide top and bottom by ${divisor}: ${numerator}/${denominator} = ${reduced}.`,
    }),
    buildQuestion({
      id: 'intermediate-fraction-compare',
      prompt: `Which fraction is greater: ${leftFraction}/${sameDenominator} or ${rightFraction}/${sameDenominator}?`,
      correctAnswer: largerFraction,
      distractors: [`${Math.min(leftFraction, rightFraction)}/${sameDenominator}`, 'They are equal', `${sameDenominator}/${sameDenominator}`],
      explanation: `With the same denominator, the larger numerator is greater. So ${largerFraction} is greater.`,
    }),
    buildQuestion({
      id: 'intermediate-multiply',
      prompt: `${childName}, calculate ${mulA} × ${mulB}.`,
      correctAnswer: mulA * mulB,
      distractors: [mulA * mulB + mulB, mulA * mulB - mulB, mulA * mulB + 10],
      explanation: `Correct. ${mulA} × ${mulB} = ${mulA * mulB}.`,
    }),
    buildQuestion({
      id: 'intermediate-divide',
      prompt: `What is ${divA} ÷ ${divB}?`,
      correctAnswer: divA / divB,
      distractors: [divA / divB + 1, divA / divB - 1, divB],
      explanation: `Nice. ${divA} divided by ${divB} equals ${divA / divB}.`,
    }),
    buildQuestion({
      id: 'intermediate-perimeter',
      prompt: `Find the perimeter of a rectangle with length ${perimeterL} cm and width ${perimeterW} cm.`,
      correctAnswer: 2 * (perimeterL + perimeterW),
      distractors: [perimeterL * perimeterW, perimeterL + perimeterW, 2 * perimeterL + perimeterW],
      explanation: `Perimeter = 2 × (length + width) = ${2 * (perimeterL + perimeterW)} cm.`,
    }),
    buildQuestion({
      id: 'intermediate-decimal',
      prompt: `In ${decimal.toFixed(1)}, which digit is in the ${placeMap[placeIndex]} place?`,
      correctAnswer: placeDigit,
      distractors: [placeDigit + 1, Math.max(0, placeDigit - 1), Number(decimal.toFixed(1).split('.')[0])],
      explanation: `In ${decimal.toFixed(1)}, the ${placeMap[placeIndex]} digit is ${placeDigit}.`,
    }),
  ];
};

const createSeniorQuestions = (childName: string): TutorQuestion[] => {
  const eqAdd = randomInt(4, 13);
  const eqResult = randomInt(20, 48);
  const eqAnswer = eqResult - eqAdd;
  const percent = randomInt(10, 40);
  const base = randomInt(8, 25) * 10;
  const ratioA = randomInt(2, 5);
  const ratioB = randomInt(3, 8);
  const ratioScale = randomInt(2, 5);
  const triangleBase = randomInt(6, 14);
  const triangleHeight = randomInt(4, 12);
  const integerA = randomInt(-9, 12);
  const integerB = randomInt(-9, 12);

  return [
    buildQuestion({
      id: 'senior-linear-equation',
      prompt: `Solve for x: x + ${eqAdd} = ${eqResult}`,
      correctAnswer: eqAnswer,
      distractors: [eqAnswer + eqAdd, eqResult, eqAnswer - 2],
      explanation: `Subtract ${eqAdd} from both sides. x = ${eqAnswer}.`,
    }),
    buildQuestion({
      id: 'senior-percentage',
      prompt: `What is ${percent}% of ${base}?`,
      correctAnswer: (percent * base) / 100,
      distractors: [base / percent, percent + base, (percent * base) / 10],
      explanation: `${percent}% of ${base} = (${percent}/${100}) × ${base} = ${(percent * base) / 100}.`,
    }),
    buildQuestion({
      id: 'senior-ratio',
      prompt: `Which ratio is equivalent to ${ratioA}:${ratioB}?`,
      correctAnswer: `${ratioA * ratioScale}:${ratioB * ratioScale}`,
      distractors: [
        `${ratioA + ratioScale}:${ratioB + ratioScale}`,
        `${ratioA * ratioScale}:${ratioB}`,
        `${ratioA}:${ratioB * ratioScale}`,
      ],
      explanation: `Multiply both terms by the same number (${ratioScale}) to keep ratios equivalent.`,
    }),
    buildQuestion({
      id: 'senior-triangle-area',
      prompt: `Find the area of a triangle with base ${triangleBase} cm and height ${triangleHeight} cm.`,
      correctAnswer: (triangleBase * triangleHeight) / 2,
      distractors: [triangleBase * triangleHeight, triangleBase + triangleHeight, triangleBase * 2 + triangleHeight],
      explanation: `Area of triangle = 1/2 × base × height = ${(triangleBase * triangleHeight) / 2} cm².`,
    }),
    buildQuestion({
      id: 'senior-integers',
      prompt: `${childName}, evaluate: ${integerA} + (${integerB})`,
      correctAnswer: integerA + integerB,
      distractors: [integerA - integerB, Math.abs(integerA + integerB), integerA + integerB + 2],
      explanation: `Add signed integers carefully: ${integerA} + (${integerB}) = ${integerA + integerB}.`,
    }),
    buildQuestion({
      id: 'senior-language',
      prompt: 'Choose the word that is a synonym for "analyze".',
      correctAnswer: 'examine',
      distractors: ['ignore', 'forget', 'erase'],
      explanation: '"Examine" means to inspect closely, which matches "analyze".',
    }),
  ];
};

const buildQuestionPool = (childName: string, childGrade?: string | null): TutorQuestion[] => {
  const band = resolveGradeBand(childGrade);
  if (band === 'foundation') return createFoundationQuestions(childName);
  if (band === 'senior') return createSeniorQuestions(childName);
  return createIntermediateQuestions(childName);
};

export default function InlineTutorPreview({
  childName,
  childGrade,
  onOpenFullSession,
}: InlineTutorPreviewProps) {
  const [isActive, setIsActive] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const questionPool = useMemo(
    () => buildQuestionPool(childName, childGrade),
    [childName, childGrade]
  );

  const questionOrder = useMemo(
    () => shuffleArray(questionPool.map((_, idx) => idx)),
    [questionPool]
  );

  const currentQuestionNumber = (questionIndex % questionPool.length) + 1;
  const currentQuestionKey = questionOrder[questionIndex % questionOrder.length] ?? 0;
  const question = questionPool[currentQuestionKey];

  useEffect(() => {
    setQuestionIndex(0);
    setSelectedIndex(null);
  }, [childName, childGrade]);

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
          This is a tutor practice question, not a formal exam. Question {currentQuestionNumber} of {questionPool.length}.
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
