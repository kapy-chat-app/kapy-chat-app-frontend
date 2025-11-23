// hooks/message/useMessages.ts - WITH CACHE INTEGRATION
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEncryption } from "./useEncryption";
import { useFileDecryption } from "./useFileDecryption";
import { useSocket } from "./useSocket";
import { messageCacheService, CachedMessage, ConversationMeta } from "@/lib/cache/MessageCacheService";

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

export interface MessageReaction {
  user: MessageSender;
  type: "heart" | "like" | "sad" | "angry" | "laugh" | "wow" | "dislike";
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

export type MessageStatus =
  | "sending"
  | "sent"
  | "failed"
  | "encrypting"
  | "decrypting";

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
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "voice_note"
    | "location"
    | "gif"
    | "sticker";
  attachments: MessageAttachment[];
  reply_to?: Message;
  reactions: MessageReaction[];
  is_edited: boolean;
  edited_at?: Date;
  read_by: MessageReadBy[];
  metadata?: { // ✨ NEW
    isSystemMessage?: boolean;
    action?: string;
    [key: string]: any;
  };
  rich_media?: RichMediaDTO;
  created_at: Date;
  updated_at: Date;
  status?: MessageStatus;
  tempId?: string;
  localUri?: string[];
  decryption_error?: boolean;
}

export interface CreateMessageData {
  content?: string;
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "voice_note"
    | "location"
    | "gif"
    | "sticker";
  attachments?: string[];
  replyTo?: string;
  encryptedFiles?: any[];
  localUris?: string[];
  richMedia?: RichMediaDTO;
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
  toggleReaction: (id: string, reaction: string) => Promise<void>;
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
  clearMessageCache: () => Promise<void>;
  clearAllMessageCache: () => Promise<void>;
}

// =============================================
// CACHE HELPERS
// =============================================

const toCachedMessage = (msg: Message, conversationId: string): CachedMessage => ({
  _id: msg._id,
  conversation_id: conversationId,
  sender_id: msg.sender.clerkId,
  sender_name: msg.sender.full_name,
  sender_avatar: msg.sender.avatar,
  content: msg.content || '',
  type: msg.type,
  attachments_json: JSON.stringify(msg.attachments.map(att => ({
    _id: att._id,
    file_name: att.file_name,
    file_type: att.file_type,
    file_size: att.file_size,
    url: att.url,
    is_encrypted: att.is_encrypted,
    encryption_metadata: att.encryption_metadata,
    decryptedUri: att.decryptedUri,
  }))),
  reactions_json: JSON.stringify(msg.reactions),
  read_by_json: JSON.stringify(msg.read_by),
  reply_to_json: msg.reply_to ? JSON.stringify({
    _id: msg.reply_to._id,
    content: msg.reply_to.content,
    sender: msg.reply_to.sender,
    type: msg.reply_to.type,
  }) : undefined,
  metadata_json: msg.metadata ? JSON.stringify(msg.metadata) : undefined, // ✨ NEW
  is_edited: msg.is_edited ? 1 : 0,
  created_at: new Date(msg.created_at).getTime(),
  updated_at: new Date(msg.updated_at).getTime(),
  rich_media_json: msg.rich_media ? JSON.stringify(msg.rich_media) : undefined,
});

const fromCachedMessage = (cached: CachedMessage): Message => {
  const attachments = JSON.parse(cached.attachments_json || '[]');
  const replyTo = cached.reply_to_json ? JSON.parse(cached.reply_to_json) : undefined;
  const metadata = cached.metadata_json ? JSON.parse(cached.metadata_json) : undefined; // ✨ NEW
  
  return {
    _id: cached._id,
    conversation: cached.conversation_id,
    sender: {
      _id: cached.sender_id,
      clerkId: cached.sender_id,
      full_name: cached.sender_name,
      username: cached.sender_name.toLowerCase().replace(/\s/g, ''),
      avatar: cached.sender_avatar,
    },
    content: cached.content,
    type: cached.type as Message['type'],
    attachments: attachments,
    reactions: JSON.parse(cached.reactions_json || '[]'),
    read_by: JSON.parse(cached.read_by_json || '[]'),
    reply_to: replyTo,
    metadata: metadata, // ✨ NEW
    is_edited: cached.is_edited === 1,
    created_at: new Date(cached.created_at),
    updated_at: new Date(cached.updated_at),
    rich_media: cached.rich_media_json ? JSON.parse(cached.rich_media_json) : undefined,
    status: 'sent' as MessageStatus,
  };
};

// =============================================
// HOOK
// =============================================

export const useMessages = (
  conversationId: string | null
): MessageHookReturn => {
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
  const {
    encryptMessage,
    decryptMessage,
    isInitialized: encryptionInitialized,
  } = useEncryption();
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
    async (
      attachments: MessageAttachment[],
      senderClerkId: string
    ): Promise<MessageAttachment[]> => {
      if (!attachments || attachments.length === 0) {
        return [];
      }

      console.log(
        `🔓 Decrypting ${attachments.length} attachments from sender:`,
        senderClerkId
      );

      return await Promise.all(
        attachments.map(async (att) => {
          console.log(`📎 Processing attachment:`, {
            id: att._id,
            file_name: att.file_name,
            file_type: att.file_type,
            is_encrypted: att.is_encrypted,
          });

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
              att._id,
              att.file_type
            );

            console.log(`✅ File ${att.file_name} decrypted successfully`);

            return {
              ...att,
              decryptedUri,
            };
          } catch (error) {
            console.error(`❌ Failed to decrypt file ${att.file_name}:`, error);

            if (
              error instanceof Error &&
              error.message.includes("not initialized")
            ) {
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

  const decryptMessageContent = useCallback(
    async (message: Message): Promise<string> => {
      if (!message.encrypted_content) {
        return message.content || "";
      }

      if (!encryptionInitialized) {
        return "[🔒 Encrypted]";
      }

      try {
        const decrypted = await decryptMessage(
          message.sender.clerkId,
          message.encrypted_content
        );
        return decrypted;
      } catch (error) {
        console.error("❌ Failed to decrypt message:", error);
        return "[🔒 Decryption failed]";
      }
    },
    [decryptMessage, encryptionInitialized]
  );

  const retryDecryption = useCallback(
    async (messageId: string) => {
      try {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, status: "decrypting" as MessageStatus }
              : msg
          )
        );

        const message = messages.find((m) => m._id === messageId);
        if (!message) {
          throw new Error("Message not found");
        }

        let decryptedContent = message.content;
        if (message.encrypted_content) {
          decryptedContent = await decryptMessageContent(message);
        }

        const decryptedAtts = await decryptAttachments(
          message.attachments,
          message.sender.clerkId
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  content: decryptedContent,
                  attachments: decryptedAtts,
                  status: "sent" as MessageStatus,
                  decryption_error: false,
                }
              : msg
          )
        );

        // Update cache
        if (conversationId) {
          const cached = toCachedMessage(
            { ...message, content: decryptedContent, attachments: decryptedAtts },
            conversationId
          );
          await messageCacheService.saveMessages([cached]);
        }

        console.log("✅ Message decrypted successfully");
      } catch (error) {
        console.error("❌ Retry decryption failed:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  status: "failed" as MessageStatus,
                  decryption_error: true,
                }
              : msg
          )
        );
      }
    },
    [messages, decryptMessageContent, decryptAttachments, conversationId]
  );

  useEffect(() => {
    if (socket && conversationId) {
      const joinRoom = () => {
        if (socket.connected) {
          emit("joinConversation", conversationId);
          console.log(`📥 Joined conversation: ${conversationId}`);
        } else {
          const checkConnection = setInterval(() => {
            if (socket.connected) {
              emit("joinConversation", conversationId);
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
        }
        setTypingUsers([]);
      };
    }
  }, [socket, conversationId, emit]);

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!socket || !conversationId || !user) return;
      if (!socket.connected) return;

      emit("userTyping", {
        conversation_id: conversationId,
        user_id: user.id,
        user_name: user.fullName || user.username || "User",
        is_typing: isTyping,
      });
    },
    [socket, conversationId, user, emit]
  );

  // =============================================
  // FETCH MESSAGES WITH CACHE
  // =============================================
  const fetchMessages = useCallback(
  async (pageNum: number = 1, append: boolean = false) => {
    if (!conversationId || loadingRef.current) return;

    try {
      loadingRef.current = true;
      setError(null);

      // =============================================
      // STEP 1: Load từ cache ngay lập tức
      // =============================================
      if (pageNum === 1 && !append) {
        console.log('📦 Loading messages from cache...');
        
        const cachedMessages = await messageCacheService.getMessages(
          conversationId, 
          MESSAGES_PER_PAGE
        );

        if (cachedMessages.length > 0) {
          // ✅ FIXED: Không reverse - SQL đã sort DESC rồi
          const msgs = cachedMessages.map(fromCachedMessage);
          setMessages(msgs);
          console.log(`✅ Loaded ${msgs.length} messages from cache (instant)`);
          setLoading(false);
        } else {
          setLoading(true);
          console.log('📭 No cached messages, fetching from server...');
        }
      } else {
        setLoading(true);
      }

      // =============================================
      // STEP 2: Fetch tin nhắn mới từ server
      // =============================================
      const token = await getToken();
      const meta = await messageCacheService.getConversationMeta(conversationId);
      
      let url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=${pageNum}&limit=${MESSAGES_PER_PAGE}`;
      
      // Nếu có cache và load page 1, chỉ fetch tin mới
      if (meta && meta.last_sync_time > 0 && pageNum === 1 && !append) {
        const lastSyncISO = new Date(meta.last_sync_time).toISOString();
        url += `&after=${encodeURIComponent(lastSyncISO)}`;
        console.log(`🔄 Fetching messages after: ${lastSyncISO}`);
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch messages");
      }

      const serverMessages = result.data.messages || [];
      const pagination = result.data.pagination;

      console.log(`📥 Fetched ${serverMessages.length} messages from server`);

      // Không có tin mới và đã có cache
      if (serverMessages.length === 0 && pageNum === 1 && !append) {
        setHasMore(pagination?.hasNext || false);
        console.log('✅ No new messages, using cache');
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      // =============================================
      // STEP 3: Decrypt tin nhắn mới
      // =============================================
      console.log('🔓 Decrypting messages...');

      const decryptedMessages = await Promise.all(
        serverMessages.map(async (msg: Message) => {
          try {
            let decryptedContent = msg.content;

            if (msg.type === "text" && msg.encrypted_content) {
              if (encryptionInitialized) {
                try {
                  decryptedContent = await decryptMessage(
                    msg.sender.clerkId,
                    msg.encrypted_content
                  );
                } catch (decryptError) {
                  decryptedContent = "[🔒 Decryption failed]";
                  return {
                    ...msg,
                    content: decryptedContent,
                    status: "failed" as MessageStatus,
                    decryption_error: true,
                  };
                }
              } else {
                decryptedContent = "[🔒 Encrypted - Initializing...]";
              }
            } else if (msg.type !== "text") {
              decryptedContent = msg.content;
            } else if (msg.type === "text" && !msg.encrypted_content && !msg.content) {
              decryptedContent = "[❌ No content]";
            }

            let decryptedAtts = msg.attachments;
            if (msg.attachments && msg.attachments.length > 0) {
              decryptedAtts = await decryptAttachments(
                msg.attachments,
                msg.sender.clerkId
              );
            }

            return {
              ...msg,
              content: decryptedContent,
              attachments: decryptedAtts,
              status: "sent" as MessageStatus,
              decryption_error: false,
            };
          } catch (error) {
            console.error(`❌ Failed to process message ${msg._id}:`, error);
            return {
              ...msg,
              content: msg.encrypted_content ? "[🔒 Decryption failed]" : msg.content,
              status: "failed" as MessageStatus,
              decryption_error: msg.type === "text" && !!msg.encrypted_content,
            };
          }
        })
      );

      // =============================================
      // STEP 4: Lưu vào cache
      // =============================================
      if (decryptedMessages.length > 0) {
        console.log('💾 Saving to cache...');
        
        const messagesToCache = decryptedMessages.map(msg => 
          toCachedMessage(msg, conversationId)
        );
        await messageCacheService.saveMessages(messagesToCache);

        // Update metadata
        const lastMsg = decryptedMessages[decryptedMessages.length - 1];
        await messageCacheService.updateConversationMeta({
          conversation_id: conversationId,
          last_sync_time: Date.now(),
          total_cached: (meta?.total_cached || 0) + decryptedMessages.length,
          last_message_id: lastMsg._id,
        });

        console.log('✅ Saved to cache');
      }

      // =============================================
      // STEP 5: Update UI
      // =============================================
      if (pageNum === 1 && !append) {
        // Load lại từ cache
        const allCached = await messageCacheService.getMessages(
          conversationId, 
          MESSAGES_PER_PAGE
        );
        // ✅ FIXED: Không reverse
        const allMessages = allCached.map(fromCachedMessage);
        setMessages(allMessages);
      } else if (append) {
        setMessages(prev => [...decryptedMessages, ...prev]);
      } else {
        setMessages(decryptedMessages);
      }

      setHasMore(pagination?.hasNext || false);
      console.log(`✅ Sync complete`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch messages";
      setError(errorMessage);
      console.error("❌ Error fetching messages:", err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  },
  [
    conversationId,
    getToken,
    API_BASE_URL,
    MESSAGES_PER_PAGE,
    decryptMessage,
    decryptAttachments,
    encryptionInitialized,
  ]
);

  const createOptimisticMessage = useCallback(
    (data: CreateMessageData | FormData, localUris?: string[]): Message => {
      const tempId = `temp_${Date.now()}_${Math.random()}`;

      let messageType: Message["type"] = "text";
      let content = "";
      let attachmentPreviews: MessageAttachment[] = [];

      if (data instanceof FormData) {
        messageType = (data.get("type") as Message["type"]) || "text";
        content = String(data.get("content") || "");
      } else {
        messageType = data.type;
        content = String(data.content || "");
      }

      if (localUris && localUris.length > 0) {
        attachmentPreviews = localUris.map((uri, index) => {
          const isImage = uri.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) || messageType === 'image';
          const isVideo = uri.toLowerCase().match(/\.(mp4|mov|avi|webm)$/i) || messageType === 'video';
          const isAudio = uri.toLowerCase().match(/\.(mp3|m4a|wav|aac)$/i) || messageType === 'audio';

          let fileType = 'application/octet-stream';
          if (isImage) fileType = 'image/jpeg';
          else if (isVideo) fileType = 'video/mp4';
          else if (isAudio) fileType = 'audio/m4a';

          return {
            _id: `temp_att_${Date.now()}_${index}`,
            file_name: `file_${index}`,
            file_type: fileType,
            file_size: 0,
            url: '',
          } as MessageAttachment;
        });
      }

      return {
        _id: tempId,
        tempId,
        conversation: conversationId!,
        sender: {
          _id: user?.id || "",
          clerkId: user?.id || "",
          full_name: user?.fullName || "You",
          username: user?.username || "you",
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
        status: "encrypting" as MessageStatus,
        localUri: localUris,
      };
    },
    [conversationId, user]
  );

  const sendMessage = useCallback(
    async (data: CreateMessageData | FormData): Promise<Message> => {
      if (!conversationId) {
        throw new Error("No conversation selected");
      }

      if (!encryptionInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        let messageContent = "";
        let messageType: Message["type"] = "text";
        let attachmentIds: string[] = [];
        let replyToId: string | undefined;
        let encryptedFiles: any[] | undefined;
        let localUris: string[] | undefined;
        let richMedia: RichMediaDTO | undefined;

        if (data instanceof FormData) {
          messageContent = (data.get("content") as string) || "";
          messageType = (data.get("type") as Message["type"]) || "text";
          replyToId = (data.get("replyTo") as string) || undefined;
        } else {
          messageContent = String(data.content || "").trim();
          messageType = data.type;
          attachmentIds = data.attachments || [];
          replyToId = data.replyTo;
          richMedia = data.richMedia;
          if ("encryptedFiles" in data) {
            encryptedFiles = (data as any).encryptedFiles;
            localUris = (data as any).localUris;
          }
        }

        // GIF/STICKER
        if ((messageType === "gif" || messageType === "sticker") && richMedia) {
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

          if (messageContent) requestBody.content = messageContent;
          if (replyToId) requestBody.replyTo = replyToId;

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
          if (!result.success) throw new Error(result.error);

          const finalMessage = {
            ...result.data,
            content: messageContent || richMedia.title || messageType.toUpperCase(),
            status: "sent" as MessageStatus,
          };

          setMessages((prev) =>
            prev.map((msg) =>
              msg.tempId === optimisticMessage.tempId ? finalMessage : msg
            )
          );

          // Save to cache
          const cached = toCachedMessage(finalMessage, conversationId);
          await messageCacheService.saveMessages([cached]);

          return result.data;
        }

        // ENCRYPTED FILES
        if (encryptedFiles && encryptedFiles.length > 0) {
          const optimisticMessage = createOptimisticMessage(
            { content: messageContent || "File", type: "file" },
            localUris
          );
          setMessages((prev) => [...prev, optimisticMessage]);

          const requestBody: any = {
            conversationId,
            type: "file",
            encryptedFiles: encryptedFiles,
          };

          if (messageContent) requestBody.content = messageContent;
          if (replyToId) requestBody.replyTo = replyToId;

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
          if (!result.success) throw new Error(result.error);

          const finalMessage = {
            ...result.data,
            content: messageContent || "File",
            status: "sent" as MessageStatus,
            localUri: localUris,
          };

          setMessages((prev) =>
            prev.map((msg) =>
              msg.tempId === optimisticMessage.tempId ? finalMessage : msg
            )
          );

          // Save to cache
          const cached = toCachedMessage(finalMessage, conversationId);
          await messageCacheService.saveMessages([cached]);

          return result.data;
        }

        // TEXT MESSAGE
        if (typeof messageContent !== "string") {
          throw new Error("Message content must be a string");
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

        let encryptedContent = "";
        let encryptionMetadata = null;

        if (messageType === "text" && messageContent.trim()) {
          try {
            const conversationResponse = await fetch(
              `${API_BASE_URL}/api/conversations/${conversationId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!conversationResponse.ok) throw new Error("Failed to fetch conversation");

            const convResult = await conversationResponse.json();
            const participants = convResult.data.participants || [];
            const recipientId = participants.find((p: any) => p.clerkId !== user?.id)?.clerkId;

            if (!recipientId) throw new Error("Recipient not found");

            const encrypted = await encryptMessage(recipientId, messageContent);
            encryptedContent = encrypted.encryptedContent;
            encryptionMetadata = encrypted.encryptionMetadata;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.tempId === optimisticMessage.tempId
                  ? { ...msg, status: "sending" as MessageStatus }
                  : msg
              )
            );
          } catch (encryptError) {
            setMessages((prev) => prev.filter((msg) => msg.tempId !== optimisticMessage.tempId));
            throw new Error(`Encryption failed: ${encryptError}`);
          }
        }

        const requestBody: any = { conversationId, type: messageType };
        if (replyToId) requestBody.replyTo = replyToId;

        if (messageType === "text") {
          if (!encryptedContent) throw new Error("Failed to encrypt message");
          requestBody.encryptedContent = encryptedContent;
          requestBody.encryptionMetadata = encryptionMetadata;
        } else {
          if (messageContent) requestBody.content = messageContent;
        }

        if (attachmentIds.length > 0) requestBody.attachments = attachmentIds;

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
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const finalMessage = {
          ...result.data,
          content: messageContent,
          status: "sent" as MessageStatus,
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === optimisticMessage.tempId ? finalMessage : msg
          )
        );

        // Save to cache
        const cached = toCachedMessage(finalMessage, conversationId);
        await messageCacheService.saveMessages([cached]);

        return result.data;
      } catch (err) {
        setMessages((prev) => prev.filter((msg) => !msg.tempId));
        throw err;
      }
    },
    [
      conversationId,
      getToken,
      user,
      createOptimisticMessage,
      encryptMessage,
      encryptionInitialized,
      API_BASE_URL,
    ]
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

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const updatedMessage = result.data;
        setMessages((prev) => prev.map((msg) => (msg._id === id ? updatedMessage : msg)));

        // Update cache
        await messageCacheService.updateMessage(id, { content, is_edited: 1 });

        return updatedMessage;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to edit message";
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
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        if (type === "both") {
          setMessages((prev) => prev.filter((msg) => msg._id !== id));
          await messageCacheService.deleteMessage(id);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === id ? { ...msg, content: "This message was deleted" } : msg
            )
          );
          await messageCacheService.updateMessage(id, { content: "This message was deleted" });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete message";
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
        if (!result.success) throw new Error(result.error);

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id ? { ...msg, reactions: result.data.reactions } : msg
          )
        );

        // Update cache
        await messageCacheService.updateMessage(id, {
          reactions_json: JSON.stringify(result.data.reactions),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to add reaction";
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
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id ? { ...msg, reactions: result.data.reactions } : msg
          )
        );

        // Update cache
        await messageCacheService.updateMessage(id, {
          reactions_json: JSON.stringify(result.data.reactions),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to remove reaction";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [conversationId, getToken, API_BASE_URL]
  );

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
            body: JSON.stringify({ action: "reaction", reactionType: reaction, toggle: true }),
          }
        );

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id ? { ...msg, reactions: result.data.reactions } : msg
          )
        );

        // Update cache
        await messageCacheService.updateMessage(id, {
          reactions_json: JSON.stringify(result.data.reactions),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to toggle reaction";
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

        if (response.ok && user?.id) {
          const result = await response.json();
          if (result.success) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg._id === id && !msg.read_by.some((r) => r.user === user.id)) {
                  const newReadBy = [
                    ...msg.read_by,
                    {
                      user: user.id,
                      read_at: new Date(),
                      userInfo: {
                        clerkId: user.id,
                        full_name: user.fullName || "You",
                        username: user.username || "",
                        avatar: user.imageUrl,
                      },
                    },
                  ];
                  
                  // Update cache
                  messageCacheService.updateMessage(id, {
                    read_by_json: JSON.stringify(newReadBy),
                  });
                  
                  return { ...msg, read_by: newReadBy };
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
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok && user?.id && convId === conversationId) {
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
                        full_name: user.fullName || "Unknown",
                        username: user.username || "unknown",
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

  const clearMessageCache = useCallback(async () => {
    if (conversationId) {
      await messageCacheService.clearConversation(conversationId);
      console.log('✅ Cleared cache for conversation:', conversationId);
    }
  }, [conversationId]);

  const clearAllMessageCache = useCallback(async () => {
    await messageCacheService.clearAll();
    console.log('✅ Cleared all message cache');
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleNewMessage = async (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.message) return;

      let newMessage = data.message;

      // Own message
      if (data.sender_id === user?.id) {
        setMessages((prev) => {
          const optimisticIndex = prev.findIndex(
            (msg) => msg.tempId && msg.status === "sending"
          );

          if (optimisticIndex !== -1) {
            const updated = [...prev];
            updated[optimisticIndex] = {
              ...newMessage,
              content: prev[optimisticIndex].content,
              status: "sent" as MessageStatus,
              localUri: prev[optimisticIndex].localUri,
            };
            return updated;
          }
          return prev;
        });
        return;
      }

      // Decrypt message from others
      try {
        if (newMessage.type === "text" && newMessage.encrypted_content) {
          if (encryptionInitialized) {
            const decrypted = await decryptMessage(data.sender_id, newMessage.encrypted_content);
            newMessage = { ...newMessage, content: decrypted };
          } else {
            newMessage = { ...newMessage, content: "[🔒 Encrypted - Initializing...]" };
          }
        } else if (
          newMessage.type === "text" &&
          !newMessage.encrypted_content &&
          !newMessage.content
        ) {
          newMessage = { ...newMessage, content: "[❌ No content]" };
        }

        if (newMessage.attachments && newMessage.attachments.length > 0 && encryptionInitialized) {
          const decryptedAtts = await decryptAttachments(newMessage.attachments, data.sender_id);
          newMessage = { ...newMessage, attachments: decryptedAtts };
        }

        newMessage = { ...newMessage, status: "sent" as MessageStatus, decryption_error: false };
      } catch (error) {
        newMessage = {
          ...newMessage,
          content:
            newMessage.type === "text" && newMessage.encrypted_content
              ? "[🔒 Decryption failed]"
              : newMessage.content,
          status: "failed" as MessageStatus,
          decryption_error: newMessage.type === "text" && !!newMessage.encrypted_content,
        };
      }

      // Add to messages
      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === newMessage._id);
        if (!exists) {
          setSocketMessageCount((prevCount) => prevCount + 1);
          
          // Save to cache
          const cached = toCachedMessage(newMessage, conversationId);
          messageCacheService.saveMessages([cached]);
          
          return [...prev, newMessage];
        }
        return prev;
      });
    };

    const handleUpdateMessage = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? { ...msg, content: data.new_content, is_edited: true, edited_at: new Date(data.edited_at) }
            : msg
        )
      );
      messageCacheService.updateMessage(data.message_id, {
        content: data.new_content,
        is_edited: 1,
      });
    };

    const handleDeleteMessage = (data: any) => {
      if (data.delete_type === "both") {
        setMessages((prev) => prev.filter((msg) => msg._id !== data.message_id));
        messageCacheService.deleteMessage(data.message_id);
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id ? { ...msg, content: "This message was deleted" } : msg
          )
        );
        messageCacheService.updateMessage(data.message_id, {
          content: "This message was deleted",
        });
      }
    };

    const handleNewReaction = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id ? { ...msg, reactions: data.reactions } : msg
        )
      );
      messageCacheService.updateMessage(data.message_id, {
        reactions_json: JSON.stringify(data.reactions),
      });
    };

    const handleDeleteReaction = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id ? { ...msg, reactions: data.reactions } : msg
        )
      );
      messageCacheService.updateMessage(data.message_id, {
        reactions_json: JSON.stringify(data.reactions),
      });
    };

    const handleMessageRead = (data: any) => {
      if (data.conversation_id !== conversationId || data.user_id === user?.id) return;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id === data.message_id) {
            const isAlreadyRead = msg.read_by.some((r) => r.user === data.user_id);
            if (!isAlreadyRead) {
              const newReadBy = [
                ...msg.read_by,
                { user: data.user_id, read_at: new Date(data.read_at), userInfo: data.user_info },
              ];
              messageCacheService.updateMessage(data.message_id, {
                read_by_json: JSON.stringify(newReadBy),
              });
              return { ...msg, read_by: newReadBy };
            }
          }
          return msg;
        })
      );
    };

    const handleConversationMarkedAsRead = (data: any) => {
      if (data.conversation_id !== conversationId || data.read_by === user?.id) return;

      setMessages((prev) =>
        prev.map((msg) => {
          const isAlreadyRead = msg.read_by.some((r) => r.user === data.read_by);
          if (!isAlreadyRead && msg.sender.clerkId !== data.read_by) {
            return {
              ...msg,
              read_by: [
                ...msg.read_by,
                { user: data.read_by, read_at: new Date(data.read_at), userInfo: data.user_info },
              ],
            };
          }
          return msg;
        })
      );
    };

    const handleUserTyping = (data: any) => {
      if (data.conversation_id !== conversationId || data.user_id === user?.id) return;

      if (data.is_typing) {
        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.userId === data.user_id);
          if (exists) return prev;
          return [...prev, { userId: data.user_id, userName: data.user_name }];
        });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== data.user_id));
        }, 3000);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.user_id));
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

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [
    socket,
    conversationId,
    on,
    off,
    user?.id,
    decryptMessage,
    decryptAttachments,
    encryptionInitialized,
  ]);

  useEffect(() => {
    if (conversationId && encryptionInitialized) {
      clearMessages();
      fetchMessages(1, false);
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
    toggleReaction,
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
    clearMessageCache,
    clearAllMessageCache,
  };
};