/**
 * Dashboard Search Bar Component
 * 
 * A search bar component for dashboards, matching PWA design.
 * Supports searching students, teachers, classes, etc.
 */

import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

export interface SearchBarSuggestion {
  id: string;
  label: string;
  icon?: string;
}

export interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: (query: string) => void;
  onClear?: () => void;
  suggestions?: SearchBarSuggestion[];
  onSuggestionPress?: (suggestion: SearchBarSuggestion) => void;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  placeholder = 'Search...', 
  value = '',
  onChangeText,
  onSubmit, 
  onClear,
  suggestions = [],
  onSuggestionPress,
  autoFocus = false,
}) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const focusScale = useSharedValue(1);

  const styles = createStyles(theme);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (onChangeText) onChangeText(text);
  }, [onChangeText]);

  const handleSubmit = useCallback(() => {
    if (onSubmit) onSubmit(query);
  }, [onSubmit, query]);

  const handleClear = useCallback(() => {
    setQuery('');
    if (onChangeText) onChangeText('');
    if (onClear) onClear();
  }, [onChangeText, onClear]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    focusScale.value = withTiming(1.02, { duration: 150 });
  }, [focusScale]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focusScale.value = withTiming(1, { duration: 150 });
  }, [focusScale]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusScale.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View 
        style={[
          styles.container, 
          isFocused && styles.containerFocused,
          animatedContainerStyle,
        ]}
      >
        <Ionicons 
          name="search" 
          size={20} 
          color={isFocused ? theme.primary : theme.textSecondary} 
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          autoFocus={autoFocus}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
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
      </Animated.View>

      {/* Suggestions dropdown */}
      {isFocused && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions
            .filter(s => !query || s.label.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5)
            .map((suggestion) => (
              <TouchableOpacity
                key={suggestion.id}
                style={styles.suggestionItem}
                onPress={() => {
                  setQuery(suggestion.label);
                  if (onSuggestionPress) onSuggestionPress(suggestion);
                  handleBlur();
                }}
              >
                <Ionicons 
                  name={(suggestion.icon || 'search-outline') as any} 
                  size={16} 
                  color={theme.textSecondary} 
                />
                <Text style={styles.suggestionText}>{suggestion.label}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: any) => {
  const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;

  return StyleSheet.create({
    wrapper: {
      marginHorizontal: cardPadding,
      marginBottom: 16,
      zIndex: 100,
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    containerFocused: {
      borderColor: theme.primary,
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    searchIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: isSmallScreen ? 14 : 16,
      color: theme.text,
      padding: 0,
      margin: 0,
      ...(Platform.OS === 'web' && {
        outlineStyle: 'none',
      }),
    },
    clearButton: {
      marginLeft: 8,
      padding: 4,
    },
    suggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 12,
    },
    suggestionText: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
    },
  });
};

export default SearchBar;
