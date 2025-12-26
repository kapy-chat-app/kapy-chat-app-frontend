// MessageScreen.tsx - FIXED VERSION WITH TYPING LISTENER
// ✅ Added socket listener for typing indicator

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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Memoize MessageItem
const MemoizedMessageItem = memo(MessageItem, (prevProps, nextProps) => {
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

  const { isInitialized: encryptionReady, loading: encryptionLoading } =
    useEncryption();

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

  const { socket, isConnected, isUserOnline } = useSocket();
  const { conversations } = useConversations();

  // ✅ FIX: Add typing indicator listener
  useEffect(() => {
    if (!socket || !id) return;

    const handleTyping = (data: any) => {
      console.log("⌨️ [CLIENT] Received typing event:", data);
      
      if (data.conversation_id !== id) {
        console.log("⌨️ [CLIENT] Ignoring - different conversation");
        return;
      }

      if (data.user_id === userId) {
        console.log("⌨️ [CLIENT] Ignoring - own typing event");
        return;
      }

      // This will be handled by useMessages hook's typingUsers state
      console.log(`⌨️ [CLIENT] User ${data.user_name} typing: ${data.is_typing}`);
    };

    socket.on("userTyping", handleTyping);

    console.log("✅ [CLIENT] Typing listener registered for conversation:", id);

    return () => {
      socket.off("userTyping", handleTyping);
      console.log("🧹 [CLIENT] Typing listener cleaned up");
    };
  }, [socket, id, userId]);

  // Memoize expensive computations
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

  const onlineStatus = useMemo(() => {
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
  }, [conversation, userId, isUserOnline]);

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

  // Set conversation
  useEffect(() => {
    if (id && conversations.length > 0) {
      const currentConversation = conversations.find((conv) => conv._id === id);
      setConversation(currentConversation);
    }
  }, [id, conversations]);

  // Set recipient ID
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

  // Join/Leave conversation
  useEffect(() => {
    if (!socket || !id || !userId || !isConnected) return;

    socket.emit("joinConversation", {
      user_id: userId,
      conversation_id: id,
    });

    return () => {
      if (socket.connected) {
        socket.emit("leaveConversation", {
          user_id: userId,
          conversation_id: id,
        });
      }
    };
  }, [socket, id, userId, isConnected]);

  // Cleanup scroll timer on unmount
  useEffect(() => {
    return () => {
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current);
      }
    };
  }, []);

  // Auto scroll to bottom ONCE when messages load
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

  // Handle LOAD MORE scroll restoration ONLY
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

  // Handle NEW SOCKET MESSAGES separately
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

      if (!isNearBottom) {
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

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }

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
      msg.sender?.clerkId !== userId &&
      !markedAsReadRef.current.has(msg._id)  // ✅ Skip already marked
  );

  if (unreadMessages.length > 0) {
    console.log(`📖 [READ] Marking ${unreadMessages.length} messages as read`);
    
    unreadMessages.forEach((msg) => {
      markedAsReadRef.current.add(msg._id);  // ✅ Track it
      markAsRead(msg._id);
    });
  }
}, [messages, markAsRead, userId]);

useEffect(() => {
  markedAsReadRef.current.clear();
}, [id]);
  // =============================================
  // CALL HANDLERS
  // =============================================

  const handleVideoCall = async () => {
    if (!id || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);

      const isGroup = conversation?.type === "group";

      Alert.alert(
        `Start Video Call`,
        isGroup
          ? `Do you want to start a video call in ${conversationTitle}?`
          : `Do you want to start a video call with ${conversationTitle}?`,
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

      Alert.alert(
        `Start Audio Call`,
        isGroup
          ? `Do you want to start an audio call in ${conversationTitle}?`
          : `Do you want to start an audio call with ${conversationTitle}?`,
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

  // =============================================
  // MESSAGE HANDLERS
  // =============================================

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

    // ✅ Handle optimistic message creation (don't send to server yet)
    if ((data as any).isOptimistic === true) {
      console.log("🎯 [SCREEN] Creating optimistic message locally");
      // This creates a local preview message
      // The actual server call will happen in the next onSendMessage call
      return;
    }

    // ✅ Pass data AS-IS to sendMessage
    await sendMessage(data);

    // ✅ Clear reply
    setReplyTo(null);

    // ✅ Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    console.log("✅ [SCREEN] Message sent successfully");
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

  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const scrollPosition = contentOffset.y;
      const scrollHeight = contentSize.height;
      const viewHeight = layoutMeasurement.height;

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
    console.log("⌨️ [CLIENT] Sending typing START");
    sendTypingIndicator(true);
  }, [sendTypingIndicator]);

  const handleTypingStop = useCallback(() => {
    console.log("⌨️ [CLIENT] Sending typing STOP");
    sendTypingIndicator(false);
  }, [sendTypingIndicator]);

  // =============================================
  // RENDER FUNCTIONS
  // =============================================

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
            ) : onlineStatus ? (
              <Text
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                {onlineStatus}
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
    onlineStatus,
    isInitiatingCall,
    handleAudioCall,
    handleVideoCall,
    id,
  ]);

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

  // =============================================
  // MAIN RENDER
  // =============================================

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
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      {renderHeader}

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
              removeClippedSubviews={Platform.OS === "android"}
              updateCellsBatchingPeriod={50}
              ListHeaderComponent={renderLoadingHeader}
              ListFooterComponent={renderTypingIndicator}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ viewAreaCoveragePercentThreshold: 10 }}
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