/**
 * useLearningHubActivity — Activity step logic and state management
 * 
 * Extracts the activity interaction logic from the Learning Hub screen:
 * - Step navigation (next, option select, confirm)
 * - Answer evaluation (default, robot_path, move_count)
 * - Usage tracking and tier checks
 * - AI hint routing
 * 
 * ≤200 lines — WARP-compliant hook.
 */

import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useCelebration } from '@/hooks/useCelebration';
import {
  incrementLearningHubUsage,
  type LearningHubUsage,
} from '@/lib/learningHubUsage';
import { incrementUsage } from '@/lib/ai/usage';
import {
  type ActivityCard,
  type ActivityStep,
  type StepOption,
  type TierKey,
  TIER_LIMITS,
  formatSequence,
  simulateRobotPath,
} from '@/lib/activities/preschoolLearningHub.data';

export type StepFeedback = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type ActivityContext = {
  selectedPathLength?: number;
  selectedPathOptionId?: string;
};

type ValidationResult = {
  ok: boolean;
  feedback: string;
  patch?: Partial<ActivityContext>;
};

interface UseLearningHubActivityOptions {
  userId?: string;
  tierKey: TierKey;
  usage: LearningHubUsage;
  setUsage: (usage: LearningHubUsage) => void;
  activeChildName?: string;
}

export function useLearningHubActivity({
  userId,
  tierKey,
  usage,
  setUsage,
  activeChildName,
}: UseLearningHubActivityOptions) {
  const limits = TIER_LIMITS[tierKey];
  const { selectionHaptic, successHaptic, errorHaptic } = useCelebration();

  const [activeActivity, setActiveActivity] = useState<ActivityCard | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [stepFeedback, setStepFeedback] = useState<StepFeedback | null>(null);
  const [activityContext, setActivityContext] = useState<ActivityContext>({});
  const [isAdvancing, setIsAdvancing] = useState(false);

  const canStartLesson = usage.lessonsUsed < limits.lessons;
  const canStartActivity = usage.activitiesUsed < limits.activities;
  const canUseAiHint = usage.aiHintsUsed < limits.aiHints;

  const currentStep = useMemo(() => {
    if (!activeActivity) return null;
    return activeActivity.steps[stepIndex] || null;
  }, [activeActivity, stepIndex]);

  const selectedOption = useMemo<StepOption | null>(() => {
    if (!currentStep?.options || !selectedOptionId) return null;
    return currentStep.options.find((o) => o.id === selectedOptionId) || null;
  }, [currentStep?.options, selectedOptionId]);

  const resetActivityState = useCallback(() => {
    setStepIndex(0);
    setSelectedOptionId(null);
    setStepFeedback(null);
    setActivityContext({});
    setIsAdvancing(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveActivity(null);
    resetActivityState();
  }, [resetActivityState]);

  const checkTierAccess = useCallback(
    (required?: TierKey) => {
      if (!required) return true;
      const rank: Record<TierKey, number> = { free: 0, starter: 1, plus: 2 };
      return rank[tierKey] >= rank[required];
    },
    [tierKey],
  );

  const handleStartActivity = useCallback(
    (activity: ActivityCard) => {
      if (!checkTierAccess(activity.requiresTier)) {
        Alert.alert('Upgrade required', 'This activity is available on higher tiers. Upgrade to unlock it.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/screens/subscription-setup' as any) },
        ]);
        return;
      }
      if (activity.isLesson && !canStartLesson) {
        Alert.alert('Daily lesson limit reached', 'Try a quick activity or come back tomorrow.');
        return;
      }
      if (!activity.isLesson && !canStartActivity) {
        Alert.alert('Daily activity limit reached', 'Try again tomorrow or upgrade for higher limits.');
        return;
      }
      setActiveActivity(activity);
      resetActivityState();
    },
    [canStartActivity, canStartLesson, checkTierAccess, resetActivityState],
  );

  const handleOptionSelect = useCallback((optionId: string) => {
    setSelectedOptionId(optionId);
    setStepFeedback(null);
    selectionHaptic();
  }, [selectionHaptic]);

  const evaluateStepAnswer = useCallback((step: ActivityStep, option: StepOption): ValidationResult => {
    const mode = step.validation || 'default';
    if (mode === 'robot_path_to_goal') {
      if (!step.board || !option.sequence) return { ok: false, feedback: 'Choose a complete arrow path first.' };
      const sim = simulateRobotPath(step.board, option.sequence);
      if (!sim.reachedGoal) return { ok: false, feedback: sim.message };
      return { ok: true, feedback: `Yes. ${formatSequence(option.sequence)} takes Robo to the star.`, patch: { selectedPathLength: option.sequence.length, selectedPathOptionId: option.id } };
    }
    if (mode === 'move_count_from_path') {
      const expected = activityContext.selectedPathLength;
      if (!expected) return { ok: false, feedback: 'Solve the path step first so we can count moves.' };
      const val = Number(option.value ?? option.label);
      if (val === expected) return { ok: true, feedback: `Correct. The winning path uses ${expected} moves.` };
      return { ok: false, feedback: `Almost. Robo needed ${expected} moves on the best path.` };
    }
    return option.isCorrect
      ? { ok: true, feedback: 'Nice choice. Great thinking.' }
      : { ok: false, feedback: step.hint || 'Not quite. Try another option.' };
  }, [activityContext.selectedPathLength]);

  const completeActivity = useCallback(async () => {
    if (!activeActivity) return;
    const updated = await incrementLearningHubUsage(userId || 'anonymous', {
      lessonsUsed: activeActivity.isLesson ? 1 : 0,
      activitiesUsed: activeActivity.isLesson ? 0 : 1,
    });
    setUsage(updated);
    const name = activeChildName || 'your child';
    handleCloseModal();
    Alert.alert('Great session complete', `${name} finished ${activeActivity.title}. Progress has been saved.`);
  }, [activeActivity, activeChildName, handleCloseModal, setUsage, userId]);

  const handleNextStep = useCallback(async () => {
    if (!activeActivity || !currentStep || isAdvancing) return;
    if (currentStep.confirmOnly) {
      successHaptic();
      if (stepIndex >= activeActivity.steps.length - 1) { await completeActivity(); return; }
      setIsAdvancing(true);
      setStepFeedback({ type: 'success', text: 'Great. Moving to the next step.' });
      setTimeout(() => { setStepIndex((p) => p + 1); setSelectedOptionId(null); setStepFeedback(null); setIsAdvancing(false); }, 350);
      return;
    }
    if (!selectedOption) { setStepFeedback({ type: 'info', text: 'Pick one answer before you continue.' }); return; }
    const evaluation = evaluateStepAnswer(currentStep, selectedOption);
    if (!evaluation.ok) { errorHaptic(); setStepFeedback({ type: 'error', text: evaluation.feedback }); return; }
    successHaptic();
    setStepFeedback({ type: 'success', text: evaluation.feedback });
    if (evaluation.patch) setActivityContext((prev) => ({ ...prev, ...evaluation.patch }));
    if (stepIndex >= activeActivity.steps.length - 1) { await completeActivity(); return; }
    setIsAdvancing(true);
    setTimeout(() => { setStepIndex((p) => p + 1); setSelectedOptionId(null); setStepFeedback(null); setIsAdvancing(false); }, 500);
  }, [activeActivity, completeActivity, currentStep, errorHaptic, evaluateStepAnswer, isAdvancing, selectedOption, stepIndex, successHaptic]);

  const handleAiHint = useCallback(async () => {
    if (!activeActivity?.aiPrompt) return;
    if (!canUseAiHint) {
      Alert.alert('AI hint limit reached', 'You have used your daily AI hints. Upgrade to unlock more.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/screens/subscription-setup' as any) },
      ]);
      return;
    }
    const updated = await incrementLearningHubUsage(userId || 'anonymous', { aiHintsUsed: 1 });
    setUsage(updated);
    try { await incrementUsage('grading_assistance', 1, 'dash_ai'); } catch { /* non-fatal */ }
    router.push({ pathname: '/screens/dash-assistant', params: { initialMessage: activeActivity.aiPrompt } } as any);
  }, [activeActivity?.aiPrompt, canUseAiHint, setUsage, userId]);

  return {
    activeActivity,
    stepIndex,
    selectedOptionId,
    selectedOption,
    stepFeedback,
    activityContext,
    isAdvancing,
    currentStep,
    canStartLesson,
    canStartActivity,
    canUseAiHint,
    checkTierAccess,
    handleStartActivity,
    handleOptionSelect,
    handleNextStep,
    handleAiHint,
    handleCloseModal,
  };
}

export default useLearningHubActivity;
