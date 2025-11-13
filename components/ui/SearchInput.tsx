import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  TextInputProps,
  StyleSheet,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  onSearch?: (text: string) => void;
  onClear?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  showClearButton?: boolean;
  searchIconSize?: number;
  clearIconSize?: number;
  borderRadius?: number;
  style?: object;
  inputStyle?: object;
  iconColor?: string;
  debounceDelay?: number;
  autoFocus?: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = "Search...",
  value,
  onChangeText,
  onSearch,
  onClear,
  onFocus,
  onBlur,
  showClearButton = true,
  searchIconSize = 20,
  clearIconSize = 18,
  borderRadius = 25,
  style,
  inputStyle,
  iconColor,
  debounceDelay = 300,
  autoFocus = false,
  ...props
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [isFocused, setIsFocused] = useState(false);
  const [searchText, setSearchText] = useState(value || '');
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Định nghĩa màu sắc cho light/dark mode
  const colors = {
    light: {
      background: '#F2F2F7',
      text: '#000000',
      placeholder: '#8E8E93',
      icon: '#FF8C42', // Orange như trong hình
      border: 'transparent',
      focusedBorder: '#FF8C42',
    },
    dark: {
      background: '#2C2C2E',
      text: '#FFFFFF',
      placeholder: '#8E8E93',
      icon: '#FF8C42', // Orange như trong hình
      border: 'transparent',
      focusedBorder: '#FF8C42',
    }
  };

  const currentColors = isDark ? colors.dark : colors.light;

  const handleFocus = () => {
    setIsFocused(true);
    onFocus && onFocus();
    
    // Animation khi focus
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur && onBlur();
    
    // Animation khi blur
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleChangeText = (text: string) => {
    setSearchText(text);
    onChangeText && onChangeText(text);

    // Debounce search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (onSearch) {
      debounceTimer.current = setTimeout(() => {
        onSearch(text);
      }, debounceDelay);
    }
  };

  const handleClear = () => {
    setSearchText('');
    onChangeText && onChangeText('');
    onClear && onClear();
    inputRef.current?.focus();

    // Clear debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    // Trigger search with empty string
    onSearch && onSearch('');
  };

  const handleSearchIconPress = () => {
    if (searchText.trim()) {
      onSearch && onSearch(searchText.trim());
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: currentColors.background,
          borderColor: isFocused ? currentColors.focusedBorder : currentColors.border,
          borderWidth: isFocused ? 1 : 0,
          borderRadius: borderRadius,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.searchIconContainer}
        onPress={handleSearchIconPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="search"
          size={searchIconSize}
          color={iconColor || currentColors.icon}
        />
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            color: currentColors.text,
          },
          inputStyle,
        ]}
        placeholder={placeholder}
        placeholderTextColor={currentColors.placeholder}
        value={searchText}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={() => onSearch && onSearch(searchText.trim())}
        {...props}
      />

      {showClearButton && searchText.length > 0 && (
        <TouchableOpacity
          style={styles.clearIconContainer}
          onPress={handleClear}
          activeOpacity={0.7}
        >
          <Ionicons
            name="close-circle"
            size={clearIconSize}
            color={currentColors.placeholder}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
    elevation: 1, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0, // Remove default padding
  },
  clearIconContainer: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Thêm displayName để tránh lỗi ESLint
SearchInput.displayName = 'SearchInput';

export default SearchInput;