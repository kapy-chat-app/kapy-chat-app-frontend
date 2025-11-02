// MessageScreen.tsx - UPDATED WITH E2EE (GIỮ NGUYÊN TẤT CẢ CODE CŨ)
import MessageInput from "@/components/page/message/MessageInput";
import MessageItem from "@/components/page/message/MessageItem";
import { TypingIndicator } from "@/components/page/message/TypingIndicator";
import { useConversations } from "@/hooks/message/useConversations";
import { useMessages } from "@/hooks/message/useMessages";
import { useEncryption } from "@/hooks/message/useEncryption"; // ✨ NEW: E2EE Hook
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
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
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function MessageScreen() {
  const router = useRouter();
  const { id, scrollToMessageId } = useLocalSearchParams<{ id: string; scrollToMessageId?: string }>();
  const { userId, getToken } = useAuth();
  const colorScheme = useColorScheme();
  const flatListRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
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
  
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 10,
    minimumViewTime: 100,
  }).current;

  // ✨ NEW: E2EE Hook - Không ảnh hưởng code cũ
  const { 
    isInitialized: encryptionReady, 
    loading: encryptionLoading 
  } = useEncryption();

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
      console.warn('⚠️ E2EE not initialized yet');
    } else if (encryptionReady) {
      console.log('✅ E2EE ready for conversation:', id);
    }
  }, [encryptionReady, encryptionLoading, id]);

  // Handle scroll to specific message - GIỮ NGUYÊN
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0 && hasScrolledToBottom) {
      const messageIndex = messages.findIndex((m) => m._id === scrollToMessageId);
      
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
    } else if (messages.length > 0 && !hasScrolledToBottom && scrollToMessageId) {
      setHasScrolledToBottom(true);
      lastMessageCountRef.current = messages.length;
      socketMessageCountRef.current = socketMessageCount;
      setTimeout(() => setCanLoadMore(true), 500);
    }
  }, [messages.length, hasScrolledToBottom, socketMessageCount, scrollToMessageId]);

  // Handle new messages - GIỮ NGUYÊN
  useEffect(() => {
    if (socketMessageCount > socketMessageCountRef.current && hasScrolledToBottom) {
      const newSocketMessages = socketMessageCount - socketMessageCountRef.current;
      
      if (isLoadingMoreRef.current) {
        isLoadingMoreRef.current = false;
        lastLoadTimeRef.current = Date.now();
        
        if (firstVisibleItemBeforeLoad.current && messages.length > lastMessageCountRef.current) {
          setTimeout(() => {
            const index = messages.findIndex(m => m._id === firstVisibleItemBeforeLoad.current);
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
        setNewMessagesCount(prev => prev + newSocketMessages);
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
          console.error('❌ markConversationAsRead FAILED:', err);
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
      
      const isGroup = conversation?.type === 'group';
      const displayName = isGroup 
        ? (conversation?.name || 'Group')
        : getConversationTitle();
      
      Alert.alert(
        `Start Video Call`,
        isGroup 
          ? `Do you want to start a video call in ${displayName}?`
          : `Do you want to start a video call with ${displayName}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsInitiatingCall(false),
          },
          {
            text: 'Start',
            onPress: async () => {
              try {
                const token = await getToken();
                
                const response = await axios.post(
                  `${API_URL}/api/call/video/start`,
                  {
                    conversationId: id,
                    type: isGroup ? 'group' : 'private',
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
                console.error('Failed to start video call:', error);
                Alert.alert('Error', 'Failed to start video call');
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      setIsInitiatingCall(false);
    }
  };

  const handleAudioCall = async () => {
    if (!id || isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);
      
      const isGroup = conversation?.type === 'group';
      const displayName = isGroup 
        ? (conversation?.name || 'Group')
        : getConversationTitle();
      
      Alert.alert(
        `Start Audio Call`,
        isGroup 
          ? `Do you want to start an audio call in ${displayName}?`
          : `Do you want to start an audio call with ${displayName}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsInitiatingCall(false),
          },
          {
            text: 'Start',
            onPress: async () => {
              try {
                const token = await getToken();
                
                const response = await axios.post(
                  `${API_URL}/api/call/audio/start`,
                  {
                    conversationId: id,
                    type: isGroup ? 'group' : 'private',
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
                console.error('Failed to start audio call:', error);
                Alert.alert('Error', 'Failed to start audio call');
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      setIsInitiatingCall(false);
    }
  };

  // ========================================
  // MESSAGE HANDLERS
  // ========================================

  // ✨ UPDATED: Send message với E2EE check
  const handleSendMessage = async (
  contentOrData: string | { content: string; type: string; replyTo?: string },
  attachments?: string[],
  replyToId?: string
) => {
  // ✅ Handle both formats
  let messageContent: string;
  let messageAttachments: string[] | undefined;
  let messageReplyTo: string | undefined;

  if (typeof contentOrData === 'string') {
    // Called with (string, attachments, replyToId)
    messageContent = contentOrData;
    messageAttachments = attachments;
    messageReplyTo = replyToId;
  } else {
    // Called with object
    messageContent = contentOrData.content;
    messageAttachments = undefined;
    messageReplyTo = contentOrData.replyTo;
  }

  // ✅ Validate
  console.log('📤 handleSendMessage called:', {
    contentType: typeof messageContent,
    content: messageContent,
    contentLength: messageContent?.length,
    attachments: messageAttachments,
    replyToId: messageReplyTo
  });

  if (typeof messageContent !== 'string') {
    console.error('❌ Content is not a string:', typeof messageContent);
    Alert.alert('Error', 'Invalid message content');
    return;
  }

  if (!messageContent.trim() && (!messageAttachments || messageAttachments.length === 0)) {
    return;
  }

  // ✨ Check E2EE ready
  if (!encryptionReady) {
    Alert.alert(
      'Encryption Not Ready',
      'Please wait for encryption to initialize before sending messages.',
      [{ text: 'OK' }]
    );
    return;
  }

  try {
    console.log('📤 Sending message with E2EE...');
    
    await sendMessage({
      content: messageContent.trim(),
      type: 'text',
      attachments: messageAttachments,
      replyTo: messageReplyTo,
    });

    setReplyTo(null);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    console.log('✅ Message sent successfully');
  } catch (error: any) {
    console.error('❌ Failed to send message:', error);
    Alert.alert(
      'Send Failed',
      error.message || 'Failed to send message. Please try again.',
      [{ text: 'OK' }]
    );
  }
};

  // GIỮ NGUYÊN
  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await editMessage(messageId, newContent);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to edit message');
    }
  };

  // GIỮ NGUYÊN
  const handleDeleteMessage = async (messageId: string, deleteType: 'only_me' | 'both') => {
    try {
      await deleteMessage(messageId, deleteType);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete message');
    }
  };

  // GIỮ NGUYÊN
  const handleAddReaction = async (messageId: string, reaction: string) => {
    try {
      await addReaction(messageId, reaction);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add reaction');
    }
  };

  // GIỮ NGUYÊN
  const handleRemoveReaction = async (messageId: string) => {
    try {
      await removeReaction(messageId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove reaction');
    }
  };

  // ✨ NEW: Retry decryption handler
  const handleRetryDecryption = async (messageId: string) => {
    try {
      console.log('🔄 Retrying decryption for message:', messageId);
      await retryDecryption(messageId);
      Alert.alert('Success', 'Message decrypted successfully!');
    } catch (error: any) {
      console.error('❌ Retry decryption failed:', error);
      Alert.alert(
        'Decryption Failed',
        'Still unable to decrypt this message. The sender may need to send it again.',
        [{ text: 'OK' }]
      );
    }
  };

  // GIỮ NGUYÊN
  const handleReply = (message: any) => {
    setReplyTo(message);
  };

  // GIỮ NGUYÊN
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading || !canLoadMore || Date.now() - lastLoadTimeRef.current < 1000) {
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
      console.error('Failed to load more messages:', error);
      isLoadingMoreRef.current = false;
    }
  }, [hasMore, loading, loadMoreMessages, canLoadMore, messages]);

  // GIỮ NGUYÊN
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
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

    if (scrollPosition < 100 && hasMore && !isLoadingMoreRef.current && canLoadMore) {
      handleLoadMore();
    }
  }, [showScrollButton, hasMore, canLoadMore, handleLoadMore]);

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
    if (!conversation) return "Loading...";
    
    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }
    
    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.full_name || otherParticipant?.username || "Unknown";
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
        currentUserId={userId || ''}
        onTypingStart={handleTypingStart}
      />
    );
  };

  // ✨ UPDATED: Thêm E2EE badge
  const renderHeader = () => {
    const avatarUrl = getConversationAvatar();
    const isGroup = conversation?.type === 'group';

    return (
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={colorScheme === "dark" ? "#F97316" : "#000"}
          />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center ml-3">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="w-10 h-10 rounded-full mr-3"
            />
          ) : (
            <View className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center mr-3">
              <Ionicons
                name={isGroup ? "people" : "person"}
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#666"}
              />
            </View>
          )}

          <View className="flex-1">
            {/* ✨ UPDATED: Thêm E2EE badge */}
            <View className="flex-row items-center">
              <Text className="text-lg font-semibold text-gray-800 dark:text-white">
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
              <Text className="text-sm text-orange-500 italic">
                typing...
              </Text>
            ) : isGroup ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {conversation?.participants?.length || 0} members
              </Text>
            ) : getOnlineStatus() ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400">
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
            color={isInitiatingCall ? "#ccc" : (colorScheme === "dark" ? "#fff" : "#000")}
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
            color={isInitiatingCall ? "#ccc" : (colorScheme === "dark" ? "#fff" : "#000")}
          />
        </TouchableOpacity>
        
        {/* Info Button - GIỮ NGUYÊN */}
        <TouchableOpacity 
          className="p-2" 
          onPress={() => router.push({
            pathname: "/message/info/[id]" as any,
            params: {
              id: id,
              type: conversation?.type || "private",
              name: getConversationTitle(),
              avatar: getConversationAvatar() || "",
              participantCount: conversation?.participants?.length || 2,
            }
          })}
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // ✨ NEW: Warning banner khi E2EE chưa ready
  const renderEncryptionWarning = () => {
    if (encryptionReady) return null;

    return (
      <View className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 border-b border-yellow-200 dark:border-yellow-800">
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text className="ml-2 text-yellow-700 dark:text-yellow-300 text-xs font-medium">
            🔐 Initializing encryption...
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
      <Text className="text-gray-500 dark:text-gray-400 text-center text-lg font-semibold">
        No messages yet
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-center mt-2">
        Send your first encrypted message to start the conversation
      </Text>
      
      {/* ✨ NEW: E2EE status indicator */}
      {encryptionReady && (
        <View className="mt-4 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2">
          <Text className="text-green-700 dark:text-green-300 text-sm font-medium text-center">
            ✅ End-to-end encryption enabled
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
          position: 'absolute',
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
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <StatusBar
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={colorScheme === "dark" ? "#000000" : "#FFFFFF"}
        />
        {renderHeader()}
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-red-500 text-center mt-4 text-lg">{error}</Text>
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
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colorScheme === "dark" ? "#000000" : "#FFFFFF"}
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
                const wait = new Promise(resolve => setTimeout(resolve, 100));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({ 
                    index: info.index, 
                    animated: false,
                    viewPosition: 0.5
                  });
                });
              }}
            />
            {renderScrollToBottomButton()}
          </>
        )}

        {/* ✨ UPDATED: Disable input nếu E2EE chưa ready */}
        <MessageInput
          onSendMessage={handleSendMessage}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onTyping={sendTypingIndicator}
          disabled={!encryptionReady} // ✨ NEW: Disable khi chưa ready
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}