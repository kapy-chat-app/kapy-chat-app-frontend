import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInputProps,
  FocusEvent,
  BlurEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';


interface InputProps extends Omit<TextInputProps, 'style'> {
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: object;
  inputStyle?: object;
  style?: object;
  error?: boolean;
  errorMessage?: string;
  label?: string;
  required?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(({
  placeholder = "PhoneNumber or Email",
  value,
  onChangeText,
  onFocus,
  onBlur,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = true,
  editable = true,
  maxLength,
  multiline = false,
  numberOfLines = 1,
  returnKeyType = 'done',
  onSubmitEditing,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  containerStyle,
  placeholderTextColor,
  error,
  errorMessage,
  label,
  required = false,
  ...props
}, ref) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  // Định nghĩa màu sắc cho light/dark mode
  const colors = {
    light: {
      background: '#FFFFFF',
      border: '#E5E5E5',
      focusedBorder: '#007AFF',
      text: '#000000',
      placeholder: '#8E8E93',
      icon: '#8E8E93',
      error: '#FF3B30',
      label: '#000000',
    },
    dark: {
      background: '#1C1C1E',
      border: '#38383A',
      focusedBorder: '#0A84FF',
      text: '#FFFFFF',
      placeholder: '#8E8E93',
      icon: '#8E8E93',
      error: '#FF453A',
      label: '#FFFFFF',
    }
  };

  const currentColors = isDark ? colors.dark : colors.light;

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    onFocus && onFocus(e);
  };

  const handleBlur = (e: BlurEvent) => {
    setIsFocused(false);
    onBlur && onBlur(e);
  };

  const toggleSecureEntry = () => {
    setIsSecure(!isSecure);
  };

  const getBorderColor = () => {
    if (error) return currentColors.error;
    if (isFocused) return currentColors.focusedBorder;
    return currentColors.border;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: currentColors.label }]}>
            {label}
          </Text>
          {required && (
            <Text style={[styles.required, { color: currentColors.error }]}>
              *
            </Text>
          )}
        </View>
      )}
      
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: currentColors.background,
            borderColor: getBorderColor(),
          },
          isFocused && styles.focused,
          error && styles.error,
          style,
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={currentColors.icon}
            />
          </View>
        )}
        
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: currentColors.text,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            inputStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor || currentColors.placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          {...props}
        />
        
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={toggleSecureEntry}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={currentColors.icon}
            />
          </TouchableOpacity>
        )}
        
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            activeOpacity={0.7}
            disabled={!onRightIconPress}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={currentColors.icon}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && errorMessage && (
        <Text style={[styles.errorMessage, { color: currentColors.error }]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  required: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
  },
  focused: {
    borderWidth: 2,
  },
  error: {
    // borderColor được set động ở trên
  },
  leftIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0, // Remove default padding
  },
  errorMessage: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
  },
});

// Thêm displayName để tránh lỗi ESLint
Input.displayName = 'Input';

// Export component với tên Input
export default Input;