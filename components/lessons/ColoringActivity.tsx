/**
 * Coloring Activity Component
 * 
 * Simple coloring activity with color picker.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

interface ColoringActivityProps {
  content: {
    outlineUrl: string;
    colorPalette: string[];
  };
  onComplete: (score: number) => void;
  theme: any;
}

export function ColoringActivity({ content, onComplete, theme }: ColoringActivityProps) {
  const [selectedColor, setSelectedColor] = useState(content.colorPalette[0]);
  const [colorsUsed, setColorsUsed] = useState<Set<string>>(new Set());

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setColorsUsed(prev => new Set([...prev, color]));
  };

  const handleComplete = () => {
    // Score based on number of different colors used
    const score = Math.min(100, Math.round((colorsUsed.size / content.colorPalette.length) * 100));
    onComplete(score);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.canvas, { backgroundColor: theme.card }]}>
        <Image source={{ uri: content.outlineUrl }} style={styles.outlineImage} resizeMode="contain" />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Tap on the colors below to paint
        </Text>
      </View>

      <View style={styles.colorPalette}>
        {content.colorPalette.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: color },
              selectedColor === color && styles.selectedColor,
            ]}
            onPress={() => handleColorSelect(color)}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.completeButton, { backgroundColor: theme.success }]}
        onPress={handleComplete}
      >
        <Text style={styles.completeButtonText}>Done Coloring!</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  canvas: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineImage: {
    width: '100%',
    height: '80%',
  },
  hint: {
    marginTop: 12,
    fontSize: 14,
    fontStyle: 'italic',
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#000',
    borderWidth: 4,
  },
  completeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
