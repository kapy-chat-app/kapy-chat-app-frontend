import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FriendRequest } from "@/hooks/friend/useFriends";
import React from "react";
import { Image, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

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
  const router = useRouter();
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";

  const getAvatarSource = () => {
    if (request.requester.avatar && request.requester.avatar.trim() !== "") {
      return { uri: request.requester.avatar };
    }
    return require("@/assets/images/default-avatar.png");
  };

  const goToProfile = () => {
    router.push(`contacts/public-profile/${request.requester.id}`);
  };

  return (
    <View
      className={`rounded-lg p-4 mb-3 mx-4 shadow-sm ${
        isDark ? "bg-gray-800" : "bg-white"
      }`}
    >
      <View className="flex-row items-center">
        {/* Avatar có thể bấm */}
        <TouchableOpacity onPress={goToProfile}>
          <Image
            source={getAvatarSource()}
            className="w-14 h-14 rounded-full"
          />
        </TouchableOpacity>

        {/* User Info */}
        <View className="flex-1 ml-4">
          <Text
            className={`font-semibold text-base mb-1 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {request.requester.full_name}
          </Text>
          <Text
            className={`text-sm ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {t("friends.request.message")}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row mt-4 gap-3">
        <View className="flex-1">
          <Button
            title={t("friends.request.accept")}
            onPress={() => onAccept(request.id)}
            variant="primary"
            size="small"
          />
        </View>
        <View className="flex-1">
          <Button
            title={t("friends.request.decline")}
            onPress={() => onDecline(request.id)}
            variant="secondary"
            size="small"
          />
        </View>
      </View>
    </View>
  );
};
