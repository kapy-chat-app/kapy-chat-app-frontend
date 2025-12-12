import React from "react";
import { Image, Text, TouchableOpacity, View, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { BlockedUser } from "@/hooks/friend/useFriends";

interface BlockedUserItemProps {
  blockedUser: BlockedUser;
  onPress?: () => void;
  onUnblock?: (userId: string) => void;
  isUnblocking?: boolean;
}

export const BlockedUserItem: React.FC<BlockedUserItemProps> = ({
  blockedUser,
  onPress,
  onUnblock,
  isUnblocking = false,
}) => {
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric",
    });
  };

  const handleUnblock = () => {
    Alert.alert(
      t('friends.blocked.title'),
      t('friends.blocked.confirm', { name: blockedUser.full_name }),
      [
        {
          text: t('cancel'),
          style: "cancel",
        },
        {
          text: t('friends.blocked.unblock'),
          style: "default",
          onPress: () => onUnblock?.(blockedUser.id),
        },
      ]
    );
  };

  // Function to get avatar source
  const getAvatarSource = () => {
    if (blockedUser.avatar && blockedUser.avatar.trim() !== "") {
      return { uri: blockedUser.avatar };
    }
    return require("@/assets/images/default-avatar.png");
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-lg p-4 mb-2 mx-4 shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      disabled={isUnblocking}
    >
      <View className="flex-row items-center">
        <View className="relative">
          <Image
            source={getAvatarSource()}
            className="w-12 h-12 rounded-full"
          />
          {/* Blocked indicator */}
          <View className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 items-center justify-center">
            <Ionicons name="ban" size={8} color="white" />
          </View>
        </View>

        <View className="flex-1 ml-3">
          <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {blockedUser.full_name}
          </Text>
          <Text className="text-gray-500 text-sm">
            @{blockedUser.username}
          </Text>
          <Text className="text-red-500 text-xs">
            {t('friends.blocked.on', { date: formatDate(new Date(blockedUser.blocked_at)) })}
          </Text>
          {blockedUser.reason && (
            <Text className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} numberOfLines={1}>
              {t('friends.blocked.reason', { reason: blockedUser.reason })}
            </Text>
          )}
        </View>

        <View className="flex-row space-x-2">

          {/* Unblock Button */}
          <TouchableOpacity
            onPress={handleUnblock}
            className={`p-2 rounded-full ${
              isUnblocking 
                ? "bg-gray-100 dark:bg-gray-700" 
                : "bg-green-100 dark:bg-green-900"
            }`}
            disabled={isUnblocking}
          >
            {isUnblocking ? (
              <Ionicons name="hourglass-outline" size={16} color="#9CA3AF" />
            ) : (
              <Ionicons name="lock-open-outline" size={16} color="#10B981" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};