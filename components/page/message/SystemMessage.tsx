// components/page/message/SystemMessage.tsx - IMPROVED VERSION
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface SystemMessageProps {
  message: any;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  const { actualTheme } = useTheme();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const isDark = actualTheme === "dark";

  if (!message.metadata?.isSystemMessage) {
    return null;
  }

  const action = message.metadata.action;

  // ⭐ CALL LOG MESSAGES - IMPROVED JOIN LOGIC
  if (action === "call_log") {
    const isOngoing = message.metadata.call_status === "ongoing";
    const isEnded = message.metadata.call_status === "ended";
    const callType = message.metadata.call_type;
    const callId = message.metadata.call_id;
    const conversationId = message.conversation;

    const handleJoinCall = async () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀 [SYSTEM MESSAGE] User clicked Join Call");
      console.log("📋 [SYSTEM MESSAGE] Call ID:", callId);
      console.log("📋 [SYSTEM MESSAGE] Conversation ID:", conversationId);

      if (!isOngoing || !callId || !conversationId) {
        Alert.alert("Error", "Call information not available");
        return;
      }

      try {
        console.log("🔄 [SystemMessage] Starting join process...");
        console.log("📋 Call ID:", callId);
        console.log("📋 Conversation ID:", conversationId);

        const token = await getToken();

        if (!token) {
          Alert.alert("Error", "Authentication required");
          return;
        }

        // ✅ STEP 1: Fetch complete call details
        console.log("📡 [Step 1] Fetching call details...");

        const callResponse = await axios.get(
          `${API_URL}/api/calls/${callId}/details`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const call = callResponse.data;

        console.log("📞 [Step 1] Call details received:", {
          id: call.id,
          channelName: call.channelName,
          status: call.status,
        });

        // ✅ STEP 2: Validate channelName
        const channelName = call.channelName || call.channel_name;

        if (!channelName) {
          console.error("❌ Call details missing channelName:", call);
          Alert.alert(
            "Error",
            "Call channel information is missing. Please try again."
          );
          return;
        }

        console.log("✅ [Step 2] channelName validated:", channelName);

        // ✅ STEP 3: Verify call is still ongoing
        if (call.status !== "ongoing" && call.status !== "ringing") {
          Alert.alert(
            "Call Ended",
            "This call has already ended. You cannot join."
          );
          return;
        }

        console.log("✅ [Step 3] Call is active, proceeding to answer...");

        // ✅ STEP 4: Answer the call (join as participant)
        console.log("📡 [Step 4] Answering call...");

        await axios.post(
          `${API_URL}/api/calls/${callId}/answer`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("✅ [Step 4] Call answered successfully");

        // ✅ STEP 5: Navigate to call screen with ALL required params
        console.log("🚀 [Step 5] Navigating to call screen with params:");

        const navigationParams = {
          id: callId,
          channelName: channelName, // ⭐ CRITICAL: From backend
          conversationId: conversationId,
          callType: callType || call.type || "video",
          conversationType: call.conversation?.type || "group",
        };

        console.log("📋 Navigation params:", navigationParams);

        // ⭐ VALIDATION: Ensure all critical params exist
        if (!navigationParams.channelName) {
          console.error(
            "❌ CRITICAL: channelName still missing after all steps!"
          );
          Alert.alert("Error", "Failed to get call channel. Please try again.");
          return;
        }

        router.push({
          pathname: "/call/[id]" as any,
          params: navigationParams,
        });

        console.log("✅ [Step 5] Navigation initiated");
      } catch (error: any) {
        console.error("❌ [SystemMessage] Error joining call:", error);
        console.error("❌ Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });

        Alert.alert(
          "Error",
          error.response?.data?.error ||
            error.message ||
            "Failed to join call. Please try again."
        );
      }
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
