// MessageScreen.tsx - OPTIMIZED WITH MEMOIZATION TO PREVENT RE-DECRYPTION - NEW
import MessageInput from "@/components/page/message/MessageInput";
import MessageItem from "@/components/page/message/MessageItem";
import SystemMessage from "@/components/page/message/SystemMessage";
import { TypingIndicator } from "@/components/page/message/TypingIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConversations } from "@/hooks/message/useConversations";
import { useEncryption } from "@/hooks/message/useEncryption";
import { useMessages } from "@/hooks/message/useMessages";
import { useSocket } from "@/hooks/message/useSocket";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ✅ CRITICAL: Memoize MessageItem to prevent unnecessary re-renders
const MemoizedMessageItem = memo(MessageItem, (prevProps, nextProps) => {
  // Only re-render if essential props changed
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    // ✅ CRITICAL: Deep compare attachments to detect changes
    JSON.stringify(prevProps.message.attachments) ===
      JSON.stringify(nextProps.message.attachments)
  );
});

const MemoizedSystemMessage = memo(SystemMessage, (prevProps, nextProps) => {
  return prevProps.message._id === nextProps.message._id;
});

export default function MessageScreen() {
  const router = useRouter();
  const { id, scrollToMessageId } = useLocalSearchParams<{
    id: string;
    scrollToMessageId?: string;
  }>();
  const { userId, getToken } = useAuth();
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const flatListRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  // Call states
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const lastMessageCountRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const scrollPositionBeforeLoad = useRef(0);
  const firstVisibleItemBeforeLoad = useRef<string | null>(null);
  const lastLoadTimeRef = useRef(0);
  const socketMessageCountRef = useRef(0);
  const hasMarkedAsReadRef = useRef(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);

  // ⭐ NEW: Activity tracking ref
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = actualTheme === "dark";

  // ✅ OPTIMIZED: Get encryption state from global provider (instant)
  const { isInitialized: encryptionReady, loading: encryptionLoading } =
    useEncryption();

  // ✅ OPTIMIZED: Messages hook starts loading immediately
  const {
    messages,
    loading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markAsRead,
    markConversationAsRead,
    loadMoreMessages,
    hasMore,
    socketMessageCount,
    typingUsers,
    sendTypingIndicator,
    retryDecryption,
  } = useMessages(id || null);

  const { socket, isConnected, isUserOnline, onlineUsers } = useSocket();
  const { conversations } = useConversations();

  // ✅ OPTIMIZED: Set conversation immediately
  useEffect(() => {
    if (id && conversations.length > 0) {
      const currentConversation = conversations.find((conv) => conv._id === id);
      setConversation(currentConversation);
    }
  }, [id, conversations]);

  // ✅ OPTIMIZED: Set recipient ID immediately
  useEffect(() => {
    if (conversation && conversation.type !== "group") {
      const recipient = conversation.participants?.find(
        (p: any) => p.clerkId !== userId
      );
      if (recipient) {
        setRecipientId(recipient.clerkId);
      }
    } else if (conversation && conversation.type === "group") {
      setRecipientId(null);
    }
  }, [conversation, userId]);

  // ==========================================
  // ⭐ NEW: ACTIVE CONVERSATION TRACKING
  // ==========================================
  useEffect(() => {
    if (!socket || !id || !userId || !isConnected) {
      console.log("⏳ Waiting for socket...", {
        hasSocket: !!socket,
        conversationId: id,
        userId,
        isConnected,
      });
      return;
    }

    console.log("✅ Socket connected, joining conversation:", id);

    // ✅ Emit join
    socket.emit("joinConversation", {
      user_id: userId,
      conversation_id: id,
    });

    // ✅ Wait for confirmation
    const handleJoined = (data: any) => {
      console.log("✅ Successfully joined conversation:", data);
    };

    socket.on("joinedConversation", handleJoined);

    return () => {
      socket.off("joinedConversation", handleJoined);

      if (socket.connected) {
        socket.emit("leaveConversation", {
          user_id: userId,
          conversation_id: id,
        });
        console.log(`👋 Left conversation: ${id}`);
      }
    };
  }, [socket, id, userId, isConnected]);

  const handleUserActivity = useCallback(() => {
    if (socket && id && userId) {
      socket.emit("conversationActivity", {
        user_id: userId,
        conversation_id: id,
      });
    }
  }, [socket, id, userId]);

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 10,
    minimumViewTime: 100,
  }).current;

  // Handle scroll to specific message
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0 && hasScrolledToBottom) {
      const messageIndex = messages.findIndex(
        (m) => m._id === scrollToMessageId
      );

      if (messageIndex !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: messageIndex,
            animated: true,
            viewPosition: 0.5,
          });

          setHighlightedMessageId(scrollToMessageId);

          setTimeout(() => {
            setHighlightedMessageId(null);
          }, 2000);
        }, 300);
      }
    }
  }, [scrollToMessageId, messages.length, hasScrolledToBottom]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledToBottom && !scrollToMessageId) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        setHasScrolledToBottom(true);
        lastMessageCountRef.current = messages.length;
        socketMessageCountRef.current = socketMessageCount;
        setTimeout(() => setCanLoadMore(true), 500);
      }, 300);

      return () => clearTimeout(timer);
    } else if (
      messages.length > 0 &&
      !hasScrolledToBottom &&
      scrollToMessageId
    ) {
      setHasScrolledToBottom(true);
      lastMessageCountRef.current = messages.length;
      socketMessageCountRef.current = socketMessageCount;
      setTimeout(() => setCanLoadMore(true), 500);
    }
  }, [
    messages.length,
    hasScrolledToBottom,
    socketMessageCount,
    scrollToMessageId,
  ]);

  // Handle new messages
  useEffect(() => {
    if (
      socketMessageCount > socketMessageCountRef.current &&
      hasScrolledToBottom
    ) {
      const newSocketMessages =
        socketMessageCount - socketMessageCountRef.current;

      if (isLoadingMoreRef.current) {
        isLoadingMoreRef.current = false;
        lastLoadTimeRef.current = Date.now();

        if (
          firstVisibleItemBeforeLoad.current &&
          messages.length > lastMessageCountRef.current
        ) {
          setTimeout(() => {
            const index = messages.findIndex(
              (m) => m._id === firstVisibleItemBeforeLoad.current
            );
            if (index !== -1) {
              flatListRef.current?.scrollToIndex({
                index,
                animated: false,
                viewPosition: 0.3,
              });
            }
            firstVisibleItemBeforeLoad.current = null;
          }, 150);
        }
      }

      if (!isNearBottom && !isLoadingMoreRef.current) {
        setNewMessagesCount((prev) => prev + newSocketMessages);
        setShowScrollButton(true);
        Animated.timing(scrollButtonOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (isNearBottom && !isLoadingMoreRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }

    if (hasScrolledToBottom) {
      lastMessageCountRef.current = messages.length;
      socketMessageCountRef.current = socketMessageCount;
    }
  }, [socketMessageCount, isNearBottom, hasScrolledToBottom, messages.length]);

  // Mark conversation as read
  useEffect(() => {
    if (!userId || !id || messages.length === 0 || hasMarkedAsReadRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      markConversationAsRead(id)
        .then(() => {
          hasMarkedAsReadRef.current = true;
        })
        .catch((err) => {
          console.error("❌ markConversationAsRead FAILED:", err);
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [id, userId, messages.length, markConversationAsRead]);

  useEffect(() => {
    hasMarkedAsReadRef.current = false;
  }, [id]);

  // Mark individual messages as read
  useEffect(() => {
    if (!userId) return;

    const unreadMessages = messages.filter(
      (msg) =>
        !msg.read_by?.some((r: any) => r.user === userId) &&
        msg.sender?.clerkId !== userId
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach((msg) => {
        markAsRead(msg._id);
      });
    }
  }, [messages, markAsRead, userId]);

  // ========================================
  // CALL HANDLERS
  // ========================================

  const handleVideoCall = async () => {
    if (!id || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);

      const isGroup = conversation?.type === "group";
      const displayName = isGroup
        ? conversation?.name || "Group"
        : getConversationTitle();

      Alert.alert(
        `Start Video Call`,
        isGroup
          ? `Do you want to start a video call in ${displayName}?`
          : `Do you want to start a video call with ${displayName}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsInitiatingCall(false),
          },
          {
            text: "Call",
            onPress: async () => {
              try {
                const token = await getToken();

                const response = await axios.post(
                  `${API_URL}/api/calls/initiate`,
                  {
                    conversationId: id,
                    type: "video",
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                const { call } = response.data;

                router.push({
                  pathname: "/call/[id]" as any,
                  params: {
                    id: call.id,
                    channelName: call.channelName,
                    conversationId: id,
                    callType: "video",
                  },
                });
              } catch (error: any) {
                console.error("❌ Error starting video call:", error);
                Alert.alert(
                  "Error",
                  error.response?.data?.error || "Failed to start video call"
                );
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("❌ Error:", error);
      setIsInitiatingCall(false);
    }
  };

  const handleAudioCall = async () => {
    if (!id || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);

      const isGroup = conversation?.type === "group";
      const displayName = isGroup
        ? conversation?.name || "Group"
        : getConversationTitle();

      Alert.alert(
        `Start Audio Call`,
        isGroup
          ? `Do you want to start an audio call in ${displayName}?`
          : `Do you want to start an audio call with ${displayName}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsInitiatingCall(false),
          },
          {
            text: "Call",
            onPress: async () => {
              try {
                const token = await getToken();

                const response = await axios.post(
                  `${API_URL}/api/calls/initiate`,
                  {
                    conversationId: id,
                    type: "audio",
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                const { call } = response.data;

                router.push({
                  pathname: "/call/[id]" as any,
                  params: {
                    id: call.id,
                    channelName: call.channelName,
                    conversationId: id,
                    callType: "audio",
                  },
                });
              } catch (error: any) {
                console.error("❌ Error starting audio call:", error);
                Alert.alert(
                  "Error",
                  error.response?.data?.error || "Failed to start audio call"
                );
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("❌ Error:", error);
      setIsInitiatingCall(false);
    }
  };

  // ========================================
  // MESSAGE HANDLERS
  // ========================================

 const handleSendMessage = async (
  contentOrData:
    | string
    | {
        content?: string;
        type: string;
        replyTo?: string;
        encryptedFiles?: any[];
        localUris?: string[];
        richMedia?: any;
        isOptimistic?: boolean; // ✅ NEW
        tempId?: string; // ✅ NEW
      },
  attachments?: string[],
  replyToId?: string
) => {
  handleUserActivity();

  // ✅ CASE 0: Handle GIF/Sticker
  if (
    typeof contentOrData === "object" &&
    (contentOrData.type === "gif" || contentOrData.type === "sticker") &&
    (contentOrData as any).richMedia
  ) {
    try {
      await sendMessage({
        content: contentOrData.content?.trim() || "",
        type: contentOrData.type as any,
        richMedia: (contentOrData as any).richMedia,
        replyTo: contentOrData.replyTo,
      });

      setReplyTo(null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      return;
    } catch (error: any) {
      console.error(`❌ Failed to send ${contentOrData.type}:`, error);
      Alert.alert(t("message.failed"), error.message || t("message.failed"), [
        { text: t("ok") },
      ]);
      return;
    }
  }

  // ✅ CASE 1: Optimistic message (LOCAL only, no API call)
  if (
    typeof contentOrData === "object" &&
    contentOrData.isOptimistic === true
  ) {
    console.log("📤 [SCREEN] Creating LOCAL optimistic message");

    try {
      // ✅ Just create optimistic message in hook, don't call API
      await sendMessage({
        content: contentOrData.content?.trim() || "",
        type: contentOrData.type as any,
        localUris: contentOrData.localUris,
        replyTo: contentOrData.replyTo,
        tempId: contentOrData.tempId, // ✅ Pass tempId
        isOptimistic: true, // ✅ Flag for hook
      });

      setReplyTo(null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      console.log("✅ [SCREEN] Optimistic message created");
      return;
    } catch (error: any) {
      console.error("❌ Failed to create optimistic message:", error);
      return;
    }
  }

  // ✅ CASE 2: Send encrypted files to server (REAL API call)
  if (
    typeof contentOrData === "object" &&
    contentOrData.encryptedFiles &&
    contentOrData.tempId
  ) {
    console.log("📤 [SCREEN] Sending encrypted files to server");

    try {
      await sendMessage({
        content: contentOrData.content?.trim() || "",
        type: contentOrData.type as any,
        encryptedFiles: contentOrData.encryptedFiles,
        localUris: contentOrData.localUris,
        replyTo: contentOrData.replyTo,
        tempId: contentOrData.tempId, // ✅ To match optimistic message
      });

      console.log("✅ [SCREEN] Encrypted files sent");
      return;
    } catch (error: any) {
      console.error("❌ Failed to send encrypted files:", error);
      Alert.alert(t("message.failed"), error.message || t("message.failed"), [
        { text: t("ok") },
      ]);
      return;
    }
  }


    // ✅ CASE 3: Handle normal text message
    let messageContent: string;
    let messageAttachments: string[] | undefined;
    let messageReplyTo: string | undefined;

    if (typeof contentOrData === "string") {
      messageContent = contentOrData;
      messageAttachments = attachments;
      messageReplyTo = replyToId;
    } else {
      messageContent = contentOrData.content || "";
      messageAttachments = undefined;
      messageReplyTo = contentOrData.replyTo;
    }

    if (typeof messageContent !== "string") {
      Alert.alert(t("error"), "Invalid message content");
      return;
    }

    if (
      !messageContent.trim() &&
      (!messageAttachments || messageAttachments.length === 0)
    ) {
      return;
    }

    try {
      await sendMessage({
        content: messageContent.trim(),
        type: "text",
        attachments: messageAttachments,
        replyTo: messageReplyTo,
      });

      setReplyTo(null);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error("❌ Failed to send message:", error);
      Alert.alert(t("message.failed"), error.message || t("message.failed"), [
        { text: t("ok") },
      ]);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await editMessage(messageId, newContent);
    } catch (error: any) {
      Alert.alert(t("error"), error.message || t("message.failed"));
    }
  };

  const handleDeleteMessage = async (
    messageId: string,
    deleteType: "only_me" | "both"
  ) => {
    try {
      await deleteMessage(messageId, deleteType);
    } catch (error: any) {
      Alert.alert(t("error"), error.message || t("message.failed"));
    }
  };

  const handleAddReaction = async (messageId: string, reaction: string) => {
    try {
      await addReaction(messageId, reaction);
    } catch (error: any) {
      Alert.alert(t("error"), error.message || t("message.failed"));
    }
  };

  const handleRemoveReaction = async (messageId: string) => {
    try {
      await removeReaction(messageId);
    } catch (error: any) {
      Alert.alert(t("error"), error.message || t("message.failed"));
    }
  };

  const handleRetryDecryption = async (messageId: string) => {
    try {
      await retryDecryption(messageId);
      Alert.alert(t("success"), t("message.encryption.retrySuccess"));
    } catch (error: any) {
      console.error("❌ Retry decryption failed:", error);
      Alert.alert(
        t("message.encryption.retryTitle"),
        t("message.encryption.retryFailed"),
        [{ text: t("ok") }]
      );
    }
  };

  const handleReply = useCallback((message: any) => {
    setReplyTo(message);
  }, []);

  const handleLoadMore = useCallback(async () => {
    console.log("🔍 [LOAD_MORE] Called with:", {
      hasMore,
      loading,
      canLoadMore,
      isLoadingMore: isLoadingMoreRef.current,
      timeSinceLastLoad: Date.now() - lastLoadTimeRef.current,
    });

    if (
      !hasMore ||
      loading ||
      !canLoadMore ||
      Date.now() - lastLoadTimeRef.current < 1000
    ) {
      console.log("⏭️ [LOAD_MORE] Skipping - conditions not met");
      return;
    }

    if (isLoadingMoreRef.current) {
      console.log("⏭️ [LOAD_MORE] Already loading");
      return;
    }

    console.log("✅ [LOAD_MORE] Starting to load older messages...");
    isLoadingMoreRef.current = true;

    const visibleMessages = messages.slice(0, 5);
    if (visibleMessages.length > 0) {
      firstVisibleItemBeforeLoad.current = visibleMessages[0]._id;
      console.log(
        "📍 [LOAD_MORE] Saved first visible:",
        firstVisibleItemBeforeLoad.current
      );
    }

    try {
      await loadMoreMessages();
      console.log("✅ [LOAD_MORE] Successfully loaded more messages");
    } catch (error) {
      console.error("❌ [LOAD_MORE] Failed:", error);
      isLoadingMoreRef.current = false;
    }
  }, [hasMore, loading, loadMoreMessages, canLoadMore, messages]);
  let scrollDebounceTimer: NodeJS.Timeout | null = null;
  const handleScroll = useCallback(
    (event: any) => {
      handleUserActivity();

      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const scrollPosition = contentOffset.y;
      const scrollHeight = contentSize.height;
      const viewHeight = layoutMeasurement.height;

      // Handle scroll to bottom logic...
      const distanceFromBottom = scrollHeight - scrollPosition - viewHeight;
      const isNear = distanceFromBottom < 100;
      setIsNearBottom(isNear);

      if (isNear && showScrollButton) {
        setShowScrollButton(false);
        setNewMessagesCount(0);
        Animated.timing(scrollButtonOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }

      // ✅ IMPROVED: Debounced load more check
      const distanceFromTop = scrollPosition;

      if (
        distanceFromTop < 100 &&
        hasMore &&
        !isLoadingMoreRef.current &&
        canLoadMore
      ) {
        // ✅ Debounce to prevent multiple triggers
        if (scrollDebounceTimer) {
          clearTimeout(scrollDebounceTimer);
        }

        scrollDebounceTimer = setTimeout(() => {
          console.log("📜 Loading more messages... (scrolled to top)");
          handleLoadMore();
        }, 300); // ✅ Wait 300ms before triggering
      }
    },
    [showScrollButton, hasMore, canLoadMore, handleLoadMore, handleUserActivity]
  );

  const handleScrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollButton(false);
    setNewMessagesCount(0);
    Animated.timing(scrollButtonOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    // Handle viewable items if needed
  }, []);

  const getConversationTitle = () => {
    if (!conversation) return "Chat";

    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }

    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return (
      otherParticipant?.full_name ||
      otherParticipant?.username ||
      "Unknown User"
    );
  };

  const getConversationAvatar = () => {
    if (!conversation) return null;

    if (conversation.type === "group") {
      return conversation.avatar;
    }

    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.avatar;
  };

  const getOnlineStatus = () => {
    if (!conversation || conversation.type === "group") return null;

    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );

    if (!otherParticipant) return null;

    if (isUserOnline(otherParticipant.clerkId)) {
      return "Online";
    }

    if (otherParticipant?.last_seen) {
      const lastSeen = new Date(otherParticipant.last_seen);
      const now = new Date();
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }

    return "Offline";
  };

  const isUserOnlineInConversation = (): boolean => {
    if (!conversation) return false;

    if (conversation.type === "private") {
      const otherParticipant = conversation.participants?.find(
        (p: any) => p.clerkId !== userId
      );
      if (otherParticipant) {
        return isUserOnline(otherParticipant.clerkId);
      }
    }

    return false;
  };

  const handleTypingStart = () => {
    handleUserActivity();
    sendTypingIndicator(true);
  };

  const handleTypingStop = () => {
    sendTypingIndicator(false);
  };

  // ========================================
  // RENDER FUNCTIONS - ✅ MEMOIZED
  // ========================================

  // ✅ CRITICAL: Memoize renderMessage to prevent unnecessary re-renders
  const renderMessage = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      // System message
      if (item.metadata?.isSystemMessage === true) {
        return <MemoizedSystemMessage message={item} />;
      }

      const isOwnMessage = item.sender?.clerkId === userId;
      const isHighlighted = item._id === highlightedMessageId;

      return (
        <MemoizedMessageItem
          message={item}
          isOwnMessage={isOwnMessage}
          onReply={handleReply}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReaction={handleAddReaction}
          onRemoveReaction={handleRemoveReaction}
          isHighlighted={isHighlighted}
          onRetryDecryption={handleRetryDecryption}
          encryptionReady={encryptionReady}
        />
      );
    },
    [
      userId,
      highlightedMessageId,
      handleReply,
      handleEditMessage,
      handleDeleteMessage,
      handleAddReaction,
      handleRemoveReaction,
      handleRetryDecryption,
      encryptionReady,
    ]
  );

  // ✅ CRITICAL: Memoize keyExtractor
  const keyExtractor = useCallback((item: any) => item._id, []);

  const renderLoadingHeader = () => {
    // ✅ Show loading indicator khi đang load more
    if (!hasMore && !loading) return null;

    // ✅ NEW: Show different indicator for loading more vs initial load
    if (isLoadingMoreRef.current) {
      return (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#F97316" />
          <Text
            className={`text-xs mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            Loading older messages...
          </Text>
        </View>
      );
    }

    if (!hasMore || !loading) return null;

    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#F97316" />
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <TypingIndicator
        typingUsers={typingUsers}
        currentUserId={userId || ""}
        onTypingStart={handleTypingStart}
      />
    );
  };

  const renderHeader = () => {
    const avatarUrl = getConversationAvatar();
    const isGroup = conversation?.type === "group";

    return (
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}
      >
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#F97316" : "#000"}
          />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center ml-3">
          <View className="relative mr-3">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <View
                className={`w-10 h-10 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-300"} items-center justify-center`}
              >
                <Ionicons
                  name={isGroup ? "people" : "person"}
                  size={20}
                  color={isDark ? "#fff" : "#666"}
                />
              </View>
            )}
            {isUserOnlineInConversation() && (
              <View className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center">
              <Text
                className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-800"}`}
              >
                {getConversationTitle()}
              </Text>

              {encryptionReady && (
                <View className="ml-2 bg-green-500 rounded-full px-2 py-0.5">
                  <Text className="text-white text-xs font-bold">🔒</Text>
                </View>
              )}
            </View>

            {typingUsers.length > 0 ? (
              <Text className="text-sm text-orange-500 italic">typing...</Text>
            ) : isGroup ? (
              <Text
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                {conversation?.participants?.length || 0} members
              </Text>
            ) : getOnlineStatus() ? (
              <Text
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                {getOnlineStatus()}
              </Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          className="p-2"
          onPress={handleAudioCall}
          disabled={isInitiatingCall}
        >
          <Ionicons
            name="call"
            size={24}
            color={isInitiatingCall ? "#ccc" : isDark ? "#fff" : "#000"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          className="p-2"
          onPress={handleVideoCall}
          disabled={isInitiatingCall}
        >
          <Ionicons
            name="videocam"
            size={24}
            color={isInitiatingCall ? "#ccc" : isDark ? "#fff" : "#000"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          className="p-2"
          onPress={() =>
            router.push({
              pathname: "/message/info/[id]" as any,
              params: {
                id: id,
                type: conversation?.type || "private",
                name: getConversationTitle(),
                avatar: getConversationAvatar() || "",
                participantCount: conversation?.participants?.length || 2,
              },
            })
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={isDark ? "#fff" : "#000"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Text className="text-6xl mb-4">🔒</Text>
      <Text
        className={`text-center text-lg font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}
      >
        No messages yet
      </Text>
      <Text
        className={`text-center mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
      >
        Send the first message to start the conversation
      </Text>

      {encryptionReady && (
        <View
          className={`mt-4 rounded-lg px-4 py-2 ${isDark ? "bg-green-900/20" : "bg-green-50"}`}
        >
          <Text
            className={`text-sm font-medium text-center ${isDark ? "text-green-300" : "text-green-700"}`}
          >
            End-to-end encryption enabled
          </Text>
        </View>
      )}
    </View>
  );

  const renderScrollToBottomButton = () => {
    if (!showScrollButton) return null;

    return (
      <Animated.View
        style={{
          position: "absolute",
          bottom: 80,
          right: 16,
          opacity: scrollButtonOpacity,
        }}
      >
        <TouchableOpacity
          onPress={handleScrollToBottom}
          className="bg-orange-500 rounded-full p-3 shadow-lg flex-row items-center"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Ionicons name="arrow-down" size={20} color="#fff" />
          {newMessagesCount > 0 && (
            <View className="ml-2 bg-white rounded-full px-2 py-1">
              <Text className="text-orange-500 text-xs font-bold">
                {newMessagesCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  if (error) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={isDark ? "#000000" : "#FFFFFF"}
        />
        {renderHeader()}
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text
            className={`text-center mt-4 text-lg ${isDark ? "text-red-400" : "text-red-500"}`}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-orange-500 rounded-full px-6 py-3 mt-6"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      {renderHeader()}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {messages.length === 0 && !loading ? (
          renderEmptyState()
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={keyExtractor}
              className="flex-1 px-4"
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              inverted={false}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={10}
              // ✅ CRITICAL: Add these for better performance
              removeClippedSubviews={Platform.OS === "android"}
              updateCellsBatchingPeriod={50}
              ListHeaderComponent={renderLoadingHeader}
              ListFooterComponent={renderTypingIndicator}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onScrollToIndexFailed={(info) => {
                const wait = new Promise((resolve) => setTimeout(resolve, 100));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                    viewPosition: 0.5,
                  });
                });
              }}
            />
            {renderScrollToBottomButton()}
          </>
        )}

        <MessageInput
          conversationId={id}
          recipientId={recipientId}
          onSendMessage={handleSendMessage}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onTyping={sendTypingIndicator}
          disabled={!encryptionReady}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
