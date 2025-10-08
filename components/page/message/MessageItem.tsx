// components/page/message/MessageItem.tsx - FIXED
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { MessageActionsMenu } from "./MessageActionsMenu";
import { MessageMediaGallery } from "./MessageMediaGallery";
import { ReadReceiptsModal } from "./ReadReceiptsModal";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface MessageItemProps {
  message: any;
  onReply?: (message: any) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string, type: "only_me" | "both") => void;
  onReaction?: (messageId: string, reaction: string) => void;
  onRetry?: (message: any) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onRetry,
}) => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const [showActions, setShowActions] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const bubbleRef = useRef<View>(null);

  const isOwnMessage = message.sender?.clerkId === user?.id;
  const isDark = colorScheme === "dark";
  const messageStatus = message.status || "sent";
  const isSending = messageStatus === "sending";
  const isFailed = messageStatus === "failed";
  
  // ✅ FIXED: Filter out current user AND populate userInfo
  const readBy = message.read_by?.filter((r: any) => r.user !== user?.id) || [];
  const hasBeenRead = readBy.length > 0;

  console.log('📖 MessageItem read_by data:', {
    messageId: message._id,
    totalReadBy: message.read_by?.length,
    filteredReadBy: readBy.length,
    readByData: readBy.map((r: any) => ({
      user: r.user,
      hasUserInfo: !!r.userInfo,
      userName: r.userInfo?.full_name
    }))
  });

  const handleLongPress = () => {
    if (!isSending && !showReadReceipts) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      bubbleRef.current?.measureInWindow((x, y, width, height) => {
        let optionCount = 3;
        if (isOwnMessage && hasBeenRead) optionCount++;
        if (isOwnMessage) optionCount++;

        const MENU_HEIGHT = optionCount * 56 + 16;
        const MENU_WIDTH = 220;
        const PADDING = 16;
        const SAFE_BOTTOM_MARGIN = 120;
        const SAFE_TOP_MARGIN = 80;

        let calculatedTop: number;
        let calculatedRight: number;

        const messageBottom = y + height;
        const spaceBelow = SCREEN_HEIGHT - messageBottom - SAFE_BOTTOM_MARGIN;
        const spaceAbove = y - SAFE_TOP_MARGIN;
        const messageCenterY = y + height / 2;
        const screenCenterY = SCREEN_HEIGHT / 2;

        if (messageCenterY < screenCenterY) {
          if (spaceBelow >= MENU_HEIGHT) {
            calculatedTop = messageBottom + 8;
          } else if (spaceAbove >= MENU_HEIGHT) {
            calculatedTop = y - MENU_HEIGHT - 8;
          } else {
            calculatedTop = Math.max(
              SAFE_TOP_MARGIN,
              y - MENU_HEIGHT / 2 + height / 2
            );
            calculatedTop = Math.min(
              calculatedTop,
              SCREEN_HEIGHT - MENU_HEIGHT - SAFE_BOTTOM_MARGIN
            );
          }
        } else {
          if (spaceAbove >= MENU_HEIGHT) {
            calculatedTop = y - MENU_HEIGHT - 8;
          } else if (spaceBelow >= MENU_HEIGHT) {
            calculatedTop = messageBottom + 8;
          } else {
            calculatedTop = Math.max(
              SAFE_TOP_MARGIN,
              y - MENU_HEIGHT / 2 + height / 2
            );
            calculatedTop = Math.min(
              calculatedTop,
              SCREEN_HEIGHT - MENU_HEIGHT - SAFE_BOTTOM_MARGIN
            );
          }
        }

        if (isOwnMessage) {
          calculatedRight = SCREEN_WIDTH - (x + width) + PADDING;
          if (calculatedRight + MENU_WIDTH > SCREEN_WIDTH - PADDING) {
            calculatedRight = PADDING;
          }
        } else {
          calculatedRight = SCREEN_WIDTH - x - MENU_WIDTH - PADDING;
          if (calculatedRight < PADDING) {
            calculatedRight = PADDING;
          }
        }

        setMenuPosition({ top: calculatedTop, right: calculatedRight });
        setShowActions(true);
      });
    }
  };

  const handleDelete = () => {
    setShowActions(false);
    Alert.alert("Xóa tin nhắn", "Chọn cách xóa:", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa ở phía tôi",
        onPress: () => onDelete?.(message._id, "only_me"),
      },
      ...(isOwnMessage
        ? [
            {
              text: "Xóa ở mọi người",
              style: "destructive" as const,
              onPress: () => onDelete?.(message._id, "both"),
            },
          ]
        : []),
    ]);
  };

  const handleRetry = () => {
    Alert.alert("Gửi lại tin nhắn", "Bạn có muốn gửi lại tin nhắn này không?", [
      { text: "Hủy", style: "cancel" },
      { text: "Gửi lại", onPress: () => onRetry?.(message) },
    ]);
  };

  const handleViewReads = async () => {
    setShowActions(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setShowReadReceipts(true), 200);
  };

  const renderAvatar = () => {
    const avatarUrl = message.sender?.avatar;
    const initial = message.sender?.full_name?.charAt(0) || "U";

    if (avatarUrl) {
      return (
        <Image source={{ uri: avatarUrl }} className="w-8 h-8 rounded-full" />
      );
    }
    return (
      <View className="w-8 h-8 rounded-full bg-orange-500 items-center justify-center">
        <Text className="text-white text-xs font-bold">{initial}</Text>
      </View>
    );
  };

  const renderStatusIndicator = () => {
    if (!isOwnMessage) return null;

    if (isSending) {
      return (
        <View className="flex-row items-center ml-2">
          <ActivityIndicator size="small" color="#f97316" />
        </View>
      );
    }

    if (isFailed) {
      return (
        <TouchableOpacity
          className="flex-row items-center ml-2"
          onPress={handleRetry}
        >
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
        </TouchableOpacity>
      );
    }

    return (
      <View className="flex-row items-center ml-2">
        <Ionicons
          name={hasBeenRead ? "checkmark-done" : "checkmark"}
          size={16}
          color={hasBeenRead ? "#10b981" : "#9ca3af"}
        />
        {hasBeenRead && readBy.length > 0 && (
          <Text className="text-[10px] text-green-500 ml-1 font-semibold">
            {readBy.length}
          </Text>
        )}
      </View>
    );
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const reactionCounts: { [key: string]: number } = {};
    message.reactions.forEach((reaction: any) => {
      reactionCounts[reaction.type] = (reactionCounts[reaction.type] || 0) + 1;
    });

    return (
      <View className="flex-row flex-wrap mt-1.5">
        {Object.entries(reactionCounts).map(([type, count]) => (
          <TouchableOpacity
            key={type}
            onPress={() => !isSending && onReaction?.(message._id, type)}
            disabled={isSending}
            className={`flex-row items-center rounded-xl px-2 py-1 mr-1 mb-1 ${
              isDark ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            <Text className="text-sm">{type}</Text>
            <Text
              className={`text-xs ml-1 ${isDark ? "text-gray-300" : "text-gray-600"}`}
            >
              {count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View
      className={`flex-row mb-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      {!isOwnMessage && <View className="mr-2">{renderAvatar()}</View>}

      <View
        className={`max-w-[80%] ${isOwnMessage ? "items-end" : "items-start"}`}
      >
        {!isOwnMessage && (
          <Text
            className={`text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            {message.sender?.full_name || "Unknown User"}
          </Text>
        )}

        <View ref={bubbleRef} collapsable={false}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            disabled={isSending}
            delayLongPress={300}
            className={`rounded-2xl overflow-hidden ${
              isOwnMessage
                ? "bg-orange-500"
                : isDark
                  ? "bg-gray-700"
                  : "bg-gray-100"
            } ${isSending && "opacity-70"}`}
          >
            {message.reply_to && (
              <View
                className={`border-l-2 pl-2 mx-3 mt-2 mb-2 ${
                  isOwnMessage ? "border-white" : "border-orange-500"
                }`}
              >
                <Text
                  className={`text-[10px] ${isOwnMessage ? "text-gray-200" : "text-gray-600"}`}
                >
                  Trả lời {message.reply_to.sender?.full_name}
                </Text>
                <Text
                  className={`text-xs ${isOwnMessage ? "text-gray-200" : "text-gray-600"}`}
                  numberOfLines={1}
                >
                  {message.reply_to.content}
                </Text>
              </View>
            )}

            <MessageMediaGallery
              message={message}
              isOwnMessage={isOwnMessage}
              isSending={isSending}
              isDark={isDark}
            />

            {message.content && (
              <Text
                className={`text-base px-3 py-2 ${
                  isOwnMessage
                    ? "text-white"
                    : isDark
                      ? "text-white"
                      : "text-gray-900"
                }`}
              >
                {message.content}
              </Text>
            )}

            {message.is_edited && !isSending && (
              <Text
                className={`text-[10px] mt-0.5 px-3 pb-1.5 ${
                  isOwnMessage ? "text-gray-200" : "text-gray-600"
                }`}
              >
                đã chỉnh sửa
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {renderReactions()}

        <View className="flex-row items-center mt-1">
          <Text className="text-[10px] text-gray-400">
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
            })}
          </Text>
          {renderStatusIndicator()}
        </View>
      </View>

      <MessageActionsMenu
        visible={showActions}
        onClose={() => setShowActions(false)}
        position={menuPosition}
        isOwnMessage={isOwnMessage}
        hasBeenRead={hasBeenRead}
        readByCount={readBy.length}
        isDark={isDark}
        onReply={() => {
          setShowActions(false);
          onReply?.(message);
        }}
        onReact={() => {
          setShowActions(false);
          onReaction?.(message._id, "👍");
        }}
        onViewReads={handleViewReads}
        onDelete={handleDelete}
      />

      <ReadReceiptsModal
        visible={showReadReceipts}
        onClose={() => setShowReadReceipts(false)}
        readBy={readBy}
        isDark={isDark}
      />
    </View>
  );
};

export default MessageItem;