import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

type ColumnStep = {
  colRight: number;
  placeLabel: string;
  digits: number[];
  carryIn: number;
  total: number;
  writeDigit: number;
  carryOut: number;
};

export interface ColumnMethodPayload {
  type: 'column_addition';
  question?: string;
  expression?: string;
  addends: number[];
  result?: number;
  show_carry?: boolean;
}

interface InlineColumnMethodCardProps {
  payload: ColumnMethodPayload;
  onComplete?: (summary: string) => void;
}

const COLUMN_FENCE_REGEX = /```column(?:[_-]?method)?\s*\n?([\s\S]*?)```/i;

const PLACE_NAMES = [
  'Units',
  'Tens',
  'Hundreds',
  'Thousands',
  'Ten-thousands',
  'Hundred-thousands',
  'Millions',
];

const toInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(Math.trunc(value));
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    if (Number.isFinite(parsed)) return Math.abs(Math.trunc(parsed));
  }
  return null;
};

const extractNumbers = (source: string): number[] => {
  const tokens = [...String(source || '').matchAll(/\b\d{1,3}(?:,\d{3})*|\b\d+\b/g)];
  return tokens
    .map((match) => toInt(match[0]))
    .filter((value): value is number => typeof value === 'number');
};

const coerceColumnPayload = (value: unknown): ColumnMethodPayload | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const rawAddends = Array.isArray(raw.addends) ? raw.addends : [];
  const addends = rawAddends
    .map((entry) => toInt(entry))
    .filter((entry): entry is number => typeof entry === 'number');

  if (addends.length < 2) {
    const expression = String(raw.expression || raw.question || '');
    const inferred = extractNumbers(expression);
    if (inferred.length >= 2) {
      return {
        type: 'column_addition',
        question: typeof raw.question === 'string' ? raw.question : undefined,
        expression: typeof raw.expression === 'string' ? raw.expression : undefined,
        addends: inferred.slice(0, 4),
        result: toInt(raw.result ?? null) ?? undefined,
        show_carry: raw.show_carry !== false,
      };
    }
    return null;
  }

  return {
    type: 'column_addition',
    question: typeof raw.question === 'string' ? raw.question : undefined,
    expression: typeof raw.expression === 'string' ? raw.expression : undefined,
    addends: addends.slice(0, 6),
    result: toInt(raw.result ?? null) ?? undefined,
    show_carry: raw.show_carry !== false,
  };
};

export function parseColumnMethodPayload(content: string): ColumnMethodPayload | null {
  const text = String(content || '').trim();
  if (!text) return null;

  const fenced = text.match(COLUMN_FENCE_REGEX);
  if (fenced?.[1]) {
    try {
      return coerceColumnPayload(JSON.parse(fenced[1].trim()));
    } catch {
      return null;
    }
  }

  try {
    return coerceColumnPayload(JSON.parse(text));
  } catch {
    return null;
  }
}

function buildColumnModel(addends: number[]) {
  const normalized = addends.map((value) => Math.abs(Math.trunc(value)));
  const sum = normalized.reduce((acc, value) => acc + value, 0);
  const addendStrings = normalized.map((value) => String(value));
  const maxAddendDigits = Math.max(...addendStrings.map((value) => value.length));
  const resultString = String(sum);
  const columns = Math.max(maxAddendDigits, resultString.length);

  const steps: ColumnStep[] = [];
  const carryInByColRight = new Map<number, number>();
  let carry = 0;

  for (let colRight = 0; colRight < columns; colRight += 1) {
    const digits = addendStrings.map((value) => {
      const char = value[value.length - 1 - colRight];
      return char ? Number(char) : 0;
    });
    const total = carry + digits.reduce((acc, value) => acc + value, 0);
    const writeDigit = total % 10;
    const carryOut = Math.floor(total / 10);
    const carryIn = carry;
    carryInByColRight.set(colRight, carryIn);
    steps.push({
      colRight,
      placeLabel: PLACE_NAMES[colRight] || `10^${colRight}`,
      digits,
      carryIn,
      total,
      writeDigit,
      carryOut,
    });
    carry = carryOut;
  }

  const paddedAddends = addendStrings.map((value) => value.padStart(columns, ' '));
  const paddedResult = resultString.padStart(columns, ' ');
  return {
    addends: normalized,
    sum,
    steps,
    columns,
    paddedAddends,
    paddedResult,
    carryInByColRight,
  };
}

export const InlineColumnMethodCard: React.FC<InlineColumnMethodCardProps> = ({
  payload,
  onComplete,
}) => {
  const { theme, isDark } = useTheme();
  const [revealedSteps, setRevealedSteps] = useState(0);
  const completionSentRef = useRef(false);

  const model = useMemo(() => buildColumnModel(payload.addends), [payload.addends]);
  const totalSteps = model.steps.length;
  const completed = revealedSteps >= totalSteps;
  const showCarry = payload.show_carry !== false;
  const activeStep = revealedSteps > 0
    ? model.steps[Math.min(revealedSteps - 1, totalSteps - 1)]
    : null;

  useEffect(() => {
    if (!completed || completionSentRef.current) return;
    completionSentRef.current = true;
    onComplete?.(`${model.addends.join(' + ')} = ${model.sum}`);
  }, [completed, model.addends, model.sum, onComplete]);

  const handleNextStep = useCallback(() => {
    setRevealedSteps((prev) => Math.min(totalSteps, prev + 1));
  }, [totalSteps]);

  const handleRevealAll = useCallback(() => {
    setRevealedSteps(totalSteps);
  }, [totalSteps]);

  const handleReset = useCallback(() => {
    completionSentRef.current = false;
    setRevealedSteps(0);
  }, []);

  const headerBg = isDark ? '#1e293b' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#dbe2ea';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const rowBg = isDark ? '#0f172a' : '#ffffff';

  return (
    <View style={[styles.card, { backgroundColor: headerBg, borderColor }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: textColor }]}>Column Method</Text>
        <Text style={[styles.stepCounter, { color: mutedColor }]}>
          Step {Math.min(revealedSteps, totalSteps)}/{totalSteps}
        </Text>
      </View>

      {payload.question ? (
        <Text style={[styles.question, { color: mutedColor }]}>{payload.question}</Text>
      ) : null}

      <View style={[styles.grid, { borderColor, backgroundColor: rowBg }]}>
        {showCarry ? (
          <View style={styles.gridRow}>
            <Text style={[styles.sign, { color: mutedColor }]}>c</Text>
            {Array.from({ length: model.columns }).map((_, colIndex) => {
              const colRight = model.columns - 1 - colIndex;
              const carry = model.carryInByColRight.get(colRight) || 0;
              const isRevealed = completed || revealedSteps > colRight;
              const displayCarry = isRevealed && carry > 0 ? String(carry) : '';
              return (
                <Text key={`carry-${colIndex}`} style={[styles.cellCarry, { color: mutedColor }]}>
                  {displayCarry || '\u00A0'}
                </Text>
              );
            })}
          </View>
        ) : null}

        {model.paddedAddends.map((value, rowIndex) => {
          const sign = rowIndex === 0 ? '' : '+';
          return (
            <View key={`addend-${rowIndex}`} style={styles.gridRow}>
              <Text style={[styles.sign, { color: textColor }]}>{sign}</Text>
              {value.split('').map((char, colIndex) => {
                const colRight = model.columns - 1 - colIndex;
                const isActive = !!activeStep && activeStep.colRight === colRight;
                return (
                  <Text
                    key={`digit-${rowIndex}-${colIndex}`}
                    style={[
                      styles.cell,
                      { color: textColor },
                      isActive ? { backgroundColor: theme.colors.primary + '22', borderRadius: 6 } : null,
                    ]}
                  >
                    {char.trim()}
                  </Text>
                );
              })}
            </View>
          );
        })}

        <View style={[styles.divider, { backgroundColor: borderColor }]} />

        <View style={styles.gridRow}>
          <Text style={[styles.sign, { color: textColor }]}>=</Text>
          {model.paddedResult.split('').map((char, colIndex) => {
            const colRight = model.columns - 1 - colIndex;
            const isRevealed = completed || revealedSteps > colRight;
            const displayChar = isRevealed ? (char.trim() || '') : '_';
            return (
              <Text
                key={`result-${colIndex}`}
                style={[
                  styles.cellResult,
                  { color: isRevealed ? theme.colors.primary : mutedColor },
                ]}
              >
                {displayChar || '\u00A0'}
              </Text>
            );
          })}
        </View>
      </View>

      <View style={[styles.explainBox, { borderColor, backgroundColor: rowBg }]}>
        {activeStep ? (
          <Text style={[styles.explainText, { color: textColor }]}>
            <Text style={{ fontWeight: '700' }}>{activeStep.placeLabel}: </Text>
            {activeStep.digits.join(' + ')}
            {activeStep.carryIn > 0 ? ` + carry ${activeStep.carryIn}` : ''}
            {` = ${activeStep.total}. Write ${activeStep.writeDigit}`}
            {activeStep.carryOut > 0 ? `, carry ${activeStep.carryOut}.` : '.'}
          </Text>
        ) : (
          <Text style={[styles.explainText, { color: mutedColor }]}>
            Tap <Text style={{ fontWeight: '700', color: textColor }}>Next step</Text> to learn each column from right to left.
          </Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        {!completed ? (
          <>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={handleNextStep}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Next Step</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonGhost, { borderColor }]}
              onPress={handleRevealAll}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonGhostText, { color: textColor }]}>Show Answer</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleReset}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '600',
  },
  question: {
    fontSize: 12,
    lineHeight: 18,
  },
  grid: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sign: {
    width: 14,
    marginRight: 6,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    fontFamily: 'monospace',
    minHeight: 30,
  },
  cellCarry: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    minHeight: 18,
  },
  cellResult: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '800',
    fontFamily: 'monospace',
    minHeight: 30,
  },
  divider: {
    height: 2,
    borderRadius: 999,
    marginVertical: 2,
  },
  explainBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  explainText: {
    fontSize: 13,
    lineHeight: 19,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonGhost: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  buttonGhostText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default InlineColumnMethodCard;
