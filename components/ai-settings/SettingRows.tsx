/**
 * Reusable setting row components for AI settings
 */
import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';

interface ToggleSettingProps {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  theme: any;
}

export function ToggleSetting({ title, subtitle, value, onValueChange, theme }: ToggleSettingProps) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: `${theme.primary}40` }}
        thumbColor={value ? theme.primary : '#f4f3f4'}
      />
    </View>
  );
}

interface SliderSettingProps {
  title: string;
  subtitle: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  theme: any;
}

export function SliderSetting({ title, subtitle, value, onValueChange, min, max, step, theme }: SliderSettingProps) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        <Text style={[styles.sliderValue, { color: theme.primary }]}>
          Current: {value.toFixed(1)}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={theme.primary}
        maximumTrackTintColor={theme.border}
        thumbTintColor={theme.primary}
      />
    </View>
  );
}

interface PickerOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface PickerSettingProps {
  title: string;
  subtitle: string;
  value: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
  theme: any;
}

export function PickerSetting({ title, subtitle, value, options, onValueChange, theme }: PickerSettingProps) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <View style={styles.pickerContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerOption,
              { 
                backgroundColor: value === option.value ? theme.primary : 'transparent',
                borderColor: theme.border,
                opacity: option.disabled ? 0.4 : 1
              }
            ]}
            onPress={() => !option.disabled && onValueChange(option.value)}
            disabled={option.disabled}
          >
            <Text style={[
              styles.pickerOptionText,
              { color: value === option.value ? 'white' : option.disabled ? theme.textSecondary : theme.text }
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

interface TextInputSettingProps {
  title: string;
  subtitle: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  theme: any;
  numberOfLines?: number;
}

export function TextInputSetting({ title, subtitle, value, onChangeText, placeholder, theme, numberOfLines = 3 }: TextInputSettingProps) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <TextInput
        style={[styles.textInput, { 
          color: theme.text, 
          borderColor: theme.border,
          backgroundColor: theme.background 
        }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={numberOfLines}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    padding: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
