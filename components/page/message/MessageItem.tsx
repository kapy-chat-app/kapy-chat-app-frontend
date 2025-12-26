// components/page/message/MessageItem.tsx - OPTIMIZED MEDIA DISPLAY
// ✅ FIXED: Long press now works on media-only messages

import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
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
  View,
} from "react-native";
import { MessageActionsMenu } from "./MessageActionsMenu";
import { MessageMediaGallery } from "./MessageMediaGallery";
import { ReactionPicker } from "./ReactionPicker";
import { ReadReceiptsModal } from "./ReadReceiptsModal";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface MessageItemProps {
  message: any;
  isOwnMessage: boolean;
  onReply?: (message: any) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string, type: "only_me" | "both") => void;
  onReaction?: (messageId: string, reaction: string) => void;
  onRemoveReaction?: (messageId: string) => void;
  isHighlighted?: boolean;
  onRetryDecryption?: (messageId: string) => void;
  encryptionReady?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwnMessage,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onRemoveReaction,
  isHighlighted,
  onRetryDecryption,
  encryptionReady,
}) => {
  const { user } = useUser();
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const [showActions, setShowActions] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [reactionPickerPosition, setReactionPickerPosition] = useState({
    top: 0,
    left: 0,
  });
  const bubbleRef = useRef<View>(null);

  const isDark = actualTheme === "dark";
  const messageStatus = message.status || "sent";
  const isSending = messageStatus === "sending";
  const isFailed = messageStatus === "failed";

  const hasDecryptionError =
    message.type === "text" && message.decryption_error;
  const readBy = message.read_by?.filter((r: any) => r.user !== user?.id) || [];
  const hasBeenRead = readBy.length > 0;
  const hasAttachmentDecryptionError =
    message.attachments?.some((att: any) => att.decryption_error) || false;

  // ✅ Check if message has ONLY media (no text content)
  const hasMedia = message.attachments && message.attachments.length > 0;
  const isFileMessage = message.type === "file";
  const hasTextContent =
    message.content && message.content.trim().length > 0 && !isFileMessage; // ← File messages don't show text
  const isMediaOnly = hasMedia || isFileMessage;

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
    Alert.alert(
      t("message.actions.deleteTitle"),
      t("message.actions.deleteMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("message.actions.deleteForMe"),
          onPress: () => onDelete?.(message._id, "only_me"),
        },
        ...(isOwnMessage
          ? [
              {
                text: t("message.actions.deleteForEveryone"),
                style: "destructive" as const,
                onPress: () => onDelete?.(message._id, "both"),
              },
            ]
          : []),
      ]
    );
  };

  const handleRetryDecryption = () => {
    Alert.alert(
      t("message.encryption.retryTitle"),
      t("message.encryption.retryMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("message.encryption.retry"),
          onPress: () => onRetryDecryption?.(message._id),
        },
      ]
    );
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
          onPress={handleRetryDecryption}
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

  const renderRichMedia = () => {
    if (
      !message.rich_media ||
      (message.type !== "gif" && message.type !== "sticker")
    ) {
      return null;
    }

    const { rich_media } = message;
    const maxWidth = 250;
    const aspectRatio = rich_media.width / rich_media.height;
    const displayWidth = Math.min(rich_media.width, maxWidth);
    const displayHeight = displayWidth / aspectRatio;

    return (
      <View className="overflow-hidden">
        <Image
          source={{ uri: rich_media.preview_url || rich_media.media_url }}
          style={{
            width: displayWidth,
            height: displayHeight,
          }}
          resizeMode="cover"
          className="rounded-xl"
        />
        {message.content && (
          <Text
            className={`text-xs mt-2 px-3 ${
              isOwnMessage
                ? "text-gray-200"
                : isDark
                  ? "text-gray-400"
                  : "text-gray-600"
            }`}
            numberOfLines={1}
          >
            {message.content}
          </Text>
        )}
      </View>
    );
  };

  const renderReactions = () => {
    // ✅ Early return nếu không có reactions
    if (!message.reactions || message.reactions.length === 0) {
      return null;
    }

    // ✅ Group reactions by type
    const reactionCounts: {
      [key: string]: { count: number; userReacted: boolean };
    } = {};

    message.reactions.forEach((reaction: any) => {
      if (!reactionCounts[reaction.type]) {
        reactionCounts[reaction.type] = { count: 0, userReacted: false };
      }
      reactionCounts[reaction.type].count++;
      if (reaction.user.clerkId === user?.id) {
        reactionCounts[reaction.type].userReacted = true;
      }
    });

    const iconMap: { [key: string]: { icon: string; color: string } } = {
      heart: { icon: "heart", color: "#ef4444" },
      like: { icon: "thumbs-up", color: "#3b82f6" },
      sad: { icon: "sad", color: "#8b5cf6" },
      angry: { icon: "flame", color: "#f97316" },
      laugh: { icon: "happy", color: "#eab308" },
      wow: { icon: "telescope", color: "#06b6d4" },
      dislike: { icon: "thumbs-down", color: "#6b7280" },
    };

    const handleReactionPress = (type: string, userReacted: boolean) => {
      if (isSending) return;

      // ✅ Toggle: Nếu user đã react thì remove, chưa thì add
      if (userReacted) {
        onRemoveReaction?.(message._id);
      } else {
        onReaction?.(message._id, type);
      }
    };

    return (
      <View className="flex-row flex-wrap mt-1.5 gap-1">
        {" "}
        {/* ✅ Thêm gap-1 */}
        {Object.entries(reactionCounts).map(([type, data]) => {
          const iconInfo = iconMap[type] || { icon: "heart", color: "#ef4444" };

          return (
            <TouchableOpacity
              key={type}
              onPress={() => handleReactionPress(type, data.userReacted)}
              disabled={isSending}
              activeOpacity={0.7}
              className={`flex-row items-center rounded-full px-2.5 py-1 ${
                // ✅ rounded-full + padding tốt hơn
                data.userReacted
                  ? "bg-orange-500 border border-orange-600" // ✅ Thêm border khi active
                  : isDark
                    ? "bg-gray-700 border border-gray-600"
                    : "bg-gray-100 border border-gray-300"
              }`}
            >
              <Ionicons
                name={iconInfo.icon as any}
                size={14} // ✅ Nhỏ hơn một chút (16 -> 14)
                color={data.userReacted ? "#ffffff" : iconInfo.color}
              />
              <Text
                className={`text-xs ml-1 font-semibold ${
                  // ✅ Thêm font-semibold
                  data.userReacted
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                {data.count}
              </Text>
            </TouchableOpacity>
          );
        })}
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
            {message.sender?.full_name || t("message.unknownUser")}
          </Text>
        )}

        <View ref={bubbleRef} collapsable={false}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            disabled={isSending}
            delayLongPress={300}
            className={`overflow-hidden ${
              // ✅ CHỈ apply background khi KHÔNG phải media-only
              isMediaOnly
                ? ""
                : `rounded-2xl ${
                    isOwnMessage
                      ? "bg-orange-500"
                      : isDark
                        ? "bg-gray-700"
                        : "bg-gray-100"
                  }`
            } ${isSending && "opacity-70"} ${isHighlighted && "ring-2 ring-yellow-500"}`}
          >
            {/* Reply indicator - CHỈ hiển thị nếu có reply */}
            {message.reply_to && !isMediaOnly && (
              <View
                className={`border-l-2 pl-2 mx-3 mt-2 mb-2 ${
                  isOwnMessage ? "border-white" : "border-orange-500"
                }`}
              >
                <Text
                  className={`text-[10px] ${isOwnMessage ? "text-gray-200" : "text-gray-600"}`}
                >
                  {t("message.reply.replyingTo", {
                    name: message.reply_to.sender?.full_name,
                  })}
                </Text>
                <Text
                  className={`text-xs ${isOwnMessage ? "text-gray-200" : "text-gray-600"}`}
                  numberOfLines={1}
                >
                  {message.reply_to.content || `[${message.reply_to.type}]`}
                </Text>
              </View>
            )}

            {/* GIF/Sticker - No wrapper */}
            {(message.type === "gif" || message.type === "sticker") &&
              renderRichMedia()}

            {/* ✅ Media Gallery - ZERO padding/background nếu media-only */}
            {!hasAttachmentDecryptionError && hasMedia && (
              <MessageMediaGallery
                message={message}
                isOwnMessage={isOwnMessage}
                isSending={isSending}
                isDark={isDark}
                onLongPress={handleLongPress} // ✅ PASS handleLongPress to media gallery
              />
            )}

            {/* ✅ Text content - CHỈ hiển thị nếu có text */}
            {hasTextContent && (
              <View className={hasMedia ? "px-3 pb-2" : ""}>
                <Text
                  className={`text-base ${hasMedia ? "" : "px-3 py-2"} ${
                    isOwnMessage
                      ? "text-white"
                      : isDark
                        ? "text-white"
                        : "text-gray-900"
                  }`}
                >
                  {message.content}
                </Text>

                {hasDecryptionError && message.content.includes("🔒") && (
                  <TouchableOpacity
                    onPress={handleRetryDecryption}
                    className="mx-3 mb-2 mt-1 bg-yellow-500 px-3 py-1 rounded"
                  >
                    <Text className="text-white text-xs text-center">
                      {t("message.encryption.retryDecryption")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Edited indicator - CHỈ hiển thị nếu KHÔNG phải media-only */}
            {message.is_edited && !isSending && !isMediaOnly && (
              <Text
                className={`text-[10px] mt-0.5 px-3 pb-1.5 ${
                  isOwnMessage ? "text-gray-200" : "text-gray-600"
                }`}
              >
                {t("message.edited")}
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
          bubbleRef.current?.measureInWindow((x, y, width, height) => {
            setReactionPickerPosition({
              top: y - 70,
              left: x + width / 2 - 160,
            });
            setShowReactionPicker(true);
          });
        }}
        onViewReads={handleViewReads}
        onDelete={handleDelete}
      />

      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onSelect={(reaction) => {
          onReaction?.(message._id, reaction);
          setShowReactionPicker(false);
        }}
        position={reactionPickerPosition}
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
