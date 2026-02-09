/**
 * Action Builders for Teacher Dashboard
 * Creates AI Tools and Quick Actions configurations
 * @deprecated Legacy action builder retained temporarily.
 * Active #NEXT-GEN teacher quick actions are built in `hooks/useNewEnhancedTeacherState.ts`.
 */

import { Alert } from 'react-native';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';
import type { AITool, QuickAction } from './types';
import { getTeacherRoute } from '@/lib/constants/teacherRoutes';

interface BuildAIToolsParams {
  hasActiveSeat: boolean;
  aiLessonEnabled: boolean;
  aiGradingEnabled: boolean;
  aiHelperEnabled: boolean;
  canCreateAssignments: boolean;
  canGradeAssignments: boolean;
  t: (key: string, options?: any) => string;
  isPreschool?: boolean;
}

export const buildAITools = (params: BuildAIToolsParams): AITool[] => {
  const {
    hasActiveSeat,
    aiLessonEnabled,
    aiGradingEnabled,
    aiHelperEnabled,
    canCreateAssignments,
    canGradeAssignments,
    t,
    isPreschool = false,
  } = params;

  return [
    {
      id: "lesson-generator",
      title: isPreschool ? "Preschool Lesson Creator" : "AI Lesson Generator",
      subtitle: isPreschool ? "Create age-appropriate lessons with insights & homework" : "Create engaging lessons with AI",
      icon: "bulb",
      color: isPreschool ? "#FF6B6B" : "#4F46E5",
      onPress: () => {
        if (!hasActiveSeat && (!aiLessonEnabled || !canCreateAssignments)) {
          Alert.alert(
            t("dashboard.ai_upgrade_required_title", { defaultValue: "Upgrade Required" }),
            t("dashboard.ai_upgrade_required_message", {
              defaultValue: "Your plan does not include this AI feature or your seat is not active.",
            }),
          );
          return;
        }
        if (hasActiveSeat && !aiLessonEnabled) {
          Alert.alert("AI Feature Disabled", "AI Lesson Generator is not enabled in this build.");
          return;
        }
        track("edudash.ai.lesson_generator_opened", { isPreschool });
        // Route to the lesson generator (preschool uses same route now)
        router.push(getTeacherRoute('create_lesson'));
      },
    },
    {
      id: "homework-grader",
      title: "Grade Homework",
      subtitle: "Auto-grade assignments with AI",
      icon: "checkmark-circle",
      color: "#059669",
      onPress: () => {
        if (!hasActiveSeat && (!aiGradingEnabled || !canGradeAssignments)) {
          Alert.alert(
            t("dashboard.ai_upgrade_required_title", { defaultValue: "Upgrade Required" }),
            t("dashboard.ai_upgrade_required_message", {
              defaultValue: "Your plan does not include this AI feature or your seat is not active.",
            }),
          );
          return;
        }
        if (hasActiveSeat && !aiGradingEnabled) {
          Alert.alert("AI Feature Disabled", "AI Homework Grader is not enabled in this build.");
          return;
        }
        track("edudash.ai.homework_grader_opened");
        router.push(getTeacherRoute('homework_grader'));
      },
    },
    {
      id: "homework-helper",
      title: "Homework Helper",
      subtitle: "Child-safe, step-by-step guidance",
      icon: "help-circle",
      color: "#2563EB",
      onPress: () => {
        if (!aiHelperEnabled) {
          Alert.alert("AI Tool Disabled", "AI Homework Helper is not enabled for this build.");
          return;
        }
        track("edudash.ai.homework_helper_opened");
        router.push(getTeacherRoute('homework_helper'));
      },
    },
    {
      id: "progress-analysis",
      title: "Progress Analysis",
      subtitle: "AI-powered student insights",
      icon: "analytics",
      color: "#7C3AED",
      onPress: () => {
        track("edudash.ai.progress_analysis_opened");
        router.push(getTeacherRoute('progress_analysis'));
      },
    },
  ];
};

interface BuildQuickActionsParams {
  hasCap: (cap: string) => boolean;
  maybeShowInterstitial: (placement: string) => Promise<void>;
  connectionStatus: { isConnected: boolean };
  isWhatsAppEnabled: () => boolean;
  setShowWhatsAppModal: (show: boolean) => void;
}

export const buildQuickActions = (params: BuildQuickActionsParams): QuickAction[] => {
  const {
    hasCap,
    maybeShowInterstitial,
    connectionStatus,
    isWhatsAppEnabled,
    setShowWhatsAppModal,
  } = params;

  const actions: QuickAction[] = [
    {
      id: "dash-chat",
      title: "Chat with Dash",
      icon: "chatbubbles",
      color: "#6366F1",
      onPress: () => {
        router.push(getTeacherRoute('ai_assistant'));
      },
    },
    {
      id: "take-attendance",
      title: "Take Attendance",
      icon: "checkmark-done",
      color: "#059669",
      onPress: () => {
        router.push(getTeacherRoute('take_attendance'));
      },
      requiredCap: "manage_classes",
    },
    {
      id: "lessons-hub",
      title: "Lessons Hub",
      icon: "library-outline",
      color: "#4F46E5",
      onPress: async () => {
        await maybeShowInterstitial('teacher_dashboard_lessons_hub');
        router.push(getTeacherRoute('browse_lessons'));
      },
      requiredCap: "create_assignments",
    },
    {
      id: "saved-lessons",
      title: "Saved Lessons",
      icon: "library",
      color: "#EC4899",
      onPress: async () => {
        await maybeShowInterstitial('teacher_dashboard_saved_lessons');
        router.push(getTeacherRoute('browse_lessons'));
      },
      requiredCap: "create_assignments",
    },
    {
      id: "message-parents",
      title: "Message Parents",
      icon: "mail",
      color: "#7C3AED",
      onPress: async () => {
        await maybeShowInterstitial('teacher_dashboard_message_parents');
        router.push(getTeacherRoute('messages'));
      },
      requiredCap: "communicate_with_parents",
    },
    {
      id: "view-reports",
      title: "View Reports",
      icon: "document-text",
      color: "#DC2626",
      onPress: async () => {
        await maybeShowInterstitial('teacher_dashboard_view_reports');
        router.push(getTeacherRoute('student_reports'));
      },
      requiredCap: "view_class_analytics",
    },
    {
      id: "create-progress-report",
      title: "Progress Reports",
      icon: "school",
      color: "#8B5CF6",
      onPress: () => {
        track('edudash.progress_reports.quick_action_pressed');
        router.push(getTeacherRoute('student_reports'));
      },
      requiredCap: "manage_students",
    },
    {
      id: "whatsapp-connect",
      title: connectionStatus.isConnected ? "WhatsApp Connected" : "Connect WhatsApp",
      icon: "logo-whatsapp",
      color: "#25D366",
      onPress: () => {
        track('edudash.whatsapp.quick_action_pressed', {
          connected: connectionStatus.isConnected,
          timestamp: new Date().toISOString()
        });
        setShowWhatsAppModal(true);
      },
    },
  ];

  return actions.filter((action) => {
    // Check capability requirements
    if (action.requiredCap && !hasCap(action.requiredCap)) {
      return false;
    }
    // Special logic for WhatsApp
    if (action.id === 'whatsapp-connect' && !isWhatsAppEnabled()) {
      return false;
    }
    return true;
  });
};
