import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createDashboardStyles, SPACING, RADIUS, FONT_SIZE } from '@/lib/styles/dashboardTheme';

interface SearchBarProps {
  /**
   * Search query value
   */
  value: string;
  
  /**
   * Callback when search query changes
   */
  onChangeText: (text: string) => void;
  
  /**
   * Optional placeholder text
   */
  placeholder?: string;
  
  /**
   * Optional callback when search is submitted
   */
  onSubmit?: (query: string) => void;
  
  /**
   * Optional callback when search is cleared
   */
  onClear?: () => void;
  
  /**
   * Show clear button when there's text
   */
  showClearButton?: boolean;
  
  /**
   * Auto-focus on mount
   */
  autoFocus?: boolean;
  
  /**
   * Optional keyboard type
   */
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}

/**
 * SearchBar Component
 * 
 * Global search input with clear button and keyboard navigation.
 * 
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onChangeText={setSearchQuery}
 *   placeholder="Search activities, homework..."
 *   showClearButton
 *   onClear={() => setSearchQuery('')}
 * />
 * ```
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onSubmit,
  onClear,
  showClearButton = true,
  autoFocus = false,
  keyboardType = 'default',
}: SearchBarProps) {
  const { theme } = useTheme();
  const dashStyles = createDashboardStyles(theme);
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  const handleSubmit = () => {
    onSubmit?.(value);
  };

  return (
    <View
      style={[
        dashStyles.searchBar,
        styles.searchBar,
        isFocused && [dashStyles.inputFocused, styles.focused],
      ]}
    >
      {/* Search Icon */}
      <Ionicons
        name="search"
        size={20}
        color={isFocused ? theme.primary : theme.textSecondary}
      />

      {/* Search Input */}
      <TextInput
        style={[dashStyles.searchInput, styles.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Clear Button */}
      {showClearButton && value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="close-circle"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    minHeight: 48,
  },
  focused: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  input: {
    paddingVertical: 0,
  },
  clearButton: {
    padding: SPACING.xs,
  },
});
