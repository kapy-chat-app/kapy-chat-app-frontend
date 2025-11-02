// hooks/useMessages.ts - FIXED VERSION với proper socket decryption
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEncryption } from "./useEncryption";
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

export type MessageStatus = 'sending' | 'sent' | 'failed' | 'encrypting' | 'decrypting';

export interface Message {
  _id: string;
  conversation: string;
  sender: MessageSender;
  content?: string;
  encrypted_content?: string;
  encryption_metadata?: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
  };
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
  decryption_error?: boolean;
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
  retryDecryption: (messageId: string) => Promise<void>;
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
  const { encryptMessage, decryptMessage, isInitialized: encryptionInitialized } = useEncryption();
  
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

  // ✨ Helper function to decrypt message content
  const decryptMessageContent = useCallback(
    async (message: Message): Promise<string> => {
      if (!message.encrypted_content) {
        return message.content || '';
      }

      if (!encryptionInitialized) {
        console.warn('⚠️ E2EE not initialized, cannot decrypt');
        return '[🔒 Encrypted]';
      }

      try {
        const decrypted = await decryptMessage(
          message.sender.clerkId,
          message.encrypted_content
        );
        return decrypted;
      } catch (error) {
        console.error('❌ Failed to decrypt message:', error);
        return '[🔒 Decryption failed]';
      }
    },
    [decryptMessage, encryptionInitialized]
  );

  // ✨ Retry decryption for a specific message
  const retryDecryption = useCallback(
    async (messageId: string) => {
      try {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, status: 'decrypting' as MessageStatus }
              : msg
          )
        );

        const message = messages.find((m) => m._id === messageId);
        if (!message || !message.encrypted_content) {
          throw new Error('Message not found or not encrypted');
        }

        const decrypted = await decryptMessageContent(message);

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  content: decrypted,
                  status: 'sent' as MessageStatus,
                  decryption_error: false,
                }
              : msg
          )
        );

        console.log('✅ Message decrypted successfully');
      } catch (error) {
        console.error('❌ Retry decryption failed:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, status: 'failed' as MessageStatus, decryption_error: true }
              : msg
          )
        );
      }
    },
    [messages, decryptMessageContent]
  );

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

  // ✨ Fetch and decrypt messages
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

      const encryptedMessages = result.data.messages || [];
      const pagination = result.data.pagination;

      console.log(`📦 Fetched ${encryptedMessages.length} messages from DB, starting decryption...`);

      // ✨ FIXED: Decrypt all messages sequentially với proper error handling
      const decryptedMessages = await Promise.all(
        encryptedMessages.map(async (msg: Message) => {
          // ✅ Chỉ decrypt nếu có encrypted_content
          if (msg.encrypted_content && encryptionInitialized) {
            try {
              console.log(`🔓 Decrypting message ${msg._id} from sender ${msg.sender.clerkId}`);
              
              // ✅ Decrypt với sender's clerkId
              const decrypted = await decryptMessage(
                msg.sender.clerkId, // ✅ IMPORTANT: Use sender's clerkId
                msg.encrypted_content
              );
              
              console.log(`✅ Message ${msg._id} decrypted successfully:`, decrypted.substring(0, 50));
              
              return {
                ...msg,
                content: decrypted,
                status: 'sent' as MessageStatus,
                decryption_error: false,
              };
            } catch (error) {
              console.error(`❌ Failed to decrypt message ${msg._id}:`, error);
              return {
                ...msg,
                content: '[🔒 Decryption failed - Tap to retry]',
                status: 'failed' as MessageStatus,
                decryption_error: true,
              };
            }
          }
          
          // ✅ Nếu không có encrypted_content, trả về nguyên bản
          console.log(`⚠️ Message ${msg._id} has no encrypted_content`);
          return {
            ...msg,
            content: msg.content || '[No content]',
          };
        })
      );

      console.log(`✅ Decryption complete: ${decryptedMessages.length} messages processed`);

      if (append) {
        setMessages((prev) => [...decryptedMessages, ...prev]);
      } else {
        setMessages(decryptedMessages);
      }

      setHasMore(pagination?.hasNext || false);
      
      console.log(`✅ Loaded and decrypted ${decryptedMessages.length} messages (page ${pageNum})`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch messages";
      setError(errorMessage);
      console.error("❌ Error fetching messages:", err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  },
  [conversationId, getToken, API_BASE_URL, MESSAGES_PER_PAGE, decryptMessage, encryptionInitialized]
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
      content = String(data.get('content') || '');
    } else {
      messageType = data.type;
      content = String(data.content || '');
    }

    return {
      _id: tempId,
      tempId,
      conversation: conversationId!,
      sender: {
        _id: user?.id || '',
        clerkId: user?.id || '',
        full_name: user?.fullName || 'You',
        username: user?.username || 'you',
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
      status: 'encrypting' as MessageStatus,
      localUri: localUris,
    };
  }, [conversationId, user]);

  // ✨ Send message with encryption
  const sendMessage = useCallback(
    async (data: CreateMessageData | FormData): Promise<Message> => {
      if (!conversationId) {
        throw new Error("No conversation selected");
      }

      if (!encryptionInitialized) {
        throw new Error("E2EE not initialized. Please initialize encryption first.");
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        // 2. Prepare data
        let messageContent = '';
        let messageType: Message['type'] = 'text';
        let attachmentIds: string[] = [];
        let replyToId: string | undefined;

        if (data instanceof FormData) {
          messageContent = (data.get('content') as string) || '';
          messageType = (data.get('type') as Message['type']) || 'text';
          replyToId = (data.get('replyTo') as string) || undefined;
        } else {
          messageContent = String(data.content || '').trim();
          messageType = data.type;
          attachmentIds = data.attachments || [];
          replyToId = data.replyTo;
        }

        console.log('📝 Message preparation:', {
          messageContent: messageContent.substring(0, 50),
          messageType,
          contentType: typeof messageContent,
          contentLength: messageContent.length
        });

        // Validate content type
        if (typeof messageContent !== 'string') {
          console.error('❌ Invalid content type:', typeof messageContent, messageContent);
          throw new Error('Message content must be a string');
        }

        // 1. Create optimistic message
        const optimisticMessage = createOptimisticMessage(
          data instanceof FormData ? data : {
            ...data,
            content: messageContent,
          }
        );
        setMessages((prev) => [...prev, optimisticMessage]);

        // ✨ 3. Encrypt message content (chỉ encrypt text messages)
        let encryptedContent = '';
        let encryptionMetadata = null;

        if (messageType === 'text' && messageContent) {
          try {
            const conversationResponse = await fetch(
              `${API_BASE_URL}/api/conversations/${conversationId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const convResult = await conversationResponse.json();
            const participants = convResult.data.participants || [];
            const recipientId = participants.find(
              (p: any) => p.clerkId !== user?.id
            )?.clerkId;

            if (!recipientId) {
              throw new Error('Recipient not found');
            }

            console.log('🔒 Encrypting message for:', recipientId);
            const encrypted = await encryptMessage(recipientId, String(messageContent));
            encryptedContent = encrypted.encryptedContent;
            encryptionMetadata = encrypted.encryptionMetadata;

            console.log('✅ Encryption complete:', {
              encryptedLength: encryptedContent.length,
              metadataType: encryptionMetadata?.type,
              hasEncryptedContent: !!encryptedContent,
              hasMetadata: !!encryptionMetadata
            });

            setMessages((prev) =>
              prev.map((msg) =>
                msg.tempId === optimisticMessage.tempId
                  ? { ...msg, status: 'sending' as MessageStatus }
                  : msg
              )
            );
          } catch (encryptError) {
            console.error('❌ Encryption failed:', encryptError);
            setMessages((prev) =>
              prev.filter((msg) => msg.tempId !== optimisticMessage.tempId)
            );
            throw new Error(`Encryption failed: ${encryptError}`);
          }
        }

        // ✨ 4. Build request body
        const requestBody: any = {
          conversationId,
          type: messageType,
        };

        // Add replyTo if present
        if (replyToId) {
          requestBody.replyTo = replyToId;
        }

        // ✅ For text messages: ONLY send encrypted content
        if (messageType === 'text') {
          if (!encryptedContent) {
            throw new Error('Failed to encrypt message - no encrypted content');
          }
          
          requestBody.encryptedContent = encryptedContent;
          requestBody.encryptionMetadata = encryptionMetadata;
          
          console.log('📦 Text message request body:', {
            conversationId: requestBody.conversationId,
            type: requestBody.type,
            hasEncryptedContent: !!requestBody.encryptedContent,
            hasEncryptionMetadata: !!requestBody.encryptionMetadata,
            encryptedContentLength: requestBody.encryptedContent?.length,
            metadataType: requestBody.encryptionMetadata?.type,
            replyTo: requestBody.replyTo,
            hasPlaintextContent: !!requestBody.content
          });
        } else {
          // For non-text messages (images, files, etc.)
          if (messageContent) {
            requestBody.content = messageContent;
          }
          
          console.log('📦 Non-text message request body:', {
            conversationId: requestBody.conversationId,
            type: requestBody.type,
            hasContent: !!requestBody.content,
            replyTo: requestBody.replyTo
          });
        }

        // Add attachments if present
        if (attachmentIds.length > 0) {
          requestBody.attachments = attachmentIds;
        }

        // ✨ 5. Send to server
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        console.log('📥 Response status:', response.status);

        const result = await response.json();

        console.log('📥 Server response:', {
          success: result.success,
          hasData: !!result.data,
          error: result.error
        });

        if (!result.success) {
          console.error('❌ Server error:', result.error);
          throw new Error(result.error || "Failed to send message");
        }

        const serverMessage = result.data;

        // ✅ FIX: Update optimistic message với decrypted content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === optimisticMessage.tempId
              ? {
                  ...serverMessage,
                  content: messageContent, // ✅ Keep plaintext locally
                  status: 'sent' as MessageStatus,
                }
              : msg
          )
        );

        console.log('✅ Message sent successfully with E2EE');
        return serverMessage;
      } catch (err) {
        console.error('❌ sendMessage failed:', err);
        
        // Remove optimistic message on error
        setMessages((prev) =>
          prev.filter((msg) => !msg.tempId || msg.tempId !== prev.find(m => m.tempId)?.tempId)
        );

        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        throw new Error(errorMessage);
      }
    },
    [conversationId, getToken, user, createOptimisticMessage, encryptMessage, encryptionInitialized, API_BASE_URL]
  );

  const editMessage = useCallback(
    async (id: string, content: string): Promise<Message> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: "edit", content }),
          }
        );

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
      if (!conversationId) return;
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}?type=${type}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to delete message");
        }

        if (type === "both") {
          setMessages((prev) => prev.filter((msg) => msg._id !== id));
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === id ? { ...msg, content: "This message was deleted" } : msg
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
    [conversationId, getToken, API_BASE_URL]
  );

  const addReaction = useCallback(
    async (id: string, reaction: string): Promise<void> => {
      if (!conversationId) return;
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: "reaction", reactionType: reaction }),
          }
        );

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
    [conversationId, getToken, API_BASE_URL]
  );

  const removeReaction = useCallback(
    async (id: string): Promise<void> => {
      if (!conversationId) return;
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}?type=remove_reaction`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

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
    },
    [conversationId, getToken, API_BASE_URL]
  );

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      if (!conversationId) return;
      try {
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: "read" }),
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.success && user?.id) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg._id === id && !msg.read_by.some((r) => r.user === user.id)) {
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
                          avatar: user.imageUrl,
                        },
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
        console.error("Error marking message as read:", err);
      }
    },
    [conversationId, getToken, user, API_BASE_URL]
  );

  const markConversationAsRead = useCallback(
    async (convId: string): Promise<void> => {
      try {
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${convId}/read`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.success && user?.id && convId === conversationId) {
            setMessages((prev) =>
              prev.map((msg) => {
                const isAlreadyRead = msg.read_by.some((r) => r.user === user.id);
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
                          full_name: user.fullName || 'Unknown',
                          username: user.username || 'unknown',
                          avatar: user.imageUrl,
                        },
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
        console.error("Error marking conversation as read:", err);
      }
    },
    [conversationId, getToken, user, API_BASE_URL]
  );

  const loadMoreMessages = useCallback(async () => {
    if (hasMore && !loadingRef.current) {
      const nextPage = page + 1;
      setPage(nextPage);
      await fetchMessages(nextPage, true);
    }
  }, [hasMore, page, fetchMessages]);

  const refreshMessages = useCallback(async () => {
    setPage(1);
    await fetchMessages(1, false);
  }, [fetchMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setSocketMessageCount(0);
  }, []);

  // ✅ Socket event handlers - FIXED VERSION
  useEffect(() => {
    if (!socket || !conversationId) return;

    console.log('🔌 Setting up socket listeners for conversation:', conversationId);

    // ✅ FIXED: Handle newMessage - decrypt cả message của mình và người khác
    const handleNewMessage = async (data: any) => {
      console.log('📩 NEW MESSAGE event received:', {
        messageId: data.message_id,
        senderId: data.sender_id,
        currentUserId: user?.id,
        hasEncryptedContent: !!data.encrypted_content,
        hasMessage: !!data.message
      });

      if (data.conversation_id !== conversationId) {
        console.log('⚠️ Different conversation, ignoring');
        return;
      }

      if (!data.message) {
        console.warn('⚠️ No message data in socket event');
        return;
      }

      let newMessage = data.message;

      // ✅ FIX: Xử lý cả message của mình (từ socket - có encrypted content)
      // và message của người khác (cũng có encrypted content)
      
      // Nếu là message của mình, update optimistic message đã có
      if (data.sender_id === user?.id) {
        console.log('👤 Own message from socket - updating optimistic message');
        
        setMessages((prev) => {
          // Tìm optimistic message (có tempId)
          const optimisticIndex = prev.findIndex(msg => msg.tempId && msg.status === 'sending');
          
          if (optimisticIndex !== -1) {
            // Update optimistic message với server message
            const updated = [...prev];
            updated[optimisticIndex] = {
              ...newMessage,
              content: prev[optimisticIndex].content, // Keep plaintext from optimistic
              status: 'sent' as MessageStatus,
            };
            console.log('✅ Updated optimistic message with server response');
            return updated;
          } else {
            // Nếu không tìm thấy optimistic message, có thể là reload
            console.log('⚠️ No optimistic message found - might be reload');
            return prev;
          }
        });
        
        return; // ✅ QUAN TRỌNG: Return để không thêm duplicate
      }

      // ✅ Message từ người khác - decrypt và add
      if (newMessage.encrypted_content && encryptionInitialized) {
        try {
          console.log('🔓 Decrypting received message from:', data.sender_id);
          const decrypted = await decryptMessage(
            data.sender_id,
            newMessage.encrypted_content
          );
          newMessage = {
            ...newMessage,
            content: decrypted,
            status: 'sent' as MessageStatus,
            decryption_error: false,
          };
          console.log('✅ Message decrypted:', decrypted.substring(0, 50));
        } catch (error) {
          console.error('❌ Failed to decrypt received message:', error);
          newMessage = {
            ...newMessage,
            content: '[🔒 Decryption failed]',
            status: 'failed' as MessageStatus,
            decryption_error: true,
          };
        }
      }

      // Add message từ người khác
      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === newMessage._id);
        if (!exists) {
          setSocketMessageCount(prevCount => prevCount + 1);
          console.log('✅ New message from another user added');
          return [...prev, newMessage];
        }
        console.log('⚠️ Message already exists, skipping');
        return prev;
      });
    };

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
  }, [socket, conversationId, on, off, user?.id, decryptMessage, encryptionInitialized]);

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
    retryDecryption,
  };
};