/**
 * SmartSuggest Action Catalog
 *
 * Role-based, time-aware, context-driven action definitions for the
 * SmartSuggest component. Separated for WARP compliance.
 *
 * @module components/ai/dash-assistant/smartSuggestActions
 * @max-lines 200
 */

import type { IoniconsName } from './SmartSuggest';

export interface SmartAction {
  id: string;
  label: string;
  description: string;
  icon: IoniconsName;
  color: string;
  prompt?: string;
  route?: string;
  category: 'quick' | 'learn' | 'plan' | 'tools';
}

function getTimeContext(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const who = name ? `, ${name.split(' ')[0]}` : '';
  if (hour < 12) return `Good morning${who}`;
  if (hour < 17) return `Good afternoon${who}`;
  return `Good evening${who}`;
}

export function getStudentActions(schoolType: string, grade?: string | null): SmartAction[] {
  const isPreschool = schoolType.includes('preschool') || schoolType.includes('ecd');
  const timeCtx = getTimeContext();

  const base: SmartAction[] = isPreschool
    ? [
        { id: 'story-time', label: 'Story Time', description: 'Listen to a fun story and answer questions', icon: 'book-outline', color: '#8B5CF6', prompt: 'Tell me an interactive story! Ask me questions as we go. Use simple words and fun characters.', category: 'quick' },
        { id: 'play-learn', label: 'Play & Learn', description: 'Colors, shapes, numbers through games', icon: 'game-controller-outline', color: '#10B981', prompt: "Let's play a learning game! Pick something fun: counting, colors, shapes, or animals. Ask me one question at a time.", category: 'quick' },
        { id: 'sing-along', label: 'Sing Along', description: 'Learn nursery rhymes and songs', icon: 'musical-notes-outline', color: '#F59E0B', prompt: 'Teach me a fun nursery rhyme or counting song! Include the words and actions.', category: 'quick' },
        { id: 'draw-create', label: 'Draw & Create', description: 'Art and craft activity ideas', icon: 'color-palette-outline', color: '#EC4899', prompt: 'Give me a simple art activity I can do right now! Tell me what materials I need and the steps.', category: 'learn' },
      ]
    : [
        { id: 'explain-concept', label: 'Explain This', description: 'Get step-by-step explanations', icon: 'bulb-outline', color: '#8B5CF6', prompt: `I need help understanding a concept${grade ? ` (Grade ${grade})` : ''}. Ask me what topic first, then explain step-by-step with examples.`, category: 'quick' },
        { id: 'solve-problem', label: 'Help Me Solve', description: 'Work through problems together', icon: 'calculator-outline', color: '#10B981', prompt: `Help me solve a problem${grade ? ` at Grade ${grade} level` : ''}. Ask me to share the question, then walk me through it step by step.`, category: 'quick' },
        { id: 'test-me', label: 'Quick Quiz', description: 'Practice with instant feedback', icon: 'school-outline', color: '#F59E0B', prompt: `Quiz me${grade ? ` on Grade ${grade} content` : ''}! Start with one question, wait for my answer, then give feedback before the next one.`, category: 'quick' },
        { id: 'study-plan', label: 'Study Plan', description: 'Organize your revision schedule', icon: 'calendar-outline', color: '#3B82F6', prompt: `Help me create a study plan${grade ? ` for Grade ${grade}` : ''}. Ask me what subjects I need to focus on and when my exams are.`, category: 'learn' },
      ];

  if (timeCtx === 'evening' && !isPreschool) {
    base.push({ id: 'recap-day', label: 'Recap Today', description: 'Review what you learned today', icon: 'refresh-outline', color: '#6366F1', prompt: 'Help me recap what I learned today. Ask me what subjects I covered and quiz me on the key points.', category: 'learn' });
  }
  return base;
}

export function getTeacherActions(schoolType: string): SmartAction[] {
  const isPreschool = schoolType.includes('preschool') || schoolType.includes('ecd');
  const base = isPreschool ? 'Use ECD language and play-based activities suitable for ages 3-6.' : 'Use CAPS-aligned structure with clear objectives and lesson outcomes.';

  return [
    { id: 'daily-routine', label: 'Daily Routine', description: 'Generate structured daily schedule', icon: 'time-outline', color: '#8B5CF6', prompt: `Create a structured daily routine with transitions and classroom management cues. ${base}`, category: 'plan' },
    { id: 'interactive-activity', label: 'Interactive Activity', description: 'Design a hands-on classroom activity', icon: 'hand-left-outline', color: '#10B981', prompt: `Design a hands-on interactive activity. Include materials, steps, and assessment criteria. ${base}`, category: 'plan' },
    { id: 'lesson-builder', label: 'Lesson Builder', description: 'Open full lesson generator', icon: 'book-outline', color: '#3B82F6', route: isPreschool ? '/screens/preschool-lesson-generator' : '/screens/ai-lesson-generator', category: 'tools' },
    { id: 'brainstorm', label: 'Brainstorm Room', description: 'Collaborative planning space', icon: 'people-outline', color: '#F59E0B', route: '/screens/brainstorm-room', category: 'tools' },
    { id: 'theme-plan', label: 'Theme Planner', description: 'Weekly theme with daily activities', icon: 'sparkles-outline', color: '#EC4899', prompt: `Brainstorm a weekly theme plan with daily activities, circle time ideas, and parent tips. ${base}`, category: 'plan' },
    { id: 'activity-builder', label: 'Build Activity', description: 'Create interactive STEM activities', icon: 'extension-puzzle-outline', color: '#14B8A6', route: '/screens/teacher-activity-builder', category: 'tools' },
  ];
}

export function getParentActions(schoolType: string): SmartAction[] {
  const isPreschool = schoolType.includes('preschool') || schoolType.includes('ecd');
  return [
    { id: 'homework-help', label: 'Homework Help', description: 'Guide your child step-by-step', icon: 'book-outline', color: '#8B5CF6', prompt: 'Help my child with homework. Ask what subject and question, then explain in a way they can understand.', category: 'quick' },
    { id: 'learning-tips', label: 'Learning Tips', description: `${isPreschool ? 'Play-based' : 'Study'} activities for home`, icon: 'bulb-outline', color: '#10B981', prompt: isPreschool ? 'Suggest fun play-based learning activities I can do at home with my child. Include materials needed.' : 'Suggest effective study techniques and activities I can help my child with at home.', category: 'learn' },
    { id: 'scan-homework', label: 'Scan & Grade', description: 'Take a photo for instant feedback', icon: 'camera-outline', color: '#3B82F6', prompt: "[SCAN_HOMEWORK] I want to scan my child's homework for grading feedback.", category: 'tools' },
    { id: 'progress-check', label: 'Progress Report', description: 'Check learning milestones', icon: 'trending-up-outline', color: '#F59E0B', prompt: "Show me my child's learning progress and suggest areas where they could improve.", category: 'learn' },
  ];
}
