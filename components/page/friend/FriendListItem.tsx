import { Friend } from "@/hooks/friend/useFriends";
import { Ionicons } from "@expo/vector-icons";
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

  // Menu options for the dropdown
  const menuOptions = [
    {
      id: 'message',
      title: 'Send Message',
      icon: 'chatbubble-outline' as keyof typeof Ionicons.glyphMap,
      onPress: () => onMessage?.(),
    },
    {
      id: 'unfriend',
      title: 'Unfriend',
      icon: 'person-remove-outline' as keyof typeof Ionicons.glyphMap,
      onPress: () => onUnfriend?.(),
      destructive: false,
    },
    {
      id: 'block',
      title: 'Block User',
      icon: 'ban-outline' as keyof typeof Ionicons.glyphMap,
      onPress: () => onBlock?.(),
      destructive: true,
    },
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-2 mx-4 shadow-sm"
    >
      <View className="flex-row items-center">
        <View className="relative">
          <Image
            source={getAvatarSource()}
            className="w-12 h-12 rounded-full"
          />
          {friend.is_online && (
            <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
          )}
        </View>

        <View className="flex-1 ml-3">
          <Text className="text-gray-900 dark:text-white font-semibold">
            {friend.full_name}
          </Text>
          <Text className="text-gray-500 text-sm">
            {friend.mutualFriendsCount} mutual friends
          </Text>
          {friend.last_seen && (
            <Text className="text-orange-500 text-xs">
              {formatTimeAgo(new Date(friend.last_seen))}
            </Text>
          )}
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