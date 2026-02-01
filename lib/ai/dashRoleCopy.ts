import { normalizeRole } from '@/lib/rbac';

export type DashAIRoleCopy = {
  title: string;
  subtitle: string;
  navLabel: string;
  assistantLabel: string;
  inputPlaceholder: string;
  historyTitle: string;
  historySubtitle: string;
  settingsTitle: string;
  settingsSubtitle: string;
  quickActionsTitle: string;
  quickActionsSubtitle: string;
  messageSubtitle: string;
  messageDescription: string;
};

const DEFAULT_COPY: DashAIRoleCopy = {
  title: 'Dash AI',
  subtitle: 'Smart Assistant',
  navLabel: 'Dash AI',
  assistantLabel: 'Dash AI',
  inputPlaceholder: 'Ask Dash anything...',
  historyTitle: 'Dash AI History',
  historySubtitle: 'Your conversations with Dash',
  settingsTitle: 'Dash AI Settings',
  settingsSubtitle: 'Configure your AI assistant',
  quickActionsTitle: 'Dash AI',
  quickActionsSubtitle: "Ask anything. I'll help.",
  messageSubtitle: 'AI assistant',
  messageDescription: "Hi! I'm Dash, your AI assistant.",
};

export function getDashAIRoleCopy(role?: string | null): DashAIRoleCopy {
  const normalized = normalizeRole(typeof role === 'string' ? role : '');

  switch (normalized) {
    case 'super_admin':
      return {
        title: 'Dash AI Ops',
        subtitle: 'Platform Command',
        navLabel: 'Dash AI Ops',
        assistantLabel: 'Dash Ops',
        inputPlaceholder: 'Ask Dash about platform operations...',
        historyTitle: 'Dash AI Ops History',
        historySubtitle: 'Your ops conversations with Dash',
        settingsTitle: 'Dash AI Ops Settings',
        settingsSubtitle: 'Configure the ops assistant',
        quickActionsTitle: 'Ops Copilot',
        quickActionsSubtitle: 'Monitor, automate, and ship faster.',
        messageSubtitle: 'Platform ops assistant',
        messageDescription: "Hi! I'm Dash, your platform ops copilot.",
      };
    case 'principal_admin':
      return {
        title: 'Dash AI Advisor',
        subtitle: 'School Operations',
        navLabel: 'Dash AI Advisor',
        assistantLabel: 'Dash Advisor',
        inputPlaceholder: 'Ask Dash to plan workflows, reports, or comms...',
        historyTitle: 'Dash AI Advisor History',
        historySubtitle: 'Your leadership conversations with Dash',
        settingsTitle: 'Dash AI Advisor Settings',
        settingsSubtitle: 'Configure your school advisor',
        quickActionsTitle: 'School Advisor',
        quickActionsSubtitle: 'Plan workflows, communications, and routines.',
        messageSubtitle: 'School operations advisor',
        messageDescription: "Hi! I'm Dash, your school operations advisor.",
      };
    case 'teacher':
      return {
        title: 'Dash AI',
        subtitle: 'Teaching Assistant',
        navLabel: 'Dash AI Assistant',
        assistantLabel: 'Dash AI',
        inputPlaceholder: 'Ask Dash to draft lessons, activities, or feedback...',
        historyTitle: 'Dash AI Assistant History',
        historySubtitle: 'Your teaching conversations with Dash',
        settingsTitle: 'Dash AI Settings',
        settingsSubtitle: 'Configure your teaching assistant',
        quickActionsTitle: 'Teaching Assistant',
        quickActionsSubtitle: 'Plan lessons, themes, and classroom routines.',
        messageSubtitle: 'Lesson planning and grading',
        messageDescription: "Hi! I'm Dash, your AI teaching assistant.",
      };
    case 'parent':
      return {
        title: 'Dash Tutor',
        subtitle: 'Homework Helper',
        navLabel: 'Dash Tutor',
        assistantLabel: 'Dash Tutor',
        inputPlaceholder: 'Ask Dash for homework help or practice questions...',
        historyTitle: 'Dash Tutor History',
        historySubtitle: 'Your learning conversations with Dash',
        settingsTitle: 'Dash Tutor Settings',
        settingsSubtitle: 'Configure your family tutor',
        quickActionsTitle: 'Family Tutor',
        quickActionsSubtitle: 'Diagnose, teach, and practice together.',
        messageSubtitle: 'Homework help and practice',
        messageDescription: "Hi! I'm Dash, your family tutor.",
      };
    case 'student':
      return {
        title: 'Dash Tutor',
        subtitle: 'Study Buddy',
        navLabel: 'Dash Tutor',
        assistantLabel: 'Dash Tutor',
        inputPlaceholder: 'Ask Dash to explain or quiz you...',
        historyTitle: 'Dash Tutor History',
        historySubtitle: 'Your study sessions with Dash',
        settingsTitle: 'Dash Tutor Settings',
        settingsSubtitle: 'Configure your study buddy',
        quickActionsTitle: 'Study Buddy',
        quickActionsSubtitle: 'Practice step-by-step with Dash.',
        messageSubtitle: 'Study buddy and practice',
        messageDescription: "Hi! I'm Dash, your study buddy.",
      };
    default:
      return DEFAULT_COPY;
  }
}
