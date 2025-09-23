import Button from "@/components/ui/Button";
import { FriendRequest } from "@/hooks/friend/useFriends";
import React from "react";
import {  Image, Text, View } from "react-native";

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
  return (
    <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 mx-4 shadow-sm">
      <View className="flex flex-col items-center">
        <View className="relative">
          <Image
            source={{
              uri: request.requester.avatar || "https://via.placeholder.com/50",
            }}
            className="w-12 h-12 rounded-full"
          />
          {/* Wave emoji for friend request */}
          <View className="absolute -top-1 -right-1 bg-orange-500 rounded-full w-6 h-6 items-center justify-center">
            <Text className="text-white text-xs">👋</Text>
          </View>
        </View>

        <View className="flex-1 ml-3">
          <Text className="text-gray-900 dark:text-white font-semibold">
            {request.requester.full_name}
          </Text>
          <Text className="text-gray-500 text-sm">Be friend ok?</Text>
        </View>

        <View className="flex-row space-x-2">
          <Button
            title="Accept"
            onPress={() => onAccept(request.id)}
            variant="primary"
            size="small"
            style={{ paddingHorizontal: 20 }}
          />
          <Button
            title="Decline"
            onPress={() => onDecline(request.id)}
            variant="secondary"
            size="small"
            style={{ paddingHorizontal: 16 }}
          />
        </View>
      </View>
    </View>
  );
};
