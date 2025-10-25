// MessageScreen.tsx - COMPLETE WITH GROUP VIDEO/AUDIO CALL
import MessageInput from "@/components/page/message/MessageInput";
import MessageItem from "@/components/page/message/MessageItem";
import { TypingIndicator } from "@/components/page/message/TypingIndicator";
import { useConversations } from "@/hooks/message/useConversations";
import { useMessages } from "@/hooks/message/useMessages";
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
  } = useMessages(id || null);

  const { conversations } = useConversations();

  useEffect(() => {
    if (id && conversations.length > 0) {
      const currentConversation = conversations.find((conv) => conv._id === id);
      setConversation(currentConversation);
    }
  }, [id, conversations]);

  // Handle scroll to specific message
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
          console.error('❌ markConversationAsRead FAILED:', err);
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
        msg.sender?.clerkId !== userId
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach((msg) => {
        markAsRead(msg._id);
      });
    }
  }, [messages, markAsRead, userId]);

  // ========================================
  // CALL HANDLERS - Enhanced for Group Calls
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
            text: 'Call',
            onPress: async () => {
              try {
                const token = await getToken();
                const response = await axios.post(
                  `${API_URL}/api/calls/initiate`,
                  {
                    conversationId: id,
                    type: 'video',
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                const { call } = response.data;
                
                console.log('📞 Video call initiated:', call);
                
                // Navigate to video call screen
                router.push({
                  pathname: '/call/[id]' as any,
                  params: {
                    id: call.id,
                    channelName: call.channelName,
                    conversationId: id,
                    callType: 'video',
                  },
                });
              } catch (error: any) {
                console.error('❌ Error starting video call:', error);
                Alert.alert(
                  'Error', 
                  error.response?.data?.error || 'Failed to start video call'
                );
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error:', error);
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
            text: 'Call',
            onPress: async () => {
              try {
                const token = await getToken();
                const response = await axios.post(
                  `${API_URL}/api/calls/initiate`,
                  {
                    conversationId: id,
                    type: 'audio',
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                const { call } = response.data;
                
                console.log('📞 Audio call initiated:', call);
                
                // Navigate to call screen (audio mode)
                router.push({
                  pathname: '/call/[id]' as any,
                  params: {
                    id: call.id,
                    channelName: call.channelName,
                    conversationId: id,
                    callType: 'audio',
                  },
                });
              } catch (error: any) {
                console.error('❌ Error starting audio call:', error);
                Alert.alert(
                  'Error', 
                  error.response?.data?.error || 'Failed to start audio call'
                );
              } finally {
                setIsInitiatingCall(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error:', error);
      setIsInitiatingCall(false);
    }
  };

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  const getConversationTitle = () => {
    if (!conversation) return "Chat";
    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }
    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.full_name || "Unknown User";
  };

  const getConversationAvatar = () => {
    if (!conversation) return null;
    if (conversation.type === "group") {
      return conversation.avatar || null;
    }
    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.avatar || null;
  };

  const getOnlineStatus = () => {
    if (!conversation || conversation.type === "group") return null;
    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.is_online ? "Online" : "Offline";
  };

  const handleSendMessage = async (messageData: any) => {
    try {
      await sendMessage(messageData);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
        setIsNearBottom(true);
        setNewMessagesCount(0);
        setShowScrollButton(false);
      }, 50);
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      await editMessage(messageId, content);
    } catch (error) {
      Alert.alert("Error", "Failed to edit message");
    }
  };

  const handleDeleteMessage = async (
    messageId: string,
    type: "only_me" | "both"
  ) => {
    try {
      await deleteMessage(messageId, type);
    } catch (error) {
      Alert.alert("Error", "Failed to delete message");
    }
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    try {
      const message = messages.find((m) => m._id === messageId);
      const existingReaction = message?.reactions?.find(
        (r: any) => r.user?.clerkId === userId
      );

      if (existingReaction?.type === reaction) {
        await removeReaction(messageId);
      } else {
        await addReaction(messageId, reaction);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update reaction");
    }
  };

  const handleReply = (message: any) => {
    setReplyTo(message);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && !isLoadingMoreRef.current) {
      const firstItem = viewableItems[0];
      if (firstItem?.item?._id) {
        firstVisibleItemBeforeLoad.current = firstItem.item._id;
      }
    }
  }).current;

  const handleScrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setNewMessagesCount(0);
    setShowScrollButton(false);
    setIsNearBottom(true);
    Animated.timing(scrollButtonOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const distanceFromTop = contentOffset.y;
    const nearBottom = distanceFromBottom < 100;
    const timeSinceLastLoad = Date.now() - lastLoadTimeRef.current;
    const cooldownPeriod = 1000;
    
    if (
      distanceFromTop < 100 && 
      canLoadMore && 
      hasMore && 
      !loading && 
      !isLoadingMoreRef.current &&
      timeSinceLastLoad > cooldownPeriod
    ) {
      isLoadingMoreRef.current = true;
      scrollPositionBeforeLoad.current = contentOffset.y;
      loadMoreMessages();
    }
    
    if (nearBottom !== isNearBottom) {
      setIsNearBottom(nearBottom);
      
      if (nearBottom) {
        setNewMessagesCount(0);
        setShowScrollButton(false);
        Animated.timing(scrollButtonOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // ========================================
  // RENDER FUNCTIONS
  // ========================================

  const renderMessage = ({ item }: { item: any }) => (
    <View className={highlightedMessageId === item._id ? "bg-orange-100 dark:bg-orange-900/30 rounded-lg" : ""}>
      <MessageItem
        message={item}
        onReply={handleReply}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReaction={handleReaction}
      />
    </View>
  );

  const renderLoadingHeader = () => {
    if (!loading || !hasMore) return null;
    
    return (
      <View className="py-4 items-center justify-center">
        <ActivityIndicator size="small" color="#f97316" />
        <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Loading messages...
        </Text>
      </View>
    );
  };

  const handleTypingStart = useCallback(() => {
    if (isNearBottom) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [isNearBottom]);

  const renderTypingIndicator = () => {
    return (
      <TypingIndicator 
        typingUsers={typingUsers}
        onTypingStart={handleTypingStart}
      />
    );
  };

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
            <Text className="text-lg font-semibold text-gray-800 dark:text-white">
              {getConversationTitle()}
            </Text>
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

        {/* Audio Call Button */}
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

        {/* Video Call Button */}
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
        
        {/* Info Button */}
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

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Ionicons
        name="chatbubble-ellipses-outline"
        size={64}
        color={colorScheme === "dark" ? "#666" : "#ccc"}
      />
      <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
        No messages yet
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-center mt-2">
        Send the first message to start the conversation
      </Text>
    </View>
  );

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

        <MessageInput
          onSendMessage={handleSendMessage}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onTyping={sendTypingIndicator}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}