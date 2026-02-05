/**
 * useExamDetection Hook
 * 
 * Detects when AI generates an exam and parses it for interactive display.
 * Used by DashAssistant to automatically show ExamInteractiveView.
 */

import { useState, useCallback, useEffect } from 'react';
import { parseExamMarkdown, ParsedExam } from '@/lib/examParser';
import { logger } from '@/lib/logger';
import type { DashMessage } from '@/services/dash-ai/types';

export interface DetectedExam {
  examId: string;
  exam: ParsedExam;
  messageId: string;
  detectedAt: string;
}

export function useExamDetection(messages: DashMessage[]) {
  const [detectedExam, setDetectedExam] = useState<DetectedExam | null>(null);

  /**
   * Check if message contains an exam
   */
  const detectExamInMessage = useCallback((message: DashMessage): DetectedExam | null => {
    const role = message.type === 'task_result' ? 'assistant' : message.type;
    if (role !== 'assistant' || !message.content) {
      return null;
    }

    const content = message.content;

    // Detect exam markers
    const examMarkers = [
      /# (.+(?:exam|test|assessment|quiz))/i,
      /## section \d+/i,
      /\d+\.\s+.+\s+\[(\d+)\s*marks?\]/i, // Question with marks
      /grade:\s*\d+/i,
      /subject:\s*.+/i,
      /total marks:\s*\d+/i,
    ];

    const hasExamMarkers = examMarkers.some(marker => marker.test(content));

    if (!hasExamMarkers) {
      return null;
    }

    // Try parsing as exam
    try {
      const parsedExam = parseExamMarkdown(content);

      if (!parsedExam || !parsedExam.sections || parsedExam.sections.length === 0) {
        return null;
      }

      // Validate it's a proper exam (has questions with marks)
      const hasValidQuestions = parsedExam.sections.some(
        section => section.questions && section.questions.length > 0
      );

      if (!hasValidQuestions) {
        return null;
      }

      logger.info('[ExamDetection] Detected exam in message', {
        messageId: message.id,
        title: parsedExam.title,
        totalQuestions: parsedExam.sections.reduce(
          (sum, s) => sum + s.questions.length,
          0
        ),
      });

      return {
        examId: `exam_${message.id}_${Date.now()}`,
        exam: parsedExam,
        messageId: message.id,
        detectedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.debug('[ExamDetection] Failed to parse as exam', { error });
      return null;
    }
  }, []);

  /**
   * Scan all messages for exams
   */
  const scanMessages = useCallback(() => {
    if (!messages || messages.length === 0) {
      return;
    }

    // Check most recent assistant message first
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const role = message.type === 'task_result' ? 'assistant' : message.type;
      if (role === 'assistant') {
        const detected = detectExamInMessage(message);
        if (detected) {
          setDetectedExam(detected);
          return;
        }
      }
    }

    // No exam found - clear detection
    setDetectedExam(null);
  }, [messages, detectExamInMessage]);

  /**
   * Clear detected exam
   */
  const clearDetectedExam = useCallback(() => {
    setDetectedExam(null);
  }, []);

  // Scan messages when they change
  useEffect(() => {
    scanMessages();
  }, [scanMessages]);

  return {
    detectedExam,
    clearDetectedExam,
    detectExamInMessage,
  };
}
