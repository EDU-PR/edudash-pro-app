import { track } from '@/lib/analytics';

type ClampPercentOptions = {
  defaultValue?: number;
  source?: string;
  suppressTelemetry?: boolean;
};

/**
 * Clamp an arbitrary numeric input to a valid percentage range [0, 100].
 * Emits telemetry when invalid values are encountered so regressions are visible.
 */
export function clampPercent(
  rawValue: unknown,
  options: ClampPercentOptions = {},
): number {
  const defaultValue = Number.isFinite(options.defaultValue) ? Number(options.defaultValue) : 0;
  const source = options.source || 'unknown';
  const suppressTelemetry = options.suppressTelemetry === true;

  const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(numeric)) {
    if (!suppressTelemetry) {
      track('progress.invalid_percent', {
        source,
        reason: 'non_finite',
        raw_value: String(rawValue),
      });
    }
    return Math.max(0, Math.min(100, defaultValue));
  }

  if (numeric < 0 || numeric > 100) {
    if (!suppressTelemetry) {
      track('progress.invalid_percent', {
        source,
        reason: numeric < 0 ? 'negative' : 'overflow',
        raw_value: numeric,
      });
    }
  }

  return Math.max(0, Math.min(100, numeric));
}

/**
 * Convert ratio to percentage and clamp to [0, 100].
 */
export function ratioToPercent(
  numerator: number,
  denominator: number,
  options: ClampPercentOptions = {},
): number {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return clampPercent(options.defaultValue ?? 0, {
      ...options,
      source: options.source || 'ratio_to_percent.invalid_denominator',
    });
  }
  return clampPercent((numerator / denominator) * 100, options);
}

