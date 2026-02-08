/**
 * LearningHubPathBoard — Robot path grid visualisation
 * 
 * Renders the interactive grid board for the Robot Pathfinder activity.
 * Shows start, goal, obstacles, robot position, and trail.
 * 
 * ≤120 lines — WARP-compliant presentational component.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  type GridCoord,
  type PathBoard,
  type StepOption,
  formatSequence,
  simulateRobotPath,
} from '@/lib/activities/preschoolLearningHub.data';

const sameCoord = (a: GridCoord, b: GridCoord): boolean => a.row === b.row && a.col === b.col;
const coordKey = (coord: GridCoord): string => `${coord.row}:${coord.col}`;

interface LearningHubPathBoardProps {
  board: PathBoard;
  selectedOption: StepOption | null;
}

export const LearningHubPathBoard = memo(function LearningHubPathBoard({
  board,
  selectedOption,
}: LearningHubPathBoardProps) {
  const { theme } = useTheme();
  const obstacleSet = new Set((board.obstacles || []).map(coordKey));
  const selectedSequence = selectedOption?.sequence || [];
  const simulation = selectedOption?.sequence ? simulateRobotPath(board, selectedSequence) : null;
  const robotPosition = simulation?.final || board.start;

  const trailMap = new Map<string, number>();
  if (simulation) {
    simulation.visited.forEach((coord, idx) => {
      trailMap.set(coordKey(coord), idx);
    });
  }

  return (
    <View style={[styles.boardCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Text style={[styles.boardTitle, { color: theme.text }]}>Path Board</Text>
      <Text style={[styles.boardLegend, { color: theme.textSecondary }]}>
        🚩 Start   ⭐ Goal   🧱 Blocked   🤖 Robo
      </Text>

      <View style={styles.boardGrid}>
        {Array.from({ length: board.rows }).map((_, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.boardRow}>
            {Array.from({ length: board.cols }).map((_, colIndex) => {
              const cell = { row: rowIndex, col: colIndex };
              const key = coordKey(cell);
              const isObstacle = obstacleSet.has(key);
              const isGoal = sameCoord(cell, board.goal);
              const isStart = sameCoord(cell, board.start);
              const isRobot = sameCoord(cell, robotPosition);
              const trailIndex = trailMap.get(key);

              let glyph = '';
              if (isObstacle) glyph = '🧱';
              else if (isRobot) glyph = '🤖';
              else if (isGoal) glyph = '⭐';
              else if (isStart) glyph = '🚩';

              return (
                <View key={`cell-${rowIndex}-${colIndex}`} style={[styles.boardCell, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  {!!glyph && <Text style={styles.boardGlyph}>{glyph}</Text>}
                  {typeof trailIndex === 'number' && trailIndex > 0 && !isObstacle && !isRobot && (
                    <Text style={[styles.boardTrail, { color: theme.textSecondary }]}>{trailIndex}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {!!selectedOption?.sequence && (
        <View style={[styles.previewCard, simulation?.reachedGoal ? styles.previewCardSuccess : styles.previewCardError]}>
          <Text style={styles.previewTitle}>Selected route</Text>
          <Text style={styles.previewSequence}>{formatSequence(selectedOption.sequence)}</Text>
          <Text style={styles.previewText}>{simulation?.message || 'Choose a route to preview.'}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  boardCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  boardTitle: { fontSize: 14, fontWeight: '800' },
  boardLegend: { fontSize: 12 },
  boardGrid: { gap: 6, alignSelf: 'center', marginTop: 4, marginBottom: 2 },
  boardRow: { flexDirection: 'row', gap: 6 },
  boardCell: { width: 56, height: 56, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boardGlyph: { fontSize: 22 },
  boardTrail: { position: 'absolute', bottom: 4, right: 6, fontSize: 10, fontWeight: '700' },
  previewCard: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  previewCardSuccess: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  previewCardError: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  previewTitle: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  previewSequence: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  previewText: { fontSize: 12, lineHeight: 17, color: '#374151' },
});

export default LearningHubPathBoard;
