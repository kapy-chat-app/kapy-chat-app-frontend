// components/page/message/SystemMessage.tsx - FOR CALL LOGS
import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";

interface SystemMessageProps {
  message: any;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  const { actualTheme } = useTheme();
  const router = useRouter();
  const isDark = actualTheme === "dark";

  if (!message.metadata?.isSystemMessage) {
    return null;
  }

  const action = message.metadata.action;

  // ⭐ CALL LOG MESSAGES
  if (action === "call_log") {
    const isOngoing = message.metadata.call_status === "ongoing";
    const isEnded = message.metadata.call_status === "ended";
    const callType = message.metadata.call_type;

    const handleJoinCall = () => {
      if (!isOngoing || !message.metadata.call_id) return;

      Alert.alert("Join Call", "Do you want to join this ongoing call?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Join",
          onPress: () => {
            router.push({
              pathname: "/call/[id]" as any,
              params: {
                id: message.metadata.call_id,
                conversationId: message.conversation,
                callType: callType || "video",
                isJoining: "true",
              },
            });
          },
        },
      ]);
    };

    return (
      <View className="mb-4 items-center justify-center px-4">
        <View
          className={`rounded-xl px-4 py-3 max-w-[90%] ${
            isDark ? "bg-gray-800" : "bg-gray-100"
          }`}
        >
          {/* Icon + Text */}
          <View className="flex-row items-center justify-center mb-2">
            <Ionicons
              name={callType === "video" ? "videocam" : "call"}
              size={20}
              color={isOngoing ? "#10b981" : isDark ? "#9ca3af" : "#6b7280"}
            />
            <Text
              className={`text-sm ml-2 text-center font-medium ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              {message.content}
            </Text>
          </View>

          {/* ⭐ JOIN BUTTON for ongoing calls */}
          {isOngoing && (
            <TouchableOpacity
              onPress={handleJoinCall}
              className="bg-green-500 rounded-lg px-4 py-2 mt-2 flex-row items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="enter-outline" size={18} color="#ffffff" />
              <Text className="text-white text-center font-semibold ml-2">
                Join Call
              </Text>
            </TouchableOpacity>
          )}

          {/* Timestamp */}
          <Text className="text-[10px] text-center text-gray-400 mt-2">
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
            })}
          </Text>
        </View>
      </View>
    );
  }

  // ⭐ GROUP ACTIONS (create, add, remove, leave, etc.)
  if (
    action === "create_group" ||
    action === "add_participants" ||
    action === "remove_participant" ||
    action === "leave_group" ||
    action === "transfer_admin" ||
    action === "update_group_name" ||
    action === "update_group_description" ||
    action === "update_group_avatar"
  ) {
    return (
      <View className="mb-3 items-center justify-center px-4">
        <View
          className={`rounded-lg px-3 py-2 ${
            isDark ? "bg-gray-800/50" : "bg-gray-100"
          }`}
        >
          <Text
            className={`text-xs text-center ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {message.content}
          </Text>
          <Text className="text-[9px] text-center text-gray-400 mt-1">
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
            })}
          </Text>
        </View>
      </View>
    );
  }

  // ⭐ DEFAULT SYSTEM MESSAGE
  return (
    <View className="mb-3 items-center justify-center px-4">
      <View
        className={`rounded-lg px-3 py-2 ${
          isDark ? "bg-gray-800/50" : "bg-gray-100"
        }`}
      >
        <Text
          className={`text-xs text-center ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {message.content}
        </Text>
        <Text className="text-[9px] text-center text-gray-400 mt-1">
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true,
          })}
        </Text>
      </View>
    </View>
  );
};

export default SystemMessage;