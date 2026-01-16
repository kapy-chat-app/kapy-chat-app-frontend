// MessageScreen.tsx - FIXED TYPING INDICATOR WITH USERNAME
import MessageInput from "@/components/page/message/MessageInput";
import MessageItem from "@/components/page/message/MessageItem";
import SystemMessage from "@/components/page/message/SystemMessage";
import { TypingIndicator } from "@/components/page/message/TypingIndicator";
import { UserLastSeen } from "@/components/page/profile/UserLastSeen";
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
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const MemoizedMessageItem = memo(MessageItem, (prevProps, nextProps) => {
  // Check if message is recalled - this must trigger re-render
  const prevRecalled = prevProps.message.metadata?.isRecalled || false;
  const nextRecalled = nextProps.message.metadata?.isRecalled || false;
  
  if (prevRecalled !== nextRecalled) {
    console.log(`🔄 [MEMO] Message ${nextProps.message._id} recall state changed: ${prevRecalled} -> ${nextRecalled}`);
    return false; // Force re-render
  }

  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    JSON.stringify(prevProps.message.attachments) ===
      JSON.stringify(nextProps.message.attachments) &&
    JSON.stringify(prevProps.message.reactions) ===
      JSON.stringify(nextProps.message.reactions)
  );
});

const MemoizedSystemMessage = memo(SystemMessage, (prevProps, nextProps) => {
  return prevProps.message._id === nextProps.message._id;
});

export default function MessageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    scrollToMessageId?: string;
  }>();
  const id = params.id as string;
  const scrollToMessageId = params.scrollToMessageId as string | undefined;
  const { userId, getToken } = useAuth();
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const flatListRef = useRef<FlatList>(null);
  const isAtBottomRef = useRef(true);
  const scrollMetricsRef = useRef({
    layoutHeight: 0,
    contentHeight: 0,
    offsetY: 0,
  });
  const [replyTo, setReplyTo] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  const [isInitiatingCall, setIsInitiatingCall] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const lastMessageCountRef = useRef(0);
  const socketMessageCountRef = useRef(0);
  const hasMarkedAsReadRef = useRef(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const firstVisibleItemRef = useRef<string | null>(null);

  const scrollDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const markedAsReadRef = useRef<Set<string>>(new Set());
  const isDark = actualTheme === "dark";

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isInitialized: encryptionReady,
    loading: encryptionLoading,
    prefetchConversationKeys, // ✅ NEW
  } = useEncryption();

  const {
    messages,
    loading,
    error,
    sendMessage,
    editMessage,
    recallMessage,
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

  const { socket, isConnected, isUserOnline } = useSocket();
  const { conversations } = useConversations();

  useEffect(() => {
    console.log("✅ [MessageScreen] Mounted for conversation:", id);
    console.log("✅ [MessageScreen] Socket connected:", isConnected);
    console.log("✅ [MessageScreen] Current typing users:", typingUsers);

    return () => {
      console.log("🧹 [MessageScreen] Unmounting, cleaning up...");

      if (socket && id && userId) {
        socket.emit("sendTypingIndicator", {
          conversation_id: id,
          user_id: userId,
          is_typing: false,
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [id, isConnected, userId, socket]);

  const conversationTitle = useMemo(() => {
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
  }, [conversation, userId]);

  const conversationAvatar = useMemo(() => {
    if (!conversation) return null;
    if (conversation.type === "group") {
      return conversation.avatar;
    }
    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.avatar;
  }, [conversation, userId]);

  // ✅ NEW: Get current user's full_name from conversation participants
  const currentUserName = useMemo(() => {
    console.log("🔍 [DEBUG] conversation:", conversation);
    console.log("🔍 [DEBUG] userId:", userId);
    console.log("🔍 [DEBUG] participants:", conversation?.participants);

    if (!conversation || !userId) {
      console.log("❌ [DEBUG] No conversation or userId");
      return "User";
    }

    const currentParticipant = conversation.participants?.find(
      (p: any) => p.clerkId === userId
    );

    console.log("🔍 [DEBUG] currentParticipant:", currentParticipant);
    console.log("🔍 [DEBUG] full_name:", currentParticipant?.full_name);
    console.log("🔍 [DEBUG] username:", currentParticipant?.username);
    console.log("🔍 [DEBUG] email:", currentParticipant?.email);

    // ✅ FALLBACK CHAIN: full_name → username → email → "User"
    const name =
      currentParticipant?.full_name ||
      currentParticipant?.username ||
      currentParticipant?.email ||
      "User";

    console.log("✅ [DEBUG] Final userName:", name);

    return name;
  }, [conversation, userId]);

  const isUserOnlineInConversation = useMemo((): boolean => {
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
  }, [conversation, userId, isUserOnline]);

  const scrollToBottomIfNeeded = (animated = true) => {
    if (!isAtBottomRef.current) return;

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 50);
  };

  const forceScrollToBottom = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 50);
  };

  useEffect(() => {
    if (id && conversations.length > 0) {
      const currentConversation = conversations.find((conv) => conv._id === id);
      setConversation(currentConversation);
    }
  }, [id, conversations]);

  useEffect(() => {
    const subShow = Keyboard.addListener("keyboardDidShow", () => {
      scrollToBottomIfNeeded(true);
    });

    return () => subShow.remove();
  }, []);

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

  useEffect(() => {
    if (!socket || !id || !userId || !isConnected) return;

    console.log("🚪 [MessageScreen] Joining conversation room:", id);

    socket.emit("joinConversation", {
      user_id: userId,
      conversation_id: id,
    });

    return () => {
      if (socket.connected) {
        console.log("🚪 [MessageScreen] Leaving conversation room:", id);

        socket.emit("leaveConversation", {
          user_id: userId,
          conversation_id: id,
        });
      }
    };
  }, [socket, id, userId, isConnected]);

  useEffect(() => {
    return () => {
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledToBottom && !scrollToMessageId) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        setHasScrolledToBottom(true);
        lastMessageCountRef.current = messages.length;
        socketMessageCountRef.current = socketMessageCount;
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
    }
  }, [
    messages.length,
    hasScrolledToBottom,
    socketMessageCount,
    scrollToMessageId,
  ]);

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

  useEffect(() => {
    if (
      isLoadingMoreRef.current &&
      firstVisibleItemRef.current &&
      messages.length > lastMessageCountRef.current
    ) {
      console.log(
        `📍 [LOAD MORE] Messages increased: ${lastMessageCountRef.current} → ${messages.length}`
      );
      console.log(
        `📍 [LOAD MORE] Restoring scroll to: ${firstVisibleItemRef.current}`
      );

      const index = messages.findIndex(
        (m) => m._id === firstVisibleItemRef.current
      );

      if (index !== -1) {
        setTimeout(() => {
          console.log(`📍 [LOAD MORE] Scrolling to index ${index}`);

          flatListRef.current?.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0.1,
          });

          console.log(`✅ [LOAD MORE] Scroll restored`);

          firstVisibleItemRef.current = null;
          isLoadingMoreRef.current = false;
          lastMessageCountRef.current = messages.length;
        }, 150);
      } else {
        console.warn(
          `⚠️ [LOAD MORE] Could not find anchor: ${firstVisibleItemRef.current}`
        );

        isLoadingMoreRef.current = false;
        firstVisibleItemRef.current = null;
        lastMessageCountRef.current = messages.length;
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (isLoadingMoreRef.current) {
      console.log(`⏳ [SOCKET] Skipping - load more in progress`);
      return;
    }

    if (
      socketMessageCount > socketMessageCountRef.current &&
      hasScrolledToBottom
    ) {
      const newSocketMessages =
        socketMessageCount - socketMessageCountRef.current;

      console.log(`🔔 [SOCKET] ${newSocketMessages} new message(s)`);

      if (!isAtBottomRef.current) {
        console.log(
          `📍 [SOCKET] User scrolled up - showing button (${newSocketMessages} new)`
        );

        setNewMessagesCount((prev) => prev + newSocketMessages);
        setShowScrollButton(true);

        Animated.timing(scrollButtonOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        console.log(`📍 [SOCKET] User at bottom - auto-scrolling`);
        scrollToBottomIfNeeded(true);
      }

      lastMessageCountRef.current = messages.length;
      socketMessageCountRef.current = socketMessageCount;
    }
  }, [socketMessageCount, isNearBottom, hasScrolledToBottom, messages.length]);

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

  useEffect(() => {
    if (!userId) return;

    const unreadMessages = messages.filter(
      (msg) =>
        !msg.read_by?.some((r: any) => r.user === userId) &&
        msg.sender?.clerkId !== userId &&
        !markedAsReadRef.current.has(msg._id)
    );

    if (unreadMessages.length > 0) {
      console.log(
        `📖 [READ] Marking ${unreadMessages.length} messages as read`
      );

      unreadMessages.forEach((msg) => {
        markedAsReadRef.current.add(msg._id);
        markAsRead(msg._id);
      });
    }
  }, [messages, markAsRead, userId]);

  useEffect(() => {
    markedAsReadRef.current.clear();
  }, [id]);

  // ✅ NEW: Prefetch keys when conversation loads
  useEffect(() => {
    const prefetchKeys = async () => {
      if (!conversation || !encryptionReady) return;

      console.log("🔄 [MessageScreen] Prefetching conversation keys...");

      try {
        const participantIds =
          conversation.participants?.map((p: any) => p.clerkId) || [];

        if (participantIds.length > 0) {
          await prefetchConversationKeys(participantIds);
          console.log("✅ [MessageScreen] Keys prefetched successfully");
        }
      } catch (error) {
        console.error("❌ [MessageScreen] Key prefetch failed:", error);
        // Don't block UI - encryption will fetch on-demand if needed
      }
    };

    prefetchKeys();
  }, [conversation, encryptionReady, prefetchConversationKeys]);

  const handleVideoCall = async () => {
    if (!id || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);

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
  };

  const handleAudioCall = async () => {
    if (!id || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);

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
  };

  const handleSendMessage = async (data: any) => {
    try {
      console.log("📥 [SCREEN] Received data:", {
        type: typeof data,
        isFormData: data instanceof FormData,
        hasEncryptedContent: !!(data as any).encryptedContent,
        hasEncryptionMetadata: !!(data as any).encryptionMetadata,
        hasEncryptedFiles: !!(data as any).encryptedFiles,
        dataType: data.type,
        isOptimistic: !!(data as any).isOptimistic,
      });

      await sendMessage(data);

      // ✅ Case 1: server confirm
      if (!(data as any).isOptimistic) {
        setReplyTo(null);

        // ✅ Messenger behavior: user sent -> ALWAYS scroll to bottom
        forceScrollToBottom(true);

        console.log("✅ [SCREEN] Message sent successfully");
        return;
      }

      // ✅ Case 2: optimistic UI
      console.log("✅ [SCREEN] Optimistic message created in FlatList");

      // ✅ Messenger behavior: user sent -> ALWAYS scroll to bottom
      forceScrollToBottom(true);
    } catch (error: any) {
      console.error("❌ [SCREEN] Failed to send message:", error);
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
    if (!hasMore || loading || isLoadingMoreRef.current) {
      return;
    }

    console.log("📜 [LOAD MORE] Starting...");
    console.log(`   Current messages: ${messages.length}`);
    console.log(`   Oldest message: ${messages[0]?._id}`);

    isLoadingMoreRef.current = true;

    const visibleMessages = messages.slice(0, 10);
    if (visibleMessages.length > 0) {
      firstVisibleItemRef.current = visibleMessages[0]._id;
      console.log(
        `📍 [LOAD MORE] Saved scroll anchor: ${firstVisibleItemRef.current}`
      );
    }

    try {
      await loadMoreMessages();

      console.log(`✅ [LOAD MORE] Completed`);
      console.log(`   New total messages: ${messages.length}`);
    } catch (error) {
      console.error("❌ [LOAD MORE] Failed:", error);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [hasMore, loading, loadMoreMessages, messages]);

  const handleRecallMessage = async (messageId: string) => {
    try {
      await recallMessage(messageId);
    } catch (error: any) {
      Alert.alert(t("error"), error.message || t("message.failed"));
    }
  };

  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const scrollPosition = contentOffset.y;
      const scrollHeight = contentSize.height;
      const viewHeight = layoutMeasurement.height;

      const distanceFromBottom = scrollHeight - scrollPosition - viewHeight;
      const isNear = distanceFromBottom < 100;

      // ✅ ref: no rerender
      isAtBottomRef.current = isNear;

      // ✅ state: used for UI (scroll button, count...)
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

      const distanceFromTop = scrollPosition;

      if (distanceFromTop < 50 && hasMore && !isLoadingMoreRef.current) {
        if (scrollDebounceTimerRef.current) {
          clearTimeout(scrollDebounceTimerRef.current);
        }

        scrollDebounceTimerRef.current = setTimeout(() => {
          console.log(
            `📜 [SCROLL] Triggering load more (distance from top: ${distanceFromTop}px)`
          );
          handleLoadMore();
          scrollDebounceTimerRef.current = null;
        }, 200);
      }
    },
    [showScrollButton, hasMore, handleLoadMore]
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

  const handleTypingStart = useCallback(() => {
    console.log("⌨️ [CLIENT] User started typing");

    sendTypingIndicator(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      console.log("⌨️ [CLIENT] Auto-stop typing (timeout)");
      sendTypingIndicator(false);
    }, 3000);
  }, [sendTypingIndicator]);

  const handleTypingStop = useCallback(() => {
    console.log("⌨️ [CLIENT] User stopped typing");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    sendTypingIndicator(false);
  }, [sendTypingIndicator]);

  const renderMessage = useCallback(
    ({ item, index }: { item: any; index: number }) => {
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
          onRecall={handleRecallMessage}
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
      handleRecallMessage,
      handleAddReaction,
      handleRemoveReaction,
      handleRetryDecryption,
      encryptionReady,
    ]
  );

  const keyExtractor = useCallback((item: any) => item._id, []);

  const renderLoadingHeader = () => {
    if (!hasMore) return null;

    if (isLoadingMoreRef.current || loading) {
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

    return null;
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    console.log("⌨️ [CLIENT] Rendering typing indicator:", typingUsers);

    return (
      <TypingIndicator
        typingUsers={typingUsers}
        currentUserId={userId || ""}
        onTypingStart={handleTypingStart}
      />
    );
  };

  const renderHeader = useMemo(() => {
    const isGroup = conversation?.type === "group";

    const otherParticipant = !isGroup
      ? conversation?.participants?.find((p: any) => p.clerkId !== userId)
      : null;

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
            {conversationAvatar ? (
              <Image
                source={{ uri: conversationAvatar }}
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
            {isUserOnlineInConversation && (
              <View className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center">
              <Text
                className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-800"}`}
              >
                {conversationTitle}
              </Text>

              {encryptionReady && (
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={isDark ? "#fff" : "#000"}
                  style={{ marginLeft: 6 }}
                />
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
            ) : otherParticipant ? (
              <UserLastSeen
                userId={otherParticipant.clerkId}
                showDot={false}
                textSize="sm"
              />
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
                name: conversationTitle,
                avatar: conversationAvatar || "",
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
  }, [
    conversation,
    isDark,
    router,
    conversationAvatar,
    isUserOnlineInConversation,
    conversationTitle,
    encryptionReady,
    typingUsers.length,
    isInitiatingCall,
    handleAudioCall,
    handleVideoCall,
    id,
    userId,
  ]);

  const renderEmptyState = () => <View className="flex-1" />;

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

  if (error) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={isDark ? "#000000" : "#FFFFFF"}
        />
        {renderHeader}
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
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      {renderHeader}

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}   // ✅ giống AI Chat
  keyboardVerticalOffset={0}
>
  {/* ✅ Chat Area */}
  <View style={{ flex: 1 }}>
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={keyExtractor}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 12,
      }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      inverted={false}
      removeClippedSubviews={Platform.OS === "android"}
      keyboardShouldPersistTaps="handled"
    />

    {renderScrollToBottomButton()}
  </View>

  {/* ✅ Input */}
  <MessageInput
    conversationId={id}
    recipientId={recipientId}
    onSendMessage={handleSendMessage}
    replyTo={replyTo}
    onCancelReply={() => setReplyTo(null)}
    onTyping={sendTypingIndicator}
    disabled={!encryptionReady}
    userName={currentUserName}
    onFocusInput={() => scrollToBottomIfNeeded(true)}
  />
</KeyboardAvoidingView>

    </SafeAreaView>
  );
}