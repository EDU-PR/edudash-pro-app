import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';
import { getDashModelColor } from '@/lib/ai/modelPalette';

const COST_DOTS = (cost: number): string => {
  if (cost <= 1) return '●';
  if (cost <= 5) return '●●';
  return '●●●';
};

type AnchorFrame = { x: number; y: number; width: number; height: number };

interface CompactModelPickerProps {
  models: AIModelInfo[];
  selectedModelId: AIModelId | string;
  canSelectModel?: (modelId: AIModelId) => boolean;
  onSelectModel: (modelId: AIModelId) => void;
  onLockedPress?: (modelId: AIModelId) => void;
  disabled?: boolean;
  maxPopoverWidth?: number;
}

export function CompactModelPicker({
  models,
  selectedModelId,
  canSelectModel,
  onSelectModel,
  onLockedPress,
  disabled = false,
  maxPopoverWidth = 260,
}: CompactModelPickerProps) {
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  const triggerRef = useRef<View | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorFrame>({ x: 0, y: 0, width: 34, height: 34 });

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || models[0],
    [models, selectedModelId]
  );

  if (!selectedModel) return null;

  const selectedColor = getDashModelColor(selectedModel.id, theme.primary);
  const popoverWidth = Math.min(maxPopoverWidth, Math.max(220, windowWidth - 24));
  const left = Math.min(
    Math.max(12, anchor.x + anchor.width - popoverWidth),
    Math.max(12, windowWidth - popoverWidth - 12)
  );
  const top = Math.max(12, Math.min(anchor.y + anchor.height + 8, windowHeight - 320));

  const openPicker = () => {
    if (disabled) return;
    const node = triggerRef.current as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
    if (!node?.measureInWindow) {
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const closePicker = () => setOpen(false);

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity
          style={[
            styles.trigger,
            {
              backgroundColor: `${selectedColor}36`,
              borderColor: `${selectedColor}B0`,
              opacity: disabled ? 0.55 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Model selector. Active model ${selectedModel.displayName}.`}
          disabled={disabled}
          onPress={openPicker}
        >
          <Ionicons name="hardware-chip-outline" size={16} color={selectedColor} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePicker}
      >
        <Pressable style={styles.backdrop} onPress={closePicker}>
          <Pressable
            style={[
              styles.popover,
              {
                top,
                left,
                width: popoverWidth,
                maxHeight: windowHeight * 0.6,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.textSecondary }]}>Select Model</Text>
              <TouchableOpacity
                onPress={closePicker}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close model picker"
              >
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {models.map((model) => {
              const modelColor = getDashModelColor(model.id, theme.primary);
              const locked = canSelectModel ? !canSelectModel(model.id) : false;
              const active = model.id === selectedModelId;
              return (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.row,
                    {
                      borderColor: active ? `${modelColor}BB` : theme.border,
                      backgroundColor: active ? `${modelColor}28` : theme.surfaceVariant,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locked
                      ? `${model.displayName}. Locked. Requires ${model.minTier} tier.`
                      : `${model.displayName}. Select model.`
                  }
                  onPress={() => {
                    if (locked) {
                      closePicker();
                      onLockedPress?.(model.id);
                      return;
                    }
                    onSelectModel(model.id);
                    setTimeout(closePicker, 250);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: modelColor }]} />
                  <View style={styles.rowContent}>
                    <Text style={[styles.name, { color: active ? modelColor : theme.text }]}>
                      {model.displayName}
                    </Text>
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>
                      {locked ? `Requires ${model.minTier}` : `${COST_DOTS(model.relativeCost)} usage`}
                    </Text>
                  </View>
                  <Ionicons
                    name={locked ? 'lock-closed' : active ? 'checkmark-circle' : 'chevron-forward'}
                    size={16}
                    color={locked ? theme.textSecondary : active ? modelColor : theme.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default CompactModelPicker;

const styles = StyleSheet.create({
  trigger: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  popover: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowContent: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
});
