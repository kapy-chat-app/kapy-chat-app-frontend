// MessageScreen.tsx - UPDATED WITH E2EE (GIỮ NGUYÊN TẤT CẢ CODE CŨ)
import MessageInput from "@/components/page/message/MessageInput";
import MessageItem from "@/components/page/message/MessageItem";
import { TypingIndicator } from "@/components/page/message/TypingIndicator";
import { useConversations } from "@/hooks/message/useConversations";
import { useEncryption } from "@/hooks/message/useEncryption"; // ✨ NEW: E2EE Hook
import { useMessages } from "@/hooks/message/useMessages";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

  const isDark = actualTheme === "dark";

  useEffect(() => {
    if (conversation && conversation.type !== "group") {
      const recipient = conversation.participants?.find(
        (p: any) => p.clerkId !== userId
      );
      if (recipient) {
        setRecipientId(recipient.clerkId);
        console.log("✅ Recipient ID set for E2EE files:", recipient.clerkId);
      }
    } else if (conversation && conversation.type === "group") {
      // For group chats, we can't encrypt files (would need multi-recipient encryption)
      setRecipientId(null);
      console.log("⚠️ Group chat - file encryption not supported yet");
    }
  }, [conversation, userId]);

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 10,
    minimumViewTime: 100,
  }).current;

  // ✨ NEW: E2EE Hook - Không ảnh hưởng code cũ
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
    retryDecryption, // ✨ NEW: Function để retry decrypt
  } = useMessages(id || null);

  const { conversations } = useConversations();

  useEffect(() => {
    if (id && conversations.length > 0) {
      const currentConversation = conversations.find((conv) => conv._id === id);
      setConversation(currentConversation);
    }
  }, [id, conversations]);

  // ✨ NEW: Log E2EE status (không ảnh hưởng gì)
  useEffect(() => {
    if (!encryptionReady && !encryptionLoading) {
      console.warn("⚠️ E2EE not initialized yet");
    } else if (encryptionReady) {
      console.log("✅ E2EE ready for conversation:", id);
    }
  }, [encryptionReady, encryptionLoading, id]);

  // Handle scroll to specific message - GIỮ NGUYÊN
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

  // Auto scroll to bottom - GIỮ NGUYÊN
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

  // Handle new messages - GIỮ NGUYÊN
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

  // Mark conversation as read - GIỮ NGUYÊN
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

  // Mark individual messages as read - GIỮ NGUYÊN
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
  // CALL HANDLERS - GIỮ NGUYÊN
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
        t('message.call.video.title'),
        isGroup
          ? t('message.call.video.groupMessage', { name: displayName })
          : t('message.call.video.privateMessage', { name: displayName }),
        [
          {
            text: t('message.call.cancel'),
            style: "cancel",
            onPress: () => setIsInitiatingCall(false),
          },
          {
            text: t('message.call.start'),
            onPress: async () => {
              try {
                const token = await getToken();

                const response = await axios.post(
                  `${API_URL}/api/call/video/start`,
                  {
                    conversationId: id,
                    type: isGroup ? "group" : "private",
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                if (response.data.success) {
                  router.push({
                    pathname: "/call/video/[id]" as any,
                    params: {
                      id: response.data.data.callId,
                      conversationId: id,
                      isInitiator: true,
                    },
                  });
                }
              } catch (error) {
                console.error("Failed to start video call:", error);
                Alert.alert(t('error'), t('message.call.video.failed'));
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error:", error);
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
        t('message.call.audio.title'),
        isGroup
          ? t('message.call.audio.groupMessage', { name: displayName })
          : t('message.call.audio.privateMessage', { name: displayName }),
        [
          {
            text: t('message.call.cancel'),
            style: "cancel",
            onPress: () => setIsInitiatingCall(false),
          },
          {
            text: t('message.call.start'),
            onPress: async () => {
              try {
                const token = await getToken();

                const response = await axios.post(
                  `${API_URL}/api/call/audio/start`,
                  {
                    conversationId: id,
                    type: isGroup ? "group" : "private",
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                if (response.data.success) {
                  router.push({
                    pathname: "/call/audio/[id]" as any,
                    params: {
                      id: response.data.data.callId,
                      conversationId: id,
                      isInitiator: true,
                    },
                  });
                }
              } catch (error) {
                console.error("Failed to start audio call:", error);
                Alert.alert(t('error'), t('message.call.audio.failed'));
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error:", error);
      setIsInitiatingCall(false);
    }
  };

  // ========================================
  // MESSAGE HANDLERS
  // ========================================

  // ✨ UPDATED: Send message với E2EE check
  const handleSendMessage = async (
    contentOrData:
      | string
      | {
          content?: string;
          type: string;
          replyTo?: string;
          encryptedFiles?: any[];
          localUris?: string[];
        },
    attachments?: string[],
    replyToId?: string
  ) => {
    // ✅ Handle encrypted files case
    if (typeof contentOrData === 'object' && contentOrData.encryptedFiles) {
    console.log('📤 Sending message with encrypted files:', {
      filesCount: contentOrData.encryptedFiles.length,
      hasContent: !!contentOrData.content,
      type: contentOrData.type,
      hasLocalUris: !!contentOrData.localUris, // ✅ NEW
    });

    if (!encryptionReady) {
      Alert.alert(
        t('message.encryption.notReady'),
        t('message.encryption.waitMessage'),
        [{ text: t('ok') }]
      );
      return;
    }

    try {
      console.log('📤 Sending encrypted files...');
      
      await sendMessage({
        content: contentOrData.content?.trim() || '',
        type: contentOrData.type as any,
        encryptedFiles: contentOrData.encryptedFiles,
        localUris: contentOrData.localUris, // ✅ NEW
        replyTo: contentOrData.replyTo,
      });

      setReplyTo(null);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      console.log('✅ Message with encrypted files sent successfully');
      return;
    } catch (error: any) {
      console.error('❌ Failed to send encrypted files:', error);
      Alert.alert(
        t('message.failed'),
        error.message || t('message.failed'),
        [{ text: t('ok') }]
      );
      return;
    }
  }

    // ✅ Handle normal message (text only)
    let messageContent: string;
    let messageAttachments: string[] | undefined;
    let messageReplyTo: string | undefined;

    if (typeof contentOrData === "string") {
      // Called with (string, attachments, replyToId)
      messageContent = contentOrData;
      messageAttachments = attachments;
      messageReplyTo = replyToId;
    } else {
      // Called with object (no encrypted files)
      messageContent = contentOrData.content || "";
      messageAttachments = undefined;
      messageReplyTo = contentOrData.replyTo;
    }

    // ✅ Validate
    console.log("📤 handleSendMessage called:", {
      contentType: typeof messageContent,
      content: messageContent,
      contentLength: messageContent?.length,
      attachments: messageAttachments,
      replyToId: messageReplyTo,
    });

    if (typeof messageContent !== "string") {
      console.error("❌ Content is not a string:", typeof messageContent);
      Alert.alert(t('error'), "Invalid message content");
      return;
    }

    if (
      !messageContent.trim() &&
      (!messageAttachments || messageAttachments.length === 0)
    ) {
      return;
    }

    // ✨ Check E2EE ready
    if (!encryptionReady) {
      Alert.alert(
        t('message.encryption.notReady'),
        t('message.encryption.waitMessage'),
        [{ text: t('ok') }]
      );
      return;
    }

    try {
      console.log("📤 Sending text message with E2EE...");

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

      console.log("✅ Message sent successfully");
    } catch (error: any) {
      console.error("❌ Failed to send message:", error);
      Alert.alert(
        t('message.failed'),
        error.message || t('message.failed'),
        [{ text: t('ok') }]
      );
    }
  };

  // GIỮ NGUYÊN
  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await editMessage(messageId, newContent);
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('message.failed'));
    }
  };

  // GIỮ NGUYÊN
  const handleDeleteMessage = async (
    messageId: string,
    deleteType: "only_me" | "both"
  ) => {
    try {
      await deleteMessage(messageId, deleteType);
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('message.failed'));
    }
  };

  // GIỮ NGUYÊN
  const handleAddReaction = async (messageId: string, reaction: string) => {
    try {
      await addReaction(messageId, reaction);
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('message.failed'));
    }
  };

  // GIỮ NGUYÊN
  const handleRemoveReaction = async (messageId: string) => {
    try {
      await removeReaction(messageId);
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('message.failed'));
    }
  };

  // ✨ NEW: Retry decryption handler
  const handleRetryDecryption = async (messageId: string) => {
    try {
      console.log("🔄 Retrying decryption for message:", messageId);
      await retryDecryption(messageId);
      Alert.alert(t('success'), t('message.encryption.retrySuccess'));
    } catch (error: any) {
      console.error("❌ Retry decryption failed:", error);
      Alert.alert(
        t('message.encryption.retryTitle'),
        t('message.encryption.retryFailed'),
        [{ text: t('ok') }]
      );
    }
  };

  // GIỮ NGUYÊN
  const handleReply = (message: any) => {
    setReplyTo(message);
  };

  // GIỮ NGUYÊN
  const handleLoadMore = useCallback(async () => {
    if (
      !hasMore ||
      loading ||
      !canLoadMore ||
      Date.now() - lastLoadTimeRef.current < 1000
    ) {
      return;
    }

    if (isLoadingMoreRef.current) return;

    isLoadingMoreRef.current = true;

    const visibleMessages = messages.slice(0, 5);
    if (visibleMessages.length > 0) {
      firstVisibleItemBeforeLoad.current = visibleMessages[0]._id;
    }

    try {
      await loadMoreMessages();
    } catch (error) {
      console.error("Failed to load more messages:", error);
      isLoadingMoreRef.current = false;
    }
  }, [hasMore, loading, loadMoreMessages, canLoadMore, messages]);

  // GIỮ NGUYÊN
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

      if (
        scrollPosition < 100 &&
        hasMore &&
        !isLoadingMoreRef.current &&
        canLoadMore
      ) {
        handleLoadMore();
      }
    },
    [showScrollButton, hasMore, canLoadMore, handleLoadMore]
  );

  // GIỮ NGUYÊN
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

  // GIỮ NGUYÊN
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    // Handle viewable items if needed
  }, []);

  // GIỮ NGUYÊN
  const getConversationTitle = () => {
    if (!conversation) return t('loading');

    if (conversation.type === "group") {
      return conversation.name || t('message.members', { count: conversation?.participants?.length || 0 });
    }

    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return (
      otherParticipant?.full_name || otherParticipant?.username || t('message.unknownUser')
    );
  };

  // GIỮ NGUYÊN
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

  // GIỮ NGUYÊN
  const getOnlineStatus = () => {
    if (!conversation || conversation.type === "group") return null;

    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );

    if (otherParticipant?.is_online) {
      return t('message.online');
    }

    if (otherParticipant?.last_seen) {
      const lastSeen = new Date(otherParticipant.last_seen);
      const now = new Date();
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return t('message.justNow');
      if (diffMins < 60) return t('message.minutesAgo', { minutes: diffMins });
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return t('message.hoursAgo', { hours: diffHours });
      const diffDays = Math.floor(diffHours / 24);
      return t('message.daysAgo', { days: diffDays });
    }

    return null;
  };

  // GIỮ NGUYÊN
  const handleTypingStart = () => {
    sendTypingIndicator(true);
  };

  // GIỮ NGUYÊN
  const handleTypingStop = () => {
    sendTypingIndicator(false);
  };

  // ========================================
  // RENDER FUNCTIONS
  // ========================================

  // ✨ UPDATED: Pass thêm E2EE props
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isOwnMessage = item.sender?.clerkId === userId;
    const isHighlighted = item._id === highlightedMessageId;

    return (
      <MessageItem
        message={item}
        isOwnMessage={isOwnMessage}
        onReply={handleReply}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        isHighlighted={isHighlighted}
        onRetryDecryption={handleRetryDecryption} // ✨ NEW
        encryptionReady={encryptionReady} // ✨ NEW
      />
    );
  };

  // GIỮ NGUYÊN
  const renderLoadingHeader = () => {
    if (!hasMore || !loading) return null;

    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#F97316" />
      </View>
    );
  };

  // GIỮ NGUYÊN
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

  // ✨ UPDATED: Thêm E2EE badge
  const renderHeader = () => {
    const avatarUrl = getConversationAvatar();
    const isGroup = conversation?.type === "group";

    return (
      <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#F97316" : "#000"}
          />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center ml-3">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="w-10 h-10 rounded-full mr-3"
            />
          ) : (
            <View className={`w-10 h-10 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'} items-center justify-center mr-3`}>
              <Ionicons
                name={isGroup ? "people" : "person"}
                size={20}
                color={isDark ? "#fff" : "#666"}
              />
            </View>
          )}

          <View className="flex-1">
            {/* ✨ UPDATED: Thêm E2EE badge */}
            <View className="flex-row items-center">
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {getConversationTitle()}
              </Text>

              {/* ✨ NEW: E2EE Badge */}
              {encryptionReady && (
                <View className="ml-2 bg-green-500 rounded-full px-2 py-0.5">
                  <Text className="text-white text-xs font-bold">🔒</Text>
                </View>
              )}
            </View>

            {/* GIỮ NGUYÊN phần status */}
            {typingUsers.length > 0 ? (
              <Text className="text-sm text-orange-500 italic">{t('message.typing')}</Text>
            ) : isGroup ? (
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('message.members', { count: conversation?.participants?.length || 0 })}
              </Text>
            ) : getOnlineStatus() ? (
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {getOnlineStatus()}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Audio Call Button - GIỮ NGUYÊN */}
        <TouchableOpacity
          className="p-2"
          onPress={handleAudioCall}
          disabled={isInitiatingCall}
        >
          <Ionicons
            name="call"
            size={24}
            color={
              isInitiatingCall
                ? "#ccc"
                : isDark
                  ? "#fff"
                  : "#000"
            }
          />
        </TouchableOpacity>

        {/* Video Call Button - GIỮ NGUYÊN */}
        <TouchableOpacity
          className="p-2"
          onPress={handleVideoCall}
          disabled={isInitiatingCall}
        >
          <Ionicons
            name="videocam"
            size={24}
            color={
              isInitiatingCall
                ? "#ccc"
                : isDark
                  ? "#fff"
                  : "#000"
            }
          />
        </TouchableOpacity>

        {/* Info Button - GIỮ NGUYÊN */}
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

  // ✨ NEW: Warning banner khi E2EE chưa ready
  const renderEncryptionWarning = () => {
    if (encryptionReady) return null;

    return (
      <View className={`px-4 py-2 border-b ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}`}>
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text className={`ml-2 text-xs font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
            {t('message.encryption.initializing')}
          </Text>
        </View>
      </View>
    );
  };

  // ✨ UPDATED: Thêm E2EE message
  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      {/* ✨ UPDATED: Đổi icon thành lock */}
      <Text className="text-6xl mb-4">🔒</Text>
      <Text className={`text-center text-lg font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('message.empty.title')}
      </Text>
      <Text className={`text-center mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {t('message.empty.subtitle')}
      </Text>

      {/* ✨ NEW: E2EE status indicator */}
      {encryptionReady && (
        <View className={`mt-4 rounded-lg px-4 py-2 ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
          <Text className={`text-sm font-medium text-center ${isDark ? 'text-green-300' : 'text-green-700'}`}>
            {t('message.encryption.enabled')}
          </Text>
        </View>
      )}
    </View>
  );

  // GIỮ NGUYÊN
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
  // MAIN RENDER - GIỮ NGUYÊN CẤU TRÚC
  // ========================================

  if (error) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={isDark ? "#000000" : "#FFFFFF"}
        />
        {renderHeader()}
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className={`text-center mt-4 text-lg ${isDark ? 'text-red-400' : 'text-red-500'}`}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-orange-500 rounded-full px-6 py-3 mt-6"
          >
            <Text className="text-white font-semibold">{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      {renderHeader()}

      {/* ✨ NEW: Warning banner */}
      {renderEncryptionWarning()}

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
              keyExtractor={(item) => item._id}
              className="flex-1 px-4"
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              inverted={false}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={10}
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

        {/* ✨ UPDATED: Disable input nếu E2EE chưa ready */}
        <MessageInput
          conversationId={id} // ✅ NEW
          recipientId={recipientId} // ✅ NEW
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