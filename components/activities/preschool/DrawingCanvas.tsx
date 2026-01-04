/**
 * Drawing Canvas Component for Preschoolers
 * 
 * A simple touch-based drawing canvas for young children with
 * large brush sizes, bright colors, and easy-to-use tools.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Alert,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useTheme } from '../../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// ====================================================================
// TYPES
// ====================================================================

interface DrawingPath {
  id: string;
  color: string;
  strokeWidth: number;
  points: string;
}

interface DrawingCanvasProps {
  /** Title shown at top */
  title?: string;
  /** Initial background color */
  backgroundColor?: string;
  /** Called when drawing is saved */
  onSave?: (paths: DrawingPath[]) => void;
  /** Called when user exits */
  onExit?: () => void;
  /** Available colors (defaults to kid-friendly palette) */
  colors?: string[];
  /** Available brush sizes */
  brushSizes?: number[];
}

// ====================================================================
// CONSTANTS
// ====================================================================

const DEFAULT_COLORS = [
  '#FF5252', // Red
  '#FF9800', // Orange
  '#FFEB3B', // Yellow
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#E91E63', // Pink
  '#795548', // Brown
  '#000000', // Black
  '#FFFFFF', // White (eraser effect on white bg)
];

const DEFAULT_BRUSH_SIZES = [8, 16, 24];

// ====================================================================
// COMPONENT
// ====================================================================

export function DrawingCanvas({
  title = 'Draw Something!',
  backgroundColor = '#FFFFFF',
  onSave,
  onExit,
  colors = DEFAULT_COLORS,
  brushSizes = DEFAULT_BRUSH_SIZES,
}: DrawingCanvasProps) {
  const { colors: themeColors, isDark } = useTheme();
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [brushSize, setBrushSize] = useState(brushSizes[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const pathIdRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setIsDrawing(true);
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => prev ? `${prev} L${locationX},${locationY}` : `M${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          const newPath: DrawingPath = {
            id: `path-${pathIdRef.current++}`,
            color: selectedColor,
            strokeWidth: brushSize,
            points: currentPath,
          };
          setPaths(prev => [...prev, newPath]);
        }
        setCurrentPath(null);
        setIsDrawing(false);
      },
    })
  ).current;

  const handleUndo = useCallback(() => {
    setPaths(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear Drawing?',
      'This will erase everything!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setPaths([]) },
      ]
    );
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(paths);
    Alert.alert('Saved!', 'Your drawing has been saved! 🎨');
  }, [paths, onSave]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.cardBackground }]}>
        <TouchableOpacity onPress={onExit} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Ionicons name="checkmark" size={28} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={[styles.canvasContainer, { backgroundColor }]} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          <G>
            {paths.map(path => (
              <Path
                key={path.id}
                d={path.points}
                stroke={path.color}
                strokeWidth={path.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath && (
              <Path
                d={currentPath}
                stroke={selectedColor}
                strokeWidth={brushSize}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </G>
        </Svg>
      </View>

      {/* Tools */}
      <View style={[styles.toolsContainer, { backgroundColor: themeColors.cardBackground }]}>
        {/* Color Palette */}
        <View style={styles.colorPalette}>
          {colors.map(color => (
            <TouchableOpacity
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.colorButton,
                { backgroundColor: color },
                color === '#FFFFFF' && { borderWidth: 1, borderColor: '#ccc' },
                selectedColor === color && styles.selectedColor,
              ]}
            />
          ))}
        </View>

        {/* Brush Sizes */}
        <View style={styles.brushSizes}>
          {brushSizes.map(size => (
            <TouchableOpacity
              key={size}
              onPress={() => setBrushSize(size)}
              style={[
                styles.brushButton,
                { borderColor: themeColors.border },
                brushSize === size && { borderColor: themeColors.primary, borderWidth: 2 },
              ]}
            >
              <View
                style={[
                  styles.brushPreview,
                  {
                    width: size,
                    height: size,
                    backgroundColor: selectedColor,
                    borderRadius: size / 2,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleUndo}
            disabled={paths.length === 0}
            style={[
              styles.actionButton,
              { backgroundColor: themeColors.border },
              paths.length === 0 && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="arrow-undo" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClear}
            disabled={paths.length === 0}
            style={[
              styles.actionButton,
              { backgroundColor: '#FF5252' },
              paths.length === 0 && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="trash" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  canvasContainer: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toolsContainer: {
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#333',
    transform: [{ scale: 1.1 }],
  },
  brushSizes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  brushButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brushPreview: {
    // Dynamic size set inline
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DrawingCanvas;
