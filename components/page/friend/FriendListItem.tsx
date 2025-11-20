import { Friend } from "@/hooks/friend/useFriends";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSocket } from "@/hooks/message/useSocket"; // ✨ NEW
import MenuDropdown from "@/components/ui/MenuDropdown";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface FriendListItemProps {
  friend: Friend;
  onPress?: () => void;
  onViewProfile?: () => void;
  onMessage?: () => void;
  onBlock?: () => void;
  onUnfriend?: () => void;
}

export const FriendListItem: React.FC<FriendListItemProps> = ({
  friend,
  onPress,
  onViewProfile,
  onMessage,
  onBlock,
  onUnfriend,
}) => {
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // ✨ NEW: Get online status from socket
  const { isUserOnline } = useSocket();
  
  // ✨ Calculate real-time online status
  const isOnline = isUserOnline(friend.clerkId);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  // Function to get avatar source
  const getAvatarSource = () => {
    if (friend.avatar && friend.avatar.trim() !== "") {
      return { uri: friend.avatar };
    }
    return require("@/assets/images/default-avatar.png");
  };

  // ✨ NEW: Get status text based on real-time online status
  const getStatusText = () => {
    if (isOnline) {
      return t('publicProfile.online');
    }
    
    if (friend.last_seen) {
      const lastSeen = new Date(friend.last_seen);
      const now = new Date();
      const diffInHours = Math.floor(
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60)
      );

      if (diffInHours < 1) return t('publicProfile.recentlyOnline');
      if (diffInHours < 24) return t('publicProfile.hoursAgo', { hours: diffInHours });
      return t('publicProfile.daysAgo', { days: Math.floor(diffInHours / 24) });
    }
    
    return t('publicProfile.offline');
  };

  // Menu options for the dropdown
  const menuOptions = [
    {
      id: 'message',
      title: t('friends.menu.message'),
      icon: 'chatbubble-outline' as keyof typeof Ionicons.glyphMap,
      onPress: () => onMessage?.(),
    },
    {
      id: 'unfriend',
      title: t('friends.menu.unfriend'),
      icon: 'person-remove-outline' as keyof typeof Ionicons.glyphMap,
      onPress: () => onUnfriend?.(),
      destructive: false,
    },
    {
      id: 'block',
      title: t('friends.menu.block'),
      icon: 'ban-outline' as keyof typeof Ionicons.glyphMap,
      onPress: () => onBlock?.(),
      destructive: true,
    },
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-lg p-4 mb-2 mx-4 shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}
    >
      <View className="flex-row items-center">
        <View className="relative">
          <Image
            source={getAvatarSource()}
            className="w-12 h-12 rounded-full"
          />
          {/* ✨ UPDATED: Show green dot based on socket online status */}
          {isOnline && (
            <View className={`absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 ${isDark ? 'border-gray-800' : 'border-white'}`} />
          )}
        </View>

        <View className="flex-1 ml-3">
          <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {friend.full_name}
          </Text>
          
          {/* ✨ UPDATED: Show real-time online status text */}
          <Text className={`text-sm ${isOnline ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {getStatusText()}
          </Text>
          
          {/* ✨ Keep mutual friends count */}
          <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('friends.labels.mutual', { count: friend.mutualFriendsCount })}
          </Text>
        </View>

        {/* Replace the three dots icon with MenuDropdown */}
        <MenuDropdown
          options={menuOptions}
          triggerIcon="ellipsis-vertical"
          triggerSize={20}
          triggerColor="#FF8C42"
        />
      </View>
    </TouchableOpacity>
  );
};