import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  onMenuPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  rightComponent,
  onMenuPress,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  return (
    <View 
      className={`flex-row items-center px-4 py-3 min-h-[60px] ${
        isDark ? 'bg-black' : 'bg-white'
      }`}
    >
      <View className="w-10">
        {showBackButton ? (
          <TouchableOpacity onPress={onBackPress} className="p-2">
            <Ionicons name="arrow-back" size={24} color="#FF8C42" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onMenuPress} className="p-2">
            <Ionicons name="menu" size={24} color="#FF8C42" />
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-1 items-center">
        <Text 
          className={`text-lg font-semibold ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          {title}
        </Text>
      </View>

      <View className="w-10 items-end">
        {rightComponent || (
          <TouchableOpacity className="p-1">
            <View className="w-8 h-8 rounded-full border-2 border-orange-500 justify-center items-center">
              <Ionicons name="happy" size={16} color="#FF8C42" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default Header;