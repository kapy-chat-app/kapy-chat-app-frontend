// hooks/message/useMessages.ts (UPDATE interfaces at top of file)
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEncryption } from "./useEncryption";
import { useFileDecryption } from "./useFileDecryption";
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
  is_encrypted?: boolean;
  encryption_metadata?: {
    iv: string;
    authTag: string;
    original_size: number;
    encrypted_size: number;
  };
  decryptedUri?: string;
}

// ✨ UPDATE: MessageReaction - Thêm dislike
export interface MessageReaction {
  user: MessageSender;
  type: "heart" | "like" | "sad" | "angry" | "laugh" | "wow" | "dislike"; // ✨ NEW: dislike
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

// ✨ NEW: Rich Media DTO
export interface RichMediaDTO {
  provider: "giphy" | "tenor" | "custom" | string;
  provider_id: string;
  url: string;
  media_url: string;
  preview_url?: string;
  width: number;
  height: number;
  size?: number;
  title?: string;
  rating?: string;
  tags?: string[];
  source_url?: string;
  extra_data?: Record<string, any>;
}

// ✨ UPDATE: Message - Thêm gif, sticker, rich_media
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
  type: "text" | "image" | "video" | "audio" | "file" | "voice_note" | "location" | "gif" | "sticker"; // ✨ NEW: gif, sticker
  attachments: MessageAttachment[];
  reply_to?: Message;
  reactions: MessageReaction[];
  is_edited: boolean;
  edited_at?: Date;
  read_by: MessageReadBy[];
  rich_media?: RichMediaDTO; // ✨ NEW
  created_at: Date;
  updated_at: Date;
  status?: MessageStatus;
  tempId?: string;
  localUri?: string[];
  decryption_error?: boolean;
}

// ✨ UPDATE: CreateMessageData - Thêm richMedia
export interface CreateMessageData {
  content?: string;
  type: "text" | "image" | "video" | "audio" | "file" | "voice_note" | "location" | "gif" | "sticker"; // ✨ NEW
  attachments?: string[];
  replyTo?: string;
  encryptedFiles?: any[];
  localUris?: string[];
  richMedia?: RichMediaDTO; // ✨ NEW
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
  toggleReaction: (id: string, reaction: string) => Promise<void>; // ✨ NEW
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
  const { getDecryptedUri } = useFileDecryption();
  
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

  // Helper function to decrypt file attachments
  const decryptAttachments = useCallback(
    async (attachments: MessageAttachment[], senderClerkId: string): Promise<MessageAttachment[]> => {
      if (!attachments || attachments.length === 0) {
        return [];
      }

      console.log(`🔓 Decrypting ${attachments.length} attachments from sender:`, senderClerkId);

      return await Promise.all(
        attachments.map(async (att) => {
          if (!att.is_encrypted || !att.encryption_metadata) {
            console.log(`⏭️ File ${att.file_name} is not encrypted`);
            return att;
          }

          try {
            console.log(`🔓 Decrypting file: ${att.file_name}`);
            
            const decryptedUri = await getDecryptedUri(
              att._id,
              att.encryption_metadata.iv,
              att.encryption_metadata.authTag,
              senderClerkId,
              att._id
            );

            console.log(`✅ File ${att.file_name} decrypted successfully`);

            return {
              ...att,
              decryptedUri,
            };
          } catch (error) {
            console.error(`❌ Failed to decrypt file ${att.file_name}:`, error);
            
            if (error instanceof Error && error.message.includes('not initialized')) {
              console.warn('⚠️ E2EE not initialized, skipping file decryption');
              return att;
            }
            
            return {
              ...att,
              decryption_error: true,
            };
          }
        })
      );
    },
    [getDecryptedUri]
  );

  // Helper function to decrypt message content
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

  // Retry decryption for a specific message
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
        if (!message) {
          throw new Error('Message not found');
        }

        let decryptedContent = message.content;
        if (message.encrypted_content) {
          decryptedContent = await decryptMessageContent(message);
        }

        const decryptedAttachments = await decryptAttachments(
          message.attachments,
          message.sender.clerkId
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  content: decryptedContent,
                  attachments: decryptedAttachments,
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
    [messages, decryptMessageContent, decryptAttachments]
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

  // Fetch and decrypt messages
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

      console.log(`📦 Fetched ${encryptedMessages.length} messages`);
      console.log('🔐 Encryption initialized:', encryptionInitialized);

      const decryptedMessages = await Promise.all(
        encryptedMessages.map(async (msg: Message) => {
          try {
            // ✅ FIX: Check encrypted_content TRƯỚC
            let decryptedContent = msg.content; // Có thể undefined

            if (msg.encrypted_content) {
              if (encryptionInitialized) {
                console.log(`🔓 Decrypting message ${msg._id}`);
                console.log(`🔓 From sender: ${msg.sender.clerkId}`);
                console.log(`🔓 Encrypted preview: ${msg.encrypted_content.substring(0, 50)}...`);
                
                try {
                  decryptedContent = await decryptMessage(
                    msg.sender.clerkId,
                    msg.encrypted_content
                  );
                  console.log(`✅ Decrypted: ${decryptedContent.substring(0, 50)}...`);
                } catch (decryptError) {
                  console.error(`❌ Decrypt error for message ${msg._id}:`, decryptError);
                  throw decryptError; // Re-throw để vào catch bên ngoài
                }
              } else {
                // ✅ Encryption chưa ready → hiển thị placeholder
                console.warn(`⚠️ Encryption not ready, cannot decrypt message ${msg._id}`);
                decryptedContent = '[🔒 Encrypted - Initializing...]';
              }
            } else if (!msg.content) {
              // ❌ Không có cả encrypted_content và content
              console.error(`❌ Message ${msg._id} has no content or encrypted_content!`);
              decryptedContent = '[❌ No content]';
            }

            // ✅ Decrypt attachments nếu có
            let decryptedAttachments = msg.attachments;
            if (msg.attachments && msg.attachments.length > 0) {
              console.log(`🔓 Decrypting ${msg.attachments.length} attachments for message ${msg._id}`);
              decryptedAttachments = await decryptAttachments(
                msg.attachments,
                msg.sender.clerkId
              );
            }

            return {
              ...msg,
              content: decryptedContent,
              attachments: decryptedAttachments,
              status: 'sent' as MessageStatus,
              decryption_error: false,
            };
          } catch (error) {
            console.error(`❌ Failed to decrypt message ${msg._id}:`, error);
            return {
              ...msg,
              content: msg.encrypted_content ? '[🔒 Decryption failed]' : msg.content || '[❌ No content]',
              status: 'failed' as MessageStatus,
              decryption_error: true,
            };
          }
        })
      );

      console.log(`✅ Decryption complete: ${decryptedMessages.length} messages`);

      if (append) {
        setMessages((prev) => [...decryptedMessages, ...prev]);
      } else {
        setMessages(decryptedMessages);
      }

      setHasMore(pagination?.hasNext || false);
      
      console.log(`✅ Loaded ${decryptedMessages.length} messages (page ${pageNum})`);
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
  [conversationId, getToken, API_BASE_URL, MESSAGES_PER_PAGE, decryptMessage, decryptAttachments, encryptionInitialized]
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

  // ✨ UPDATE: Send message - Support GIF/Sticker
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

        let messageContent = '';
        let messageType: Message['type'] = 'text';
        let attachmentIds: string[] = [];
        let replyToId: string | undefined;
        let encryptedFiles: any[] | undefined;
        let localUris: string[] | undefined;
        let richMedia: RichMediaDTO | undefined; // ✨ NEW

        if (data instanceof FormData) {
          messageContent = (data.get('content') as string) || '';
          messageType = (data.get('type') as Message['type']) || 'text';
          replyToId = (data.get('replyTo') as string) || undefined;
        } else {
          messageContent = String(data.content || '').trim();
          messageType = data.type;
          attachmentIds = data.attachments || [];
          replyToId = data.replyTo;
          richMedia = data.richMedia; // ✨ NEW
          if ('encryptedFiles' in data) {
            encryptedFiles = (data as any).encryptedFiles;
            localUris = (data as any).localUris;
          }
        }

        // ✨ NEW: CASE 0: GIF/STICKER
        if ((messageType === 'gif' || messageType === 'sticker') && richMedia) {
          console.log(`✨ Sending ${messageType} message with rich media from ${richMedia.provider}`);

          const optimisticMessage = createOptimisticMessage({
            content: richMedia.title || messageType.toUpperCase(),
            type: messageType,
            richMedia,
          });
          setMessages((prev) => [...prev, optimisticMessage]);

          const requestBody: any = {
            conversationId,
            type: messageType,
            richMedia: richMedia,
          };

          if (messageContent) {
            requestBody.content = messageContent;
          }

          if (replyToId) {
            requestBody.replyTo = replyToId;
          }

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

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || "Failed to send message");
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.tempId === optimisticMessage.tempId
                ? {
                    ...result.data,
                    content: messageContent || richMedia.title || messageType.toUpperCase(),
                    status: 'sent' as MessageStatus,
                  }
                : msg
            )
          );

          console.log(`✅ ${messageType} sent successfully`);
          return result.data;
        }

        // ✅ CASE 1: ENCRYPTED FILES
        if (encryptedFiles && encryptedFiles.length > 0) {
          console.log('🔒 Sending message with encrypted files');

          const optimisticMessage = createOptimisticMessage({
            content: messageContent || 'File',
            type: 'file',
          }, localUris);
          setMessages((prev) => [...prev, optimisticMessage]);

          const requestBody: any = {
            conversationId,
            type: 'file',
            encryptedFiles: encryptedFiles,
          };

          if (messageContent) {
            requestBody.content = messageContent;
          }

          if (replyToId) {
            requestBody.replyTo = replyToId;
          }

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

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || "Failed to send message");
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.tempId === optimisticMessage.tempId
                ? {
                    ...result.data,
                    content: messageContent || 'File',
                    status: 'sent' as MessageStatus,
                    localUri: localUris,
                  }
                : msg
            )
          );

          console.log('✅ Encrypted files sent successfully');
          return result.data;
        }

        // ✅ CASE 2: TEXT MESSAGE
        if (typeof messageContent !== 'string') {
          throw new Error('Message content must be a string');
        }

        if (!messageContent.trim() && (!attachmentIds || attachmentIds.length === 0)) {
          return {} as Message;
        }

        const optimisticMessage = createOptimisticMessage({
          content: messageContent,
          type: messageType,
          attachments: attachmentIds,
          replyTo: replyToId,
        });
        
        setMessages((prev) => [...prev, optimisticMessage]);

        let encryptedContent = '';
        let encryptionMetadata = null;

        if (messageType === 'text' && messageContent.trim()) {
          try {
            const conversationResponse = await fetch(
              `${API_BASE_URL}/api/conversations/${conversationId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            
            if (!conversationResponse.ok) {
              throw new Error('Failed to fetch conversation');
            }

            const convResult = await conversationResponse.json();
            const participants = convResult.data.participants || [];
            const recipientId = participants.find(
              (p: any) => p.clerkId !== user?.id
            )?.clerkId;

            if (!recipientId) {
              throw new Error('Recipient not found');
            }

            console.log('🔒 Encrypting message for:', recipientId);
            
            const encrypted = await encryptMessage(recipientId, messageContent);
            encryptedContent = encrypted.encryptedContent;
            encryptionMetadata = encrypted.encryptionMetadata;

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

        const requestBody: any = {
          conversationId,
          type: messageType,
        };

        if (replyToId) {
          requestBody.replyTo = replyToId;
        }

        if (messageType === 'text') {
          if (!encryptedContent) {
            throw new Error('Failed to encrypt message');
          }
          
          requestBody.encryptedContent = encryptedContent;
          requestBody.encryptionMetadata = encryptionMetadata;
        } else {
          if (messageContent) {
            requestBody.content = messageContent;
          }
        }

        if (attachmentIds.length > 0) {
          requestBody.attachments = attachmentIds;
        }

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

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Server error:', errorData);
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to send message");
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === optimisticMessage.tempId
              ? {
                  ...result.data,
                  content: messageContent,
                  status: 'sent' as MessageStatus,
                }
              : msg
          )
        );

        console.log('✅ Message sent successfully');
        return result.data;

      } catch (err) {
        console.error('❌ sendMessage failed:', err);
        
        setMessages((prev) =>
          prev.filter((msg) => !msg.tempId)
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
    [getToken, API_BASE_URL]
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

  // ✨ NEW: Toggle Reaction
  const toggleReaction = useCallback(
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
            body: JSON.stringify({ 
              action: "reaction", 
              reactionType: reaction,
              toggle: true // ✨ Toggle mode
            }),
          }
        );

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to toggle reaction");
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id ? { ...msg, reactions: result.data.reactions } : msg
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to toggle reaction";
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

  // Socket event handlers
  useEffect(() => {
    if (!socket || !conversationId) return;

    console.log('🔌 Setting up socket listeners for conversation:', conversationId);

    const handleNewMessage = async (data: any) => {
  console.log('📩 NEW MESSAGE event received:', {
    messageId: data.message_id,
    senderId: data.sender_id,
    hasEncryptedContent: !!data.encrypted_content,
    hasMessageEncryptedContent: !!data.message?.encrypted_content,
    hasMessageContent: !!data.message?.content,
    encryptionInitialized,
  });

  if (data.conversation_id !== conversationId) {
    return;
  }

  if (!data.message) {
    console.warn('⚠️ No message object in socket event');
    return;
  }

  let newMessage = data.message;

  // ✅ Handle own message (từ optimistic update)
  if (data.sender_id === user?.id) {
    setMessages((prev) => {
      const optimisticIndex = prev.findIndex(msg => msg.tempId && msg.status === 'sending');
      
      if (optimisticIndex !== -1) {
        const updated = [...prev];
        updated[optimisticIndex] = {
          ...newMessage,
          content: prev[optimisticIndex].content, // ✅ Giữ content từ optimistic
          status: 'sent' as MessageStatus,
          localUri: prev[optimisticIndex].localUri,
        };
        console.log('✅ Updated own message from optimistic to sent');
        return updated;
      } else {
        console.log('⚠️ No optimistic message found, skipping');
        return prev;
      }
    });
    
    return;
  }

  // ✅ Decrypt message từ người khác
  try {
    if (newMessage.encrypted_content) {
      if (encryptionInitialized) {
        console.log('🔓 Decrypting received message');
        console.log('🔓 From sender:', data.sender_id);
        console.log('🔓 Encrypted preview:', newMessage.encrypted_content.substring(0, 50));
        
        const decrypted = await decryptMessage(
          data.sender_id,
          newMessage.encrypted_content
        );
        
        console.log('✅ Decrypted content:', decrypted.substring(0, 50));
        
        newMessage = {
          ...newMessage,
          content: decrypted,
        };
      } else {
        console.warn('⚠️ Encryption not ready, cannot decrypt');
        newMessage = {
          ...newMessage,
          content: '[🔒 Encrypted - Initializing...]',
        };
      }
    } else if (!newMessage.content) {
      console.error('❌ Message has no content or encrypted_content!');
      newMessage = {
        ...newMessage,
        content: '[❌ No content]',
      };
    }

    // ✅ Decrypt attachments
    if (newMessage.attachments && newMessage.attachments.length > 0) {
      if (encryptionInitialized) {
        console.log('🔓 Decrypting received attachments');
        const decryptedAttachments = await decryptAttachments(
          newMessage.attachments,
          data.sender_id
        );
        newMessage = {
          ...newMessage,
          attachments: decryptedAttachments,
        };
      } else {
        console.warn('⚠️ Cannot decrypt attachments - encryption not ready');
      }
    }

    newMessage = {
      ...newMessage,
      status: 'sent' as MessageStatus,
      decryption_error: false,
    };
  } catch (error) {
    console.error('❌ Failed to decrypt received message:', error);
    newMessage = {
      ...newMessage,
      content: newMessage.encrypted_content ? '[🔒 Decryption failed]' : newMessage.content || '[❌ Error]',
      status: 'failed' as MessageStatus,
      decryption_error: true,
    };
  }

  // ✅ Add to messages
  setMessages((prev) => {
    const exists = prev.some((msg) => msg._id === newMessage._id);
    if (!exists) {
      console.log('✅ Adding new message to list');
      setSocketMessageCount(prevCount => prevCount + 1);
      return [...prev, newMessage];
    } else {
      console.log('⚠️ Message already exists, skipping');
      return prev;
    }
  });
};

    const handleUpdateMessage = (data: any) => {
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    };

    const handleDeleteReaction = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    };

    const handleMessageRead = (data: any) => {
      if (data.conversation_id !== conversationId || data.user_id === user?.id) {
        return;
      }
      
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id === data.message_id) {
            const isAlreadyRead = msg.read_by.some(r => r.user === data.user_id);
            
            if (!isAlreadyRead) {
              return {
                ...msg,
                read_by: [
                  ...msg.read_by,
                  {
                    user: data.user_id,
                    read_at: new Date(data.read_at),
                    userInfo: data.user_info
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
      if (data.conversation_id !== conversationId || data.read_by === user?.id) {
        return;
      }
      
      setMessages((prev) =>
        prev.map((msg) => {
          const isAlreadyRead = msg.read_by.some((r) => r.user === data.read_by);
          
          if (!isAlreadyRead && msg.sender.clerkId !== data.read_by) {
            return {
              ...msg,
              read_by: [
                ...msg.read_by,
                {
                  user: data.read_by,
                  read_at: new Date(data.read_at),
                  userInfo: data.user_info
                },
              ],
            };
          }
          return msg;
        })
      );
    };

    const handleUserTyping = (data: any) => {
      if (data.conversation_id !== conversationId || data.user_id === user?.id) {
        return;
      }

      if (data.is_typing) {
        setTypingUsers(prev => {
          const exists = prev.some(u => u.userId === data.user_id);
          if (exists) {
            return prev;
          }
          return [...prev, { userId: data.user_id, userName: data.user_name }];
        });

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.user_id));
        }, 3000);
      } else {
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
  }, [socket, conversationId, on, off, user?.id, decryptMessage, decryptAttachments, encryptionInitialized]);

  useEffect(() => {
  if (conversationId && encryptionInitialized) {
    console.log('🔄 Conversation + Encryption ready, fetching messages...');
    clearMessages();
    fetchMessages(1, false);
  } else if (conversationId && !encryptionInitialized) {
    console.log('⏳ Waiting for encryption to initialize...');
  }
}, [conversationId, encryptionInitialized]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    toggleReaction, // ✨ NEW
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