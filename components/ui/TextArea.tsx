import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

interface TextAreaProps
  extends Omit<TextInputProps, "multiline" | "numberOfLines" | "style"> {
  leftIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: object;
  inputStyle?: object;
  style?: ViewStyle;
  error?: boolean;
  errorMessage?: string;
  label?: string;
  required?: boolean;
  minHeight?: number;
  maxHeight?: number;
  rows?: number;
}

const TextArea = forwardRef<TextInput, TextAreaProps>(
  (
    {
      placeholder = "Enter description...",
      value,
      onChangeText,
      onFocus,
      onBlur,
      autoCapitalize = "sentences",
      autoCorrect = true,
      editable = true,
      maxLength,
      returnKeyType = "default",
      onSubmitEditing,
      leftIcon,
      containerStyle,
      inputStyle,
      placeholderTextColor,
      error,
      errorMessage,
      label,
      required = false,
      minHeight = 100,
      maxHeight = 200,
      rows = 4,
      style,
      ...props
    },
    ref
  ) => {
    const { actualTheme } = useTheme();
    const isDark = actualTheme === "dark";
    const [isFocused, setIsFocused] = useState(false);

    // Sử dụng cùng màu sắc với Input component
    const colors = {
      light: {
        background: "#FFFFFF",
        border: "#E5E5E5",
        focusedBorder: "#007AFF",
        text: "#000000",
        placeholder: "#8E8E93",
        icon: "#8E8E93",
        error: "#FF3B30",
        label: "#000000",
      },
      dark: {
        background: "#1C1C1E",
        border: "#38383A",
        focusedBorder: "#0A84FF",
        text: "#FFFFFF",
        placeholder: "#8E8E93",
        icon: "#8E8E93",
        error: "#FF453A",
        label: "#FFFFFF",
      },
    };

    const currentColors = isDark ? colors.dark : colors.light;

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus && onFocus(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur && onBlur(e);
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
              borderWidth: isFocused ? 2 : 1,
              minHeight,
              maxHeight,
            },
            style,
          ]}
        >
          {leftIcon && (
            <View style={styles.iconContainer}>
              <Ionicons name={leftIcon} size={20} color={currentColors.icon} />
            </View>
          )}

          <TextInput
            ref={ref}
            style={[
              styles.textInput,
              {
                color: currentColors.text,
                flex: 1,
              },
              inputStyle,
            ]}
            placeholder={placeholder}
            placeholderTextColor={
              placeholderTextColor || currentColors.placeholder
            }
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            editable={editable}
            maxLength={maxLength}
            multiline={true}
            numberOfLines={rows}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            textAlignVertical="top"
            {...props}
          />
        </View>

        {error && errorMessage && (
          <Text style={[styles.errorMessage, { color: currentColors.error }]}>
            {errorMessage}
          </Text>
        )}

        {maxLength && (
          <Text
            style={[
              styles.characterCount,
              { color: currentColors.placeholder },
            ]}
          >
            {value?.length || 0}/{maxLength}
          </Text>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
  required: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 25, // Giống Input component
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 0,
  },
  errorMessage: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
  },
  characterCount: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
    textAlign: "right",
  },
});

TextArea.displayName = "TextArea";

export default TextArea;
