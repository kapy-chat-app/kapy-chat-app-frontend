// components/page/message/MessageItem.tsx - UPDATED
// ✅ Fixed: Hide file name when media is displayed
// ✅ Added defensive rendering for attachments
// ✅ Fixed socket message crash issues

import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
import React, { useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
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
  onRecall?: (messageId: string) => void;
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
  onRecall,
  onReaction,
  onRemoveReaction,
  isHighlighted,
  onRetryDecryption,
  encryptionReady,
}) => {
  // ✅ CRITICAL: Early validation
  if (!message?._id || !message?.sender) {
    console.warn("⚠️ MessageItem: Invalid message structure", message);
    return null;
  }

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

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isDark = actualTheme === "dark";
  const messageStatus = message.status || "sent";
  const isSending = messageStatus === "sending";
  const isFailed = messageStatus === "failed";

  const hasDecryptionError = message.type === "text" && message.decryption_error;
  
  // ✅ Safe read_by access
  const readBy = Array.isArray(message.read_by) 
    ? message.read_by.filter((r: any) => r?.user !== user?.id)
    : [];
  const hasBeenRead = readBy.length > 0;

  // ✅ Safe attachments access
  const safeAttachments = useMemo(() => {
    if (!Array.isArray(message.attachments)) {
      return [];
    }
    
    return message.attachments.filter((att: any) => {
      if (!att || !att._id) {
        console.warn("⚠️ Invalid attachment:", att);
        return false;
      }
      return true;
    });
  }, [message.attachments]);

  const hasAttachmentDecryptionError = safeAttachments.some(
    (att: any) => att.decryption_error === true
  );

  // ✅ UPDATED: Check if message has media (images, videos, audio)
  const hasMedia = safeAttachments.some((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    
    const isImage = fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
    const isVideo = fileType.startsWith('video/') || fileName.match(/\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/);
    const isAudio = fileType.startsWith('audio/') || fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
    
    return isImage || isVideo || isAudio;
  });
  
  const isFileMessage = message.type === "file";
  
  // ✅ UPDATED: Only show text content if there's actual text AND no media
  // If has media (image/video/audio), don't show text content even if it exists
  const hasTextContent = message.content && 
                        message.content.trim().length > 0 && 
                        !isFileMessage && 
                        !hasMedia;
  
  const isMediaOnly = hasMedia || isFileMessage;

  // ✅ Check if message is recalled
  const isRecalled = message.metadata?.isRecalled === true;

  // ✅ Check if message can be edited
  const canEdit =
    isOwnMessage &&
    message.type === "text" &&
    !hasMedia &&
    !message.rich_media &&
    !isSending &&
    !isRecalled;

  // ✅ Check if message can be recalled (within 24 hours)
  const canRecall = useMemo(() => {
    if (!isOwnMessage || isRecalled) return false;

    const messageTime = new Date(message.created_at).getTime();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    return now - messageTime <= twentyFourHours;
  }, [isOwnMessage, isRecalled, message.created_at]);

  const handleLongPress = () => {
    if (!isSending && !showReadReceipts && !isRecalled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      bubbleRef.current?.measureInWindow((x, y, width, height) => {
        let optionCount = 3; // Reply, React, Cancel
        if (isOwnMessage && hasBeenRead) optionCount++; // View reads
        if (canEdit) optionCount++; // Edit
        if (canRecall) optionCount++; // Recall
        if (isOwnMessage) optionCount++; // Delete

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

  const handleEdit = () => {
    setShowActions(false);
    setEditedContent(message.content || "");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editedContent.trim()) {
      Alert.alert(t("error"), t("message.edit.emptyContent"));
      return;
    }

    if (editedContent.trim() === message.content?.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSavingEdit(true);
      await onEdit?.(message._id, editedContent.trim());
      setIsEditing(false);
      setIsSavingEdit(false);
    } catch (error: any) {
      setIsSavingEdit(false);
      Alert.alert(t("error"), error.message || t("message.edit.failed"));
    }
  };

  // ✅ Handle recall
  const handleRecall = () => {
    setShowActions(false);
    Alert.alert(
      t("message.actions.recallTitle"),
      t("message.actions.recallMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("message.actions.recall"),
          style: "destructive" as const,
          onPress: () => onRecall?.(message._id),
        },
      ]
    );
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
    
    // ✅ Validate rich_media structure
    if (!rich_media.media_url || !rich_media.width || !rich_media.height) {
      console.warn("⚠️ Invalid rich_media:", rich_media);
      return null;
    }

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
        {/* ✅ Don't show content text for GIF/sticker */}
      </View>
    );
  };

  const renderReactions = () => {
    // ✅ Safe reactions access
    if (!Array.isArray(message.reactions) || message.reactions.length === 0) {
      return null;
    }

    const reactionCounts: {
      [key: string]: { count: number; userReacted: boolean };
    } = {};

    message.reactions.forEach((reaction: any) => {
      if (!reaction?.type) return; // ✅ Skip invalid reactions
      
      if (!reactionCounts[reaction.type]) {
        reactionCounts[reaction.type] = { count: 0, userReacted: false };
      }
      reactionCounts[reaction.type].count++;
      if (reaction.user?.clerkId === user?.id) {
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

      if (userReacted) {
        onRemoveReaction?.(message._id);
      } else {
        onReaction?.(message._id, type);
      }
    };

    return (
      <View className="flex-row flex-wrap mt-1.5 gap-1">
        {Object.entries(reactionCounts).map(([type, data]) => {
          const iconInfo = iconMap[type] || { icon: "heart", color: "#ef4444" };

          return (
            <TouchableOpacity
              key={type}
              onPress={() => handleReactionPress(type, data.userReacted)}
              disabled={isSending}
              activeOpacity={0.7}
              className={`flex-row items-center rounded-full px-2.5 py-1 ${
                data.userReacted
                  ? "bg-orange-500 border border-orange-600"
                  : isDark
                    ? "bg-gray-700 border border-gray-600"
                    : "bg-gray-100 border border-gray-300"
              }`}
            >
              <Ionicons
                name={iconInfo.icon as any}
                size={14}
                color={data.userReacted ? "#ffffff" : iconInfo.color}
              />
              <Text
                className={`text-xs ml-1 font-semibold ${
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

  const renderEditModal = () => {
    return (
      <Modal
        visible={isEditing}
        transparent
        animationType="fade"
        onRequestClose={() => !isSavingEdit && setIsEditing(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => !isSavingEdit && setIsEditing(false)}
            className={`flex-1 ${isDark ? "bg-black/80" : "bg-black/50"} items-center justify-center px-4`}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className={`w-full max-w-md p-4 rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-lg`}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className={`text-lg font-semibold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {t("message.edit.title")}
                </Text>

                {encryptionReady && (
                  <View className="bg-green-500 rounded-full px-2 py-0.5">
                    <Text className="text-white text-xs font-bold">🔒</Text>
                  </View>
                )}
              </View>

              <TextInput
                value={editedContent}
                onChangeText={setEditedContent}
                multiline
                maxLength={5000}
                placeholder={t("message.edit.placeholder")}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                editable={!isSavingEdit}
                className={`border rounded-lg p-3 mb-3 ${
                  isDark
                    ? "border-gray-600 bg-gray-700 text-white"
                    : "border-gray-300 bg-white text-gray-900"
                }`}
                style={{ minHeight: 100, maxHeight: 200, textAlignVertical: "top" }}
              />

              <Text
                className={`text-xs mb-3 ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {editedContent.length}/5000 {t("message.edit.characters")}
              </Text>

              <View className="flex-row justify-end gap-2">
                <TouchableOpacity
                  onPress={() => setIsEditing(false)}
                  disabled={isSavingEdit}
                  className={`px-4 py-2 rounded-lg ${
                    isSavingEdit ? "bg-gray-400" : "bg-gray-500"
                  }`}
                >
                  <Text className="text-white font-semibold">{t("cancel")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit || !editedContent.trim()}
                  className={`px-4 py-2 rounded-lg ${
                    isSavingEdit || !editedContent.trim()
                      ? "bg-orange-300"
                      : "bg-orange-500"
                  }`}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-semibold">{t("save")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ✅ Render recalled message
  if (isRecalled) {
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

          <View
            className={`rounded-2xl px-3 py-2 ${
              isDark ? "bg-gray-800" : "bg-gray-200"
            }`}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="ban"
                size={16}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <Text
                className={`ml-2 italic ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {t("message.recalled")}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-1">
            <Text className="text-[10px] text-gray-400">
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ✅ Normal message render
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
            {/* ✅ Safe reply_to rendering */}
            {message.reply_to && message.reply_to._id && !isMediaOnly && (
              <View
                className={`border-l-2 pl-2 mx-3 mt-2 mb-2 ${
                  isOwnMessage ? "border-white" : "border-orange-500"
                }`}
              >
                <Text
                  className={`text-[10px] ${isOwnMessage ? "text-gray-200" : "text-gray-600"}`}
                >
                  {t("message.reply.replyingTo", {
                    name: message.reply_to.sender?.full_name || "Unknown",
                  })}
                </Text>
                <Text
                  className={`text-xs ${isOwnMessage ? "text-gray-200" : "text-gray-600"}`}
                  numberOfLines={1}
                >
                  {message.reply_to.content || `[${message.reply_to.type || "message"}]`}
                </Text>
              </View>
            )}

            {(message.type === "gif" || message.type === "sticker") &&
              renderRichMedia()}

            {/* ✅ Safe media rendering */}
            {!hasAttachmentDecryptionError && safeAttachments.length > 0 && (
              <MessageMediaGallery
                message={{
                  ...message,
                  attachments: safeAttachments,
                }}
                isOwnMessage={isOwnMessage}
                isSending={isSending}
                isDark={isDark}
                onLongPress={handleLongPress}
              />
            )}

            {/* ✅ UPDATED: Only show text if no media */}
            {hasTextContent && (
              <View className={safeAttachments.length > 0 ? "px-3 pb-2" : ""}>
                <Text
                  className={`text-base ${safeAttachments.length > 0 ? "" : "px-3 py-2"} ${
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
        canEdit={canEdit}
        canRecall={canRecall}
        onReply={() => {
          setShowActions(false);
          onReply?.(message);
        }}
        onEdit={handleEdit}
        onRecall={handleRecall}
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

      {renderEditModal()}
    </View>
  );
};

export default MessageItem;