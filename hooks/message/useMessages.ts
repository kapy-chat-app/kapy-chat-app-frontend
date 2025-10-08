// hooks/useMessages.ts - FIXED with populated read_by
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "./useSocket";

export interface MessageSender {
  _id: string;
  clerkId: string;
  full_name: string;
  username: string;
  avatar?: string;
}

export interface MessageAttachment {
  _id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
}

export interface MessageReaction {
  user: MessageSender;
  type: string;
  created_at: Date;
}

// ✅ FIXED: Added userInfo field
export interface MessageReadBy {
  user: string;
  read_at: Date;
  userInfo?: {
    clerkId: string;
    full_name: string;
    username: string;
    avatar?: string;
  };
}

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  _id: string;
  conversation: string;
  sender: MessageSender;
  content?: string;
  type: "text" | "image" | "video" | "audio" | "file" | "voice_note" | "location";
  attachments: MessageAttachment[];
  reply_to?: Message;
  reactions: MessageReaction[];
  is_edited: boolean;
  edited_at?: Date;
  read_by: MessageReadBy[];
  created_at: Date;
  updated_at: Date;
  status?: MessageStatus;
  tempId?: string;
  localUri?: string[];
}

export interface CreateMessageData {
  content?: string;
  type: "text" | "image" | "video" | "audio" | "file" | "voice_note" | "location";
  attachments?: string[];
  replyTo?: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
}

interface MessageHookReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (data: CreateMessageData | FormData) => Promise<Message>;
  editMessage: (id: string, content: string) => Promise<Message>;
  deleteMessage: (id: string, type?: "only_me" | "both") => Promise<void>;
  addReaction: (id: string, reaction: string) => Promise<void>;
  removeReaction: (id: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMore: boolean;
  refreshMessages: () => Promise<void>;
  clearMessages: () => void;
  socketMessageCount: number;
  typingUsers: TypingUser[];
  sendTypingIndicator: (isTyping: boolean) => void;
}

export const useMessages = (conversationId: string | null): MessageHookReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [socketMessageCount, setSocketMessageCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  const { socket, emit, on, off } = useSocket();
  const { user } = useUser();
  const { getToken } = useAuth();
  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );

  const MESSAGES_PER_PAGE = 15;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (socket && conversationId) {
      const joinRoom = () => {
        if (socket.connected) {
          emit("joinConversation", conversationId);
          console.log(`📥 Joined conversation: ${conversationId}`);
        } else {
          console.warn('⚠️ Socket not connected yet, waiting...');
          const checkConnection = setInterval(() => {
            if (socket.connected) {
              emit("joinConversation", conversationId);
              console.log(`📥 Joined conversation (delayed): ${conversationId}`);
              clearInterval(checkConnection);
            }
          }, 100);
          
          setTimeout(() => clearInterval(checkConnection), 3000);
        }
      };

      joinRoom();

      return () => {
        if (socket.connected) {
          emit("leaveConversation", conversationId);
          console.log(`📤 Left conversation: ${conversationId}`);
        }
        
        setTypingUsers([]);
      };
    }
  }, [socket, conversationId, emit]);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!socket || !conversationId || !user) return;
    
    if (!socket.connected) {
      console.warn('⚠️ Cannot send typing: socket not connected');
      return;
    }
    
    emit('userTyping', {
      conversation_id: conversationId,
      user_id: user.id,
      user_name: user.fullName || user.username || 'User',
      is_typing: isTyping
    });
    
    console.log(`⌨️ Sent typing indicator: ${isTyping}`);
  }, [socket, conversationId, user, emit]);

  const fetchMessages = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!conversationId || loadingRef.current) return;

      try {
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        const token = await getToken();

        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=${pageNum}&limit=${MESSAGES_PER_PAGE}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch messages");
        }

        const newMessages = result.data.messages || [];
        const pagination = result.data.pagination;

        if (append) {
          setMessages((prev) => [...newMessages, ...prev]);
        } else {
          setMessages(newMessages);
        }

        setHasMore(pagination?.hasNext || false);
        
        console.log(`✅ Loaded ${newMessages.length} messages (page ${pageNum})`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch messages";
        setError(errorMessage);
        console.error("Error fetching messages:", err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [conversationId, getToken, API_BASE_URL, MESSAGES_PER_PAGE]
  );

  const createOptimisticMessage = useCallback((
    data: CreateMessageData | FormData,
    localUris?: string[]
  ): Message => {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    let messageType: Message['type'] = 'text';
    let content = '';
    let attachmentPreviews: MessageAttachment[] = [];
    
    if (data instanceof FormData) {
      messageType = (data.get('type') as Message['type']) || 'text';
      content = (data.get('content') as string) || '';
      
      const files = data.getAll('files') as any[];
      attachmentPreviews = files.map((file, index) => ({
        _id: `temp_att_${Date.now()}_${index}`,
        file_name: file.name || `file-${index}`,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size || 0,
        url: file.uri || '',
      }));
    } else {
      messageType = data.type;
      content = data.content || '';
    }

    return {
      _id: tempId,
      tempId,
      conversation: conversationId!,
      sender: {
        _id: user?.id || '',
        clerkId: user?.id || '',
        full_name: user?.fullName || 'You',
        username: user?.username || '',
        avatar: user?.imageUrl,
      },
      content,
      type: messageType,
      attachments: attachmentPreviews,
      reactions: [],
      is_edited: false,
      read_by: [],
      created_at: new Date(),
      updated_at: new Date(),
      status: 'sending',
      localUri: localUris,
    } as Message;
  }, [conversationId, user]);

  const sendMessage = useCallback(
    async (data: FormData | CreateMessageData): Promise<Message> => {
      if (!conversationId) {
        throw new Error("No conversation selected");
      }

      let localUris: string[] = [];
      if (data instanceof FormData) {
        const files = data.getAll('files') as any[];
        localUris = files.map(f => f.uri).filter(Boolean);
      }

      const optimisticMessage = createOptimisticMessage(data, localUris);
      setMessages(prev => [...prev, optimisticMessage]);

      try {
        setError(null);
        const token = await getToken();

        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
        };

        if (!(data instanceof FormData)) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers,
            body: data instanceof FormData ? data : JSON.stringify(data),
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        setMessages(prev => 
          prev.map(msg => 
            msg.tempId === optimisticMessage.tempId 
              ? { 
                  ...result.data, 
                  status: 'sent' as MessageStatus,
                  tempId: optimisticMessage.tempId
                }
              : msg
          )
        );

        return result.data;

      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        console.error("❌ Send message error:", errorMessage);

        setMessages(prev => 
          prev.map(msg => 
            msg.tempId === optimisticMessage.tempId 
              ? { ...msg, status: 'failed' as MessageStatus }
              : msg
          )
        );

        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [conversationId, getToken, API_BASE_URL, createOptimisticMessage]
  );

  const editMessage = useCallback(
    async (id: string, content: string): Promise<Message> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ action: "edit", content }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to edit message");
        }

        const updatedMessage = result.data;

        setMessages((prev) =>
          prev.map((msg) => (msg._id === id ? updatedMessage : msg))
        );

        return updatedMessage;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to edit message";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [getToken, API_BASE_URL, conversationId]
  );

  const deleteMessage = useCallback(
    async (id: string, type: "only_me" | "both" = "only_me"): Promise<void> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}?type=${type}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to delete message");
        }

        if (type === "both") {
          setMessages((prev) => prev.filter((msg) => msg._id !== id));
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === id
                ? { ...msg, content: "This message was deleted" }
                : msg
            )
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete message";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [getToken, API_BASE_URL, conversationId]
  );

  const addReaction = useCallback(
    async (id: string, reaction: string): Promise<void> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ action: "reaction", reactionType: reaction }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to add reaction");
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id ? { ...msg, reactions: result.data.reactions } : msg
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to add reaction";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [getToken, API_BASE_URL, conversationId]
  );

  const removeReaction = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}?type=remove_reaction`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to remove reaction");
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === id ? { ...msg, reactions: result.data.reactions } : msg
        )
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove reaction";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getToken, API_BASE_URL, conversationId]);

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ action: "read" }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success && user?.id) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (
                  msg._id === id &&
                  !msg.read_by.some((r) => r.user === user.id)
                ) {
                  console.log(`✅ Locally marking message ${id} as read`);
                  return {
                    ...msg,
                    read_by: [
                      ...msg.read_by,
                      { 
                        user: user.id, 
                        read_at: new Date(),
                        userInfo: {
                          clerkId: user.id,
                          full_name: user.fullName || 'You',
                          username: user.username || '',
                          avatar: user.imageUrl
                        }
                      },
                    ],
                  };
                }
                return msg;
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to mark message as read:", err);
      }
    },
    [user?.id, user?.fullName, user?.username, user?.imageUrl, getToken, API_BASE_URL, conversationId]
  );

  const markConversationAsRead = useCallback(
    async (conversationId: string): Promise<void> => {
      try {
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/read`,
          {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.success && user?.id) {
            console.log(`✅ Conversation ${conversationId} marked as read`);
            setMessages((prev) =>
              prev.map((msg) => {
                const isAlreadyRead = msg.read_by.some(
                  (r) => r.user === user.id
                );
                if (!isAlreadyRead && msg.sender.clerkId !== user.id) {
                  return {
                    ...msg,
                    read_by: [
                      ...msg.read_by,
                      { 
                        user: user.id, 
                        read_at: new Date(),
                        userInfo: {
                          clerkId: user.id,
                          full_name: user.fullName || 'You',
                          username: user.username || '',
                          avatar: user.imageUrl
                        }
                      },
                    ],
                  };
                }
                return msg;
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to mark conversation as read:", err);
      }
    },
    [user?.id, user?.fullName, user?.username, user?.imageUrl, getToken, API_BASE_URL]
  );

  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (!hasMore || loading || loadingRef.current) return;

    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMessages(nextPage, true);
  }, [hasMore, loading, page, fetchMessages]);

  const refreshMessages = useCallback(async (): Promise<void> => {
    setPage(1);
    setHasMore(true);
    await fetchMessages(1, false);
  }, [fetchMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setSocketMessageCount(0);
    setTypingUsers([]);
  }, []);

  // ✅ SOCKET EVENT HANDLERS - COMPLETE WITH POPULATED READ_BY
  useEffect(() => {
    if (!socket || !conversationId) return;

    console.log('🔌 Setting up message socket listeners for conversation:', conversationId);

    // 1. NEW MESSAGE
    const handleNewMessage = (data: any) => {
      if (data.conversation_id === conversationId) {
        if (data.sender_id === user?.id) {
          console.log('Skipping own message from socket');
          return;
        }

        const messageFromSocket = data.message;
        
        const newMessage: Message = {
          _id: messageFromSocket._id || data.message_id || `temp_${Date.now()}`,
          conversation: data.conversation_id,
          sender: {
            _id: data.sender_id,
            clerkId: data.sender_id,
            full_name: data.sender_name || "Unknown",
            username: data.sender_username || "unknown",
            avatar: data.sender_avatar,
          } as MessageSender,
          content: data.message_content,
          type: data.message_type || "text",
          attachments: messageFromSocket?.attachments || [],
          reply_to: messageFromSocket?.reply_to,
          reactions: messageFromSocket?.reactions || [],
          is_edited: false,
          read_by: messageFromSocket?.read_by || [],
          created_at: new Date(messageFromSocket?.created_at || Date.now()),
          updated_at: new Date(messageFromSocket?.updated_at || Date.now()),
          status: 'sent',
        };

        setMessages((prev) => {
          const exists = prev.some((msg) => msg._id === newMessage._id);
          if (!exists) {
            setSocketMessageCount(prevCount => prevCount + 1);
            console.log('✅ New message from socket added');
            return [...prev, newMessage];
          }
          return prev;
        });
      }
    };

    // 2. UPDATE MESSAGE
    const handleUpdateMessage = (data: any) => {
      console.log('📝 Message updated:', data.message_id);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? {
                ...msg,
                content: data.new_content,
                is_edited: true,
                edited_at: new Date(data.edited_at),
              }
            : msg
        )
      );
    };

    // 3. DELETE MESSAGE
    const handleDeleteMessage = (data: any) => {
      console.log('🗑️ Message deleted:', data.message_id, 'type:', data.delete_type);
      if (data.delete_type === "both") {
        setMessages((prev) =>
          prev.filter((msg) => msg._id !== data.message_id)
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id
              ? { ...msg, content: "This message was deleted" }
              : msg
          )
        );
      }
    };

    // 4. NEW REACTION
    const handleNewReaction = (data: any) => {
      console.log('👍 Reaction added:', data.reaction, 'to message:', data.message_id);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    };

    // 5. DELETE REACTION
    const handleDeleteReaction = (data: any) => {
      console.log('❌ Reaction removed from message:', data.message_id);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    };

    // ✅ 6. MESSAGE READ - FIXED WITH USER INFO
    const handleMessageRead = (data: any) => {
      console.log('📖 MESSAGE READ event received:', {
        messageId: data.message_id,
        conversationId: data.conversation_id,
        userId: data.user_id,
        userInfo: data.user_info,
        currentConversation: conversationId
      });
      
      if (data.conversation_id !== conversationId) {
        console.log('⚠️ Different conversation, ignoring');
        return;
      }
      
      if (data.user_id === user?.id) {
        console.log('👤 Own read event, already updated locally');
        return;
      }
      
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id === data.message_id) {
            const isAlreadyRead = msg.read_by.some(r => r.user === data.user_id);
            
            if (!isAlreadyRead) {
              console.log(`✅ Adding ${data.user_id} to read_by for message ${data.message_id}`);
              return {
                ...msg,
                read_by: [
                  ...msg.read_by,
                  {
                    user: data.user_id,
                    read_at: new Date(data.read_at),
                    userInfo: data.user_info || {
                      clerkId: data.user_id,
                      full_name: 'Unknown',
                      username: 'unknown'
                    }
                  },
                ],
              };
            }
          }
          return msg;
        })
      );
    };

    // ✅ 7. CONVERSATION MARKED AS READ - FIXED WITH USER INFO
    const handleConversationMarkedAsRead = (data: any) => {
      console.log('📖 CONVERSATION MARKED AS READ event received:', {
        conversationId: data.conversation_id,
        readBy: data.read_by,
        userInfo: data.user_info,
        messagesUpdated: data.messages_updated,
        currentConversation: conversationId
      });
      
      if (data.conversation_id !== conversationId) {
        console.log('⚠️ Different conversation, ignoring');
        return;
      }
      
      if (data.read_by === user?.id) {
        console.log('👤 Own read event, already updated locally');
        return;
      }
      
      setMessages((prev) =>
        prev.map((msg) => {
          const isAlreadyRead = msg.read_by.some((r) => r.user === data.read_by);
          
          if (!isAlreadyRead && msg.sender.clerkId !== data.read_by) {
            console.log(`✅ Adding ${data.read_by} to read_by for message ${msg._id}`);
            return {
              ...msg,
              read_by: [
                ...msg.read_by,
                {
                  user: data.read_by,
                  read_at: new Date(data.read_at),
                  userInfo: data.user_info || {
                    clerkId: data.read_by,
                    full_name: 'Unknown',
                    username: 'unknown'
                  }
                },
              ],
            };
          }
          return msg;
        })
      );
    };

    // 8. USER TYPING
    const handleUserTyping = (data: any) => {
      console.log('⌨️ RECEIVED userTyping event:', JSON.stringify(data));
      
      if (data.conversation_id !== conversationId) {
        console.log('❌ Wrong conversation:', data.conversation_id, 'expected:', conversationId);
        return;
      }
      if (data.user_id === user?.id) {
        console.log('❌ Own typing - skipping');
        return;
      }

      console.log('✅ PROCESSING TYPING:', data.user_name, 'is_typing:', data.is_typing);

      if (data.is_typing) {
        setTypingUsers(prev => {
          const exists = prev.some(u => u.userId === data.user_id);
          if (exists) {
            return prev;
          }
          console.log('Adding user to typing list:', data.user_name);
          return [...prev, { userId: data.user_id, userName: data.user_name }];
        });

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          console.log('Auto-removing typing user after timeout');
          setTypingUsers(prev => prev.filter(u => u.userId !== data.user_id));
        }, 3000);
      } else {
        console.log('Removing user from typing list:', data.user_name);
        setTypingUsers(prev => prev.filter(u => u.userId !== data.user_id));
      }
    };

    on("newMessage", handleNewMessage);
    on("updateMessage", handleUpdateMessage);
    on("deleteMessage", handleDeleteMessage);
    on("newReaction", handleNewReaction);
    on("deleteReaction", handleDeleteReaction);
    on("messageRead", handleMessageRead);
    on("conversationMarkedAsRead", handleConversationMarkedAsRead);
    on("userTyping", handleUserTyping);

    return () => {
      off("newMessage", handleNewMessage);
      off("updateMessage", handleUpdateMessage);
      off("deleteMessage", handleDeleteMessage);
      off("newReaction", handleNewReaction);
      off("deleteReaction", handleDeleteReaction);
      off("messageRead", handleMessageRead);
      off("conversationMarkedAsRead", handleConversationMarkedAsRead);
      off("userTyping", handleUserTyping);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, conversationId, on, off, user?.id]);

  useEffect(() => {
    if (conversationId) {
      clearMessages();
      fetchMessages(1, false);
    }
  }, [conversationId]);

  return {
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
    refreshMessages,
    clearMessages,
    socketMessageCount,
    typingUsers,
    sendTypingIndicator,
  };
};