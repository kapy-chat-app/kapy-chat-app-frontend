import { Ionicons } from "@expo/vector-icons";
import React, { useState, useRef } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Modal,
  Pressable,
  useColorScheme,
  Dimensions,
} from "react-native";

interface MenuOption {
  id: string;
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface MenuDropdownProps {
  options: MenuOption[];
  triggerIcon?: keyof typeof Ionicons.glyphMap;
  triggerSize?: number;
  triggerColor?: string;
  style?: object;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({
  options,
  triggerIcon = "ellipsis-vertical",
  triggerSize = 20,
  triggerColor,
  style,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<View>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const defaultTriggerColor = triggerColor || "#FF8C42";

  const handleTriggerPress = () => {
    if (triggerRef.current) {
      triggerRef.current.measure((x, y, width, height, pageX, pageY) => {
        const dropdownWidth = 200;
        const dropdownHeight = options.length * 48 + 16; // 48px per item + padding
        
        // Calculate position to keep dropdown on screen
        let finalX = pageX - dropdownWidth + width;
        let finalY = pageY + height + 8;
        
        // Adjust if dropdown would go off right edge
        if (finalX < 8) {
          finalX = 8;
        }
        
        // Adjust if dropdown would go off left edge
        if (finalX + dropdownWidth > screenWidth - 8) {
          finalX = screenWidth - dropdownWidth - 8;
        }
        
        // Adjust if dropdown would go off bottom edge
        if (finalY + dropdownHeight > screenHeight - 8) {
          finalY = pageY - dropdownHeight - 8;
        }
        
        setDropdownPosition({ x: finalX, y: finalY });
        setIsVisible(true);
      });
    }
  };

  const handleOptionPress = (option: MenuOption) => {
    setIsVisible(false);
    setTimeout(() => {
      option.onPress();
    }, 100); // Small delay to ensure modal closes first
  };

  const handleBackdropPress = () => {
    setIsVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        ref={triggerRef}
        onPress={handleTriggerPress}
        className="p-2"
        style={style}
      >
        <Ionicons
          name={triggerIcon}
          size={triggerSize}
          color={defaultTriggerColor}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={handleBackdropPress}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.1)",
          }}
          onPress={handleBackdropPress}
        >
          <View
            style={{
              position: "absolute",
              left: dropdownPosition.x,
              top: dropdownPosition.y,
              minWidth: 200,
              backgroundColor: isDark ? "#374151" : "#FFFFFF",
              borderRadius: 12,
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
              paddingVertical: 8,
            }}
          >
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleOptionPress(option)}
                className={`flex-row items-center px-4 py-3 ${
                  index < options.length - 1 ? "border-b border-gray-100 dark:border-gray-600" : ""
                }`}
                style={{
                  backgroundColor: "transparent",
                }}
                activeOpacity={0.7}
              >
                {option.icon && (
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={
                      option.destructive
                        ? "#EF4444"
                        : isDark
                        ? "#D1D5DB"
                        : "#6B7280"
                    }
                    style={{ marginRight: 12 }}
                  />
                )}
                <Text
                  className={`flex-1 text-base ${
                    option.destructive
                      ? "text-red-500"
                      : isDark
                      ? "text-gray-200"
                      : "text-gray-900"
                  }`}
                >
                  {option.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

MenuDropdown.displayName = "MenuDropdown";

export default MenuDropdown;