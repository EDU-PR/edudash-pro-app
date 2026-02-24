/**
 * DashTutorWhiteboard — Interactive whiteboard for concept explanations
 *
 * Appears when Dash explains a concept (e.g. multiplication) with [WHITEBOARD]...[/WHITEBOARD].
 * Teacher-at-board style: student sees the explanation, then confirms understanding to dismiss.
 * Only shown for concept explanations, not randomly.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

// Always create a fresh regex instance — module-level `g`/`gi` regexes are stateful
// and cause .exec() to return null on subsequent calls once lastIndex advances past a match.
function whiteboardRegex(): RegExp {
  return /\[WHITEBOARD\]([\s\S]*?)\[\/WHITEBOARD\]/gi;
}

// Matches orphan/unclosed WHITEBOARD tags (e.g. AI omits closing tag)
function orphanTagRegex(): RegExp {
  return /\[\/?\s*WHITEBOARD\s*\]/gi;
}

export interface WhiteboardContent {
  raw: string;
  lines: string[];
}

/** Extract whiteboard content from AI response. Returns null if none. */
export function extractWhiteboardContent(response: string): WhiteboardContent | null {
  const match = whiteboardRegex().exec(response);
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  if (!raw) return null;
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { raw, lines };
}

/** Strip [WHITEBOARD]...[/WHITEBOARD] blocks (and orphan tags) from display text. */
export function stripWhiteboardFromDisplay(text: string): string {
  return text
    .replace(whiteboardRegex(), '')
    .replace(orphanTagRegex(), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface DashTutorWhiteboardProps {
  content: WhiteboardContent;
  onDismiss: () => void;
  onUnderstood?: () => void;
}

export function DashTutorWhiteboard({
  content,
  onDismiss,
  onUnderstood,
}: DashTutorWhiteboardProps) {
  const { theme } = useTheme();

  const handleUnderstood = useCallback(() => {
    onUnderstood?.();
    onDismiss();
  }, [onDismiss, onUnderstood]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: 16,
        },
        board: {
          backgroundColor: '#f8f9fa',
          borderRadius: 16,
          width: '100%',
          maxWidth: 400,
          maxHeight: '70%',
          borderWidth: 2,
          borderColor: theme.border || '#e2e8f0',
          ...Platform.select({
            web: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
            default: { elevation: 8 },
          }),
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border || '#e2e8f0',
        },
        title: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.text || '#1e293b',
        },
        closeBtn: {
          padding: 4,
        },
        scroll: {
          padding: 20,
          maxHeight: 320,
        },
        line: {
          fontSize: 18,
          lineHeight: 28,
          color: theme.text || '#334155',
          marginBottom: 8,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        step: {
          fontSize: 16,
          lineHeight: 24,
          color: theme.text || '#475569',
          marginBottom: 6,
          paddingLeft: 8,
          borderLeftWidth: 3,
          borderLeftColor: theme.primary || '#6366f1',
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 12,
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: theme.border || '#e2e8f0',
        },
        btn: {
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        btnSecondary: {
          backgroundColor: theme.surface || '#f1f5f9',
        },
        btnPrimary: {
          backgroundColor: theme.primary || '#6366f1',
        },
        btnText: {
          fontSize: 15,
          fontWeight: '600',
        },
      }),
    [theme]
  );

  const renderLine = (line: string, i: number) => {
    const isStep = /^\d+[.)]\s/.test(line) || line.startsWith('- ') || line.startsWith('• ');
    return (
      <Text key={i} style={isStep ? styles.step : styles.line}>
        {line}
      </Text>
    );
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.board}>
        <View style={styles.header}>
          <Text style={styles.title}>Whiteboard</Text>
          <TouchableOpacity onPress={onDismiss} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={theme.textSecondary || '#64748b'} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
          {content.lines.map(renderLine)}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={onDismiss}
          >
            <Text style={[styles.btnText, { color: theme.text }]}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleUnderstood}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff' }]}>I understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
