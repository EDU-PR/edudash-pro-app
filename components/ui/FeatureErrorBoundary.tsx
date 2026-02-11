/**
 * FeatureErrorBoundary Component
 *
 * A feature-scoped error boundary that catches errors in critical sections
 * (finance, AI chat, video calls, messaging) without crashing the entire app.
 * Reports to Sentry with feature context and shows a retry-capable fallback.
 *
 * @example
 * <FeatureErrorBoundary feature="finance" label="Finance Dashboard">
 *   <FinanceControlCenter />
 * </FeatureErrorBoundary>
 */

import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Text } from './Text';
import { Button } from './Button';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Well-known feature areas for error grouping */
export type FeatureArea =
  | 'finance'
  | 'ai-chat'
  | 'video-call'
  | 'messaging'
  | 'lesson'
  | 'grading'
  | 'onboarding'
  | 'settings'
  | 'generic';

interface FeatureErrorBoundaryProps {
  /** Feature area identifier — used for Sentry tags and UI copy */
  feature: FeatureArea;
  /** Human-readable label shown in the fallback UI */
  label?: string;
  /** Optional custom fallback renderer */
  renderFallback?: (error: Error, retry: () => void) => ReactNode;
  /** Called when an error is caught (in addition to Sentry) */
  onError?: (error: Error, feature: FeatureArea) => void;
  children: ReactNode;
}

interface FeatureErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

// ─── Friendly messages per feature ────────────────────────────────────────────

const FEATURE_MESSAGES: Record<FeatureArea, string> = {
  finance: 'The finance section encountered an issue. Your data is safe.',
  'ai-chat': 'The AI assistant ran into a problem. Please try again.',
  'video-call': 'The video call feature experienced an error.',
  messaging: 'Messaging hit a snag. Your messages are safe.',
  lesson: 'Lesson content could not load properly.',
  grading: 'The grading tool encountered an issue.',
  onboarding: 'The setup wizard hit an unexpected error.',
  settings: 'Settings could not be loaded correctly.',
  generic: 'This section encountered an unexpected error.',
};

const MAX_AUTO_RETRIES = 2;

// ─── Component ────────────────────────────────────────────────────────────────

export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<FeatureErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { feature, onError } = this.props;

    // Report to Sentry with feature context
    try {
      Sentry.withScope((scope) => {
        scope.setTag('feature', feature);
        scope.setTag('error_boundary', 'FeatureErrorBoundary');
        scope.setExtra('componentStack', errorInfo.componentStack);
        scope.setExtra('retryCount', this.state.retryCount);
        Sentry.captureException(error);
      });
    } catch {
      // Sentry may not be initialised in dev — swallow
    }

    onError?.(error, feature);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { feature, label, renderFallback, children } = this.props;

    if (!hasError) return children;

    // Custom fallback renderer takes priority
    if (renderFallback && error) {
      return renderFallback(error, this.handleRetry);
    }

    const displayLabel = label || feature.replace(/-/g, ' ');
    const message = FEATURE_MESSAGES[feature] || FEATURE_MESSAGES.generic;
    const canRetry = retryCount < MAX_AUTO_RETRIES;

    return (
      <View style={styles.container} accessibilityRole="alert">
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        <Text variant="headline" style={styles.title}>
          {displayLabel} unavailable
        </Text>

        <Text variant="body" color="secondary" style={styles.message}>
          {message}
        </Text>

        {__DEV__ && error && (
          <View style={styles.devBox}>
            <Text variant="caption" style={styles.devText}>
              {error.name}: {error.message}
            </Text>
          </View>
        )}

        {canRetry ? (
          <Button
            onPress={this.handleRetry}
            style={styles.button}
            accessibilityLabel={`Retry ${displayLabel}`}
          >
            Try Again
          </Button>
        ) : (
          <Text variant="caption" color="secondary" style={styles.exhausted}>
            Multiple retries failed. Please restart the app or contact support.
          </Text>
        )}
      </View>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fefefe',
  },
  iconWrap: {
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  devBox: {
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    maxWidth: '90%',
  },
  devText: {
    fontSize: 11,
    color: '#c00',
    fontFamily: 'monospace',
  },
  button: {
    minWidth: 140,
  },
  exhausted: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
});

export default FeatureErrorBoundary;
