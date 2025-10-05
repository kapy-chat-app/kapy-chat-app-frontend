import Button from "@/components/ui/Button";
import { FriendRequest } from "@/hooks/friend/useFriends";
import React from "react";
import { Image, Text, View } from "react-native";

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}

export const FriendRequestCard: React.FC<FriendRequestCardProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  // Function to get avatar source
  const getAvatarSource = () => {
    if (request.requester.avatar && request.requester.avatar.trim() !== "") {
      return { uri: request.requester.avatar };
    }
    return require("@/assets/images/default-avatar.png");
  };

  return (
    <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 mx-4 shadow-sm">
      <View className="flex-row items-center">
        {/* Avatar */}
        <Image
          source={getAvatarSource()}
          className="w-14 h-14 rounded-full"
        />

        {/* User Info */}
        <View className="flex-1 ml-4">
          <Text className="text-gray-900 dark:text-white font-semibold text-base mb-1">
            {request.requester.full_name}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Wants to be your friend
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row mt-4 gap-3">
        <View className="flex-1">
          <Button
            title="Accept"
            onPress={() => onAccept(request.id)}
            variant="primary"
            size="small"
          />
        </View>
        <View className="flex-1">
          <Button
            title="Decline"
            onPress={() => onDecline(request.id)}
            variant="secondary"
            size="small"
          />
        </View>
      </View>
    </View>
  );
};