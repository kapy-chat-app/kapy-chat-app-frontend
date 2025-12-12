// hooks/message/useMessages.ts - COMPLETE FIXED VERSION WITH CACHE
// ✅ Replace your current useMessages.ts with this file

import {
  CachedMessage,
  messageCacheService,
} from "@/lib/cache/MessageCacheService";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChunkedFileDecryption } from "./useChunkedFileDecryption";
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
    chunks?: any[];
    totalChunks?: number;
    fileId?: string;
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
  metadata?: {
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
  isOptimistic?: boolean;
  tempId?: string;
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

const toCachedMessage = (
  msg: Message,
  conversationId: string
): CachedMessage => ({
  _id: msg._id,
  conversation_id: conversationId,
  sender_id: msg.sender.clerkId,
  sender_name: msg.sender.full_name,
  sender_avatar: msg.sender.avatar,
  content: msg.content || "",
  type: msg.type,
  attachments_json: JSON.stringify(
    msg.attachments.map((att) => ({
      _id: att._id,
      file_name: att.file_name,
      file_type: att.file_type,
      file_size: att.file_size,
      url: att.url,
      is_encrypted: att.is_encrypted,
      encryption_metadata: att.encryption_metadata,
      decryptedUri: att.decryptedUri, // ✅ CRITICAL: Save decryptedUri
    }))
  ),
  reactions_json: JSON.stringify(msg.reactions),
  read_by_json: JSON.stringify(msg.read_by),
  reply_to_json: msg.reply_to
    ? JSON.stringify({
        _id: msg.reply_to._id,
        content: msg.reply_to.content,
        sender: msg.reply_to.sender,
        type: msg.reply_to.type,
      })
    : undefined,
  metadata_json: msg.metadata ? JSON.stringify(msg.metadata) : undefined,
  is_edited: msg.is_edited ? 1 : 0,
  created_at: new Date(msg.created_at).getTime(),
  updated_at: new Date(msg.updated_at).getTime(),
  rich_media_json: msg.rich_media ? JSON.stringify(msg.rich_media) : undefined,
});

const fromCachedMessage = (cached: CachedMessage): Message => {
  const attachments = JSON.parse(cached.attachments_json || "[]");
  const replyTo = cached.reply_to_json
    ? JSON.parse(cached.reply_to_json)
    : undefined;
  const metadata = cached.metadata_json
    ? JSON.parse(cached.metadata_json)
    : undefined;

  return {
    _id: cached._id,
    conversation: cached.conversation_id,
    sender: {
      _id: cached.sender_id,
      clerkId: cached.sender_id,
      full_name: cached.sender_name,
      username: cached.sender_name.toLowerCase().replace(/\s/g, ""),
      avatar: cached.sender_avatar,
    },
    content: cached.content,
    type: cached.type as Message["type"],
    attachments: attachments, // ✅ This includes decryptedUri from cache
    reactions: JSON.parse(cached.reactions_json || "[]"),
    read_by: JSON.parse(cached.read_by_json || "[]"),
    reply_to: replyTo,
    metadata: metadata,
    is_edited: !!cached.is_edited,
    created_at: new Date(cached.created_at),
    updated_at: new Date(cached.updated_at),
    rich_media: cached.rich_media_json
      ? JSON.parse(cached.rich_media_json)
      : undefined,
    status: "sent" as MessageStatus,
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

  const { socket, emit, on, off, isConnected } = useSocket();
  const { user } = useUser();
  const { getToken } = useAuth();
  const {
    encryptMessage,
    decryptMessage,
    isInitialized: encryptionInitialized,
  } = useEncryption();
  const { getDecryptedUri } = useFileDecryption();
  const { getDecryptedUriChunked } = useChunkedFileDecryption();

  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fullyCachedMessageIds = useRef<Set<string>>(new Set());
  const decryptingFilesRef = useRef<Set<string>>(new Set());
  const decryptedFilesRef = useRef<Set<string>>(new Set());

  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );

  const MESSAGES_PER_PAGE = 15;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * ✅ Check if message is fully cached
   */
  const isMessageFullyCached = useCallback((msg: Message): boolean => {
    if (fullyCachedMessageIds.current.has(msg._id)) {
      return true;
    }

    if (msg.metadata?.isSystemMessage === true) {
      fullyCachedMessageIds.current.add(msg._id);
      return true;
    }

    const hasDecryptedText = !msg.encrypted_content || !!msg.content;
    const hasEncryptedAttachments = msg.attachments?.some(
      (att) => att.is_encrypted && !att.decryptedUri
    );

    const isFullyCached = hasDecryptedText && !hasEncryptedAttachments;

    if (isFullyCached) {
      fullyCachedMessageIds.current.add(msg._id);
    }

    return isFullyCached;
  }, []);

  /**
   * ✅ Decrypt attachments
   */
  const decryptAttachments = useCallback(
    async (
      attachments: MessageAttachment[],
      senderClerkId: string,
      messageId?: string
    ): Promise<MessageAttachment[]> => {
      if (!attachments || attachments.length === 0) {
        return [];
      }

      return await Promise.all(
        attachments.map(async (att) => {
          const attKey = `${messageId}_${att._id}`;

          if (att.decryptedUri && decryptedFilesRef.current.has(attKey)) {
            return att;
          }

          if (decryptingFilesRef.current.has(attKey)) {
            const startTime = Date.now();
            while (decryptingFilesRef.current.has(attKey)) {
              if (Date.now() - startTime > 30000) break;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            return att;
          }

          if (!att.is_encrypted || !att.encryption_metadata) {
            return att;
          }

          if (att.decryptedUri && att.decryptedUri.startsWith("file://")) {
            try {
              const FileSystem = await import("expo-file-system/legacy");
              const fileInfo = await FileSystem.default.getInfoAsync(
                att.decryptedUri
              );

              if (fileInfo.exists) {
                decryptedFilesRef.current.add(attKey);
                return att;
              }
            } catch (e) {
              console.warn(`⚠️ Failed to verify cache:`, e);
            }
          }

          try {
            decryptingFilesRef.current.add(attKey);

            const token = await getToken();
            if (!token) throw new Error("No auth token");

            let decryptedUri: string;

            const isStreamingUpload =
              att.encryption_metadata.chunks &&
              Array.isArray(att.encryption_metadata.chunks) &&
              att.encryption_metadata.chunks.length > 0;

            if (isStreamingUpload) {
              const metadataUrl = `${API_BASE_URL}/api/files/metadata/${att._id}`;
              const metadataResponse = await fetch(metadataUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!metadataResponse.ok) {
                throw new Error(
                  `Failed to get metadata: ${metadataResponse.status}`
                );
              }

              const metadataData = await metadataResponse.json();
              if (!metadataData.success || !metadataData.data) {
                throw new Error("Invalid metadata response");
              }

              const chunkedResult = metadataData.data;

              decryptedUri = await getDecryptedUriChunked(
                att._id,
                chunkedResult,
                senderClerkId
              );
            } else {
              if (
                !att.encryption_metadata.iv ||
                !att.encryption_metadata.authTag
              ) {
                throw new Error(
                  "Missing iv/authTag for single-file encryption"
                );
              }

              const downloadUrl = `${API_BASE_URL}/api/files/download/${att._id}`;
              const downloadResponse = await fetch(downloadUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!downloadResponse.ok) {
                throw new Error(
                  `Failed to get download URL: ${downloadResponse.status}`
                );
              }

              const downloadData = await downloadResponse.json();
              if (!downloadData.success || !downloadData.downloadUrl) {
                throw new Error("Invalid download response");
              }

              const presignedUrl = downloadData.downloadUrl;

              decryptedUri = await getDecryptedUri(
                att._id,
                att.encryption_metadata.iv,
                att.encryption_metadata.authTag,
                senderClerkId,
                att._id,
                att.file_type,
                presignedUrl
              );
            }

            // ✅ Save to cache
            if (messageId && conversationId) {
              await messageCacheService.updateAttachmentUri(
                messageId,
                att._id,
                decryptedUri
              );
            }

            decryptedFilesRef.current.add(attKey);
            decryptingFilesRef.current.delete(attKey);

            return {
              ...att,
              decryptedUri,
            };
          } catch (error) {
            console.error(`❌ Failed: ${att.file_name}`, error);
            decryptingFilesRef.current.delete(attKey);

            return {
              ...att,
              decryption_error: true,
            };
          }
        })
      );
    },
    [
      getDecryptedUri,
      getDecryptedUriChunked,
      getToken,
      API_BASE_URL,
      conversationId,
    ]
  );

  /**
   * ✅ Decrypt message content
   */
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

  /**
   * ✅ Process message
   */
  const processMessage = useCallback(
    async (msg: Message): Promise<Message> => {
      try {
        if (isMessageFullyCached(msg)) {
          return { ...msg, status: "sent" as MessageStatus };
        }

        let decryptedContent = msg.content;

        if (msg.type === "text" && msg.encrypted_content && !msg.content) {
          if (encryptionInitialized) {
            try {
              decryptedContent = await decryptMessage(
                msg.sender.clerkId,
                msg.encrypted_content
              );
            } catch (decryptError) {
              console.error("❌ Decryption error:", decryptError);
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
        }

        let decryptedAtts = msg.attachments;
        if (msg.attachments && msg.attachments.length > 0) {
          const needsDecryption = msg.attachments.filter((att) => {
            if (!att.is_encrypted) return false;
            if (!att.encryption_metadata) return false;

            const attKey = `${msg._id}_${att._id}`;
            if (att.decryptedUri && decryptedFilesRef.current.has(attKey)) {
              return false;
            }

            return true;
          });

          if (needsDecryption.length > 0) {
            const newlyDecrypted = await decryptAttachments(
              needsDecryption,
              msg.sender.clerkId,
              msg._id
            );

            decryptedAtts = msg.attachments.map((att) => {
              if (!att.is_encrypted) return att;

              const decrypted = newlyDecrypted.find((d) => d._id === att._id);
              return decrypted || att;
            });
          }
        }

        const result = {
          ...msg,
          content: decryptedContent,
          attachments: decryptedAtts,
          status: "sent" as MessageStatus,
          decryption_error: false,
        };

        const hasDecryptedText = !result.encrypted_content || !!result.content;
        const hasDecryptedFiles = result.attachments?.every(
          (att) => !att.is_encrypted || att.decryptedUri
        );

        if (hasDecryptedText && hasDecryptedFiles) {
          fullyCachedMessageIds.current.add(result._id);
        }

        return result;
      } catch (error) {
        console.error(`❌ Exception:`, error);
        return {
          ...msg,
          content: msg.encrypted_content
            ? "[🔒 Decryption failed]"
            : msg.content,
          status: "failed" as MessageStatus,
          decryption_error: msg.type === "text" && !!msg.encrypted_content,
        };
      }
    },
    [
      isMessageFullyCached,
      decryptMessage,
      decryptAttachments,
      encryptionInitialized,
    ]
  );

  // =============================================
  // ✅ FETCH MESSAGES WITH CACHE-FIRST + VERIFICATION
  // =============================================
  const fetchMessages = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!conversationId || loadingRef.current) return;

      try {
        loadingRef.current = true;
        setError(null);

        console.log(
          `📥 [FETCH] Starting - Page: ${pageNum}, Append: ${append}`
        );

        // ✅ STEP 1: Load from cache FIRST
        if (pageNum === 1 && !append) {
          console.log("📦 [FETCH] Checking cache...");

          const cachedMessages = await messageCacheService.getMessages(
            conversationId,
            MESSAGES_PER_PAGE
          );

          console.log(
            `📊 [FETCH] Cache returned ${cachedMessages.length} messages`
          );

          if (cachedMessages.length > 0) {
            // ✅ Verify attachments have URIs
            let allHaveUris = true;

            for (const cached of cachedMessages) {
              const attachments = JSON.parse(cached.attachments_json || "[]");
              if (attachments.length > 0) {
                const hasUri = attachments.every(
                  (att: any) => !att.is_encrypted || att.decryptedUri
                );

                if (!hasUri) {
                  allHaveUris = false;
                  break;
                }
              }
            }

            if (allHaveUris) {
              console.log(
                "✅ [FETCH] All messages have decrypted URIs - using cache!"
              );

              const msgs = cachedMessages.map(fromCachedMessage).reverse();
              setMessages(msgs);

              // Mark as cached
              msgs.forEach((msg) => {
                fullyCachedMessageIds.current.add(msg._id);

                msg.attachments?.forEach((att) => {
                  if (att.decryptedUri) {
                    const attKey = `${msg._id}_${att._id}`;
                    decryptedFilesRef.current.add(attKey);
                  }
                });
              });

              console.log("✅ [FETCH] Using cache - NO DECRYPTION!");
              setLoading(false);
              loadingRef.current = false;

              // Check for new messages in background
              const meta =
                await messageCacheService.getConversationMeta(conversationId);
              if (meta?.last_sync_time) {
                const token = await getToken();
                const lastSyncISO = new Date(meta.last_sync_time).toISOString();
                const url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=1&limit=${MESSAGES_PER_PAGE}&after=${encodeURIComponent(lastSyncISO)}`;

                const response = await fetch(url, {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                });

                if (response.ok) {
                  const result = await response.json();
                  const serverMessages = result.data.messages || [];

                  if (serverMessages.length > 0) {
                    console.log(
                      `📥 [FETCH] Found ${serverMessages.length} new messages`
                    );

                    const processedMessages = await Promise.all(
                      serverMessages.map((msg: Message) => processMessage(msg))
                    );

                    const messagesToCache = processedMessages.map((msg) =>
                      toCachedMessage(msg, conversationId)
                    );
                    await messageCacheService.saveMessages(messagesToCache);

                    const lastMsg =
                      processedMessages[processedMessages.length - 1];
                    await messageCacheService.updateConversationMeta({
                      conversation_id: conversationId,
                      last_sync_time: Date.now(),
                      total_cached:
                        (meta?.total_cached || 0) + processedMessages.length,
                      last_message_id: lastMsg._id,
                    });

                    const allCached = await messageCacheService.getMessages(
                      conversationId,
                      MESSAGES_PER_PAGE
                    );
                    const allMessages = allCached
                      .map(fromCachedMessage)
                      .reverse();
                    setMessages(allMessages);
                  }
                }
              }

              return; // ✅ STOP - using cache!
            }
          }

          setLoading(true);
        } else {
          setLoading(true);
        }

        // ✅ STEP 2: Fetch from server
        const token = await getToken();
        const meta =
          await messageCacheService.getConversationMeta(conversationId);

        let url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=${pageNum}&limit=${MESSAGES_PER_PAGE}`;

        if (meta && meta.last_sync_time > 0 && pageNum === 1 && !append) {
          const lastSyncISO = new Date(meta.last_sync_time).toISOString();
          url += `&after=${encodeURIComponent(lastSyncISO)}`;
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

        console.log(`📥 [FETCH] Got ${serverMessages.length} new messages`);

        if (
          serverMessages.length === 0 &&
          pageNum === 1 &&
          !append &&
          messages.length > 0
        ) {
          setHasMore(pagination?.hasNext || false);
          setLoading(false);
          loadingRef.current = false;
          return;
        }

        // ✅ STEP 3: Process messages
        console.log("🔐 [FETCH] Processing and decrypting messages...");

        const processedMessages = await Promise.all(
          serverMessages.map(async (msg: Message) => {
            // Process text content
            const processed = await processMessage(msg);

            // ✅ FORCE decrypt attachments if any
            if (processed.attachments && processed.attachments.length > 0) {
              const needsDecryption = processed.attachments.some(
                (att) => att.is_encrypted && !att.decryptedUri
              );

              if (needsDecryption) {
                console.log(
                  `🔐 [FETCH] Decrypting attachments for ${processed._id}...`
                );

                const decryptedAtts = await decryptAttachments(
                  processed.attachments,
                  processed.sender.clerkId,
                  processed._id
                );

                return {
                  ...processed,
                  attachments: decryptedAtts,
                };
              }
            }

            return processed;
          })
        );

        // ✅ STEP 4: Save to cache WITH VERIFICATION
        if (processedMessages.length > 0) {
          console.log("💾 [FETCH] Saving to cache...");

          const messagesToCache = processedMessages.map((msg) =>
            toCachedMessage(msg, conversationId)
          );

          await messageCacheService.saveMessages(messagesToCache);

          // ✅ VERIFY save immediately
          const verifyRead = await messageCacheService.getMessages(
            conversationId,
            MESSAGES_PER_PAGE
          );

          console.log(
            `✅ [VERIFY] Saved and verified: ${verifyRead.length} messages`
          );

          if (verifyRead.length === 0) {
            console.error("❌ [VERIFY] CACHE SAVE FAILED!");
          } else {
            const firstAtts = JSON.parse(
              verifyRead[0].attachments_json || "[]"
            );
            if (firstAtts.length > 0) {
              console.log(
                `📎 [VERIFY] First attachment URI exists: ${!!firstAtts[0]?.decryptedUri}`
              );
            }
          }

          const lastMsg = processedMessages[processedMessages.length - 1];
          await messageCacheService.updateConversationMeta({
            conversation_id: conversationId,
            last_sync_time: Date.now(),
            total_cached: processedMessages.length,
            last_message_id: lastMsg._id,
          });
        }

        // ✅ STEP 5: Update UI
        const allCached = await messageCacheService.getMessages(
          conversationId,
          MESSAGES_PER_PAGE
        );

        if (allCached.length > 0) {
          const allMessages = allCached.map(fromCachedMessage).reverse();
          setMessages(allMessages);
        }

        setHasMore(pagination?.hasNext || false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch messages";
        setError(errorMessage);
        console.error("❌ [FETCH] Error:", err);
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
      processMessage,
      messages.length,
    ]
  );

  /**
   * ✅ Retry decryption
   */
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

        fullyCachedMessageIds.current.delete(messageId);
        message.attachments.forEach((att) => {
          const attKey = `${messageId}_${att._id}`;
          decryptingFilesRef.current.delete(attKey);
          decryptedFilesRef.current.delete(attKey);
        });

        const processedMessage = await processMessage(message);

        setMessages((prev) =>
          prev.map((msg) => (msg._id === messageId ? processedMessage : msg))
        );

        if (conversationId) {
          const cached = toCachedMessage(processedMessage, conversationId);
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
    [messages, processMessage, conversationId]
  );

  // ✅ Create optimistic message
  const createOptimisticMessage = useCallback(
    (data: CreateMessageData | FormData, localUris?: string[]): Message => {
      const tempId = `temp_${Date.now()}_${Math.random()}`;

      let messageType: Message["type"] = "text";
      let content = "";
      let attachmentPreviews: MessageAttachment[] = [];
      let richMedia: RichMediaDTO | undefined;

      if (data instanceof FormData) {
        messageType = (data.get("type") as Message["type"]) || "text";
        content = String(data.get("content") || "");
      } else {
        messageType = data.type;
        content = String(data.content || "");
        richMedia = data.richMedia;
      }

      if (localUris && localUris.length > 0) {
        attachmentPreviews = localUris.map((uri, index) => {
          const isImage =
            uri.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
            messageType === "image";
          const isVideo =
            uri.toLowerCase().match(/\.(mp4|mov|avi|webm)$/i) ||
            messageType === "video";
          const isAudio =
            uri.toLowerCase().match(/\.(mp3|m4a|wav|aac)$/i) ||
            messageType === "audio";

          let fileType = "application/octet-stream";
          if (isImage) fileType = "image/jpeg";
          else if (isVideo) fileType = "video/mp4";
          else if (isAudio) fileType = "audio/m4a";

          return {
            _id: `temp_att_${Date.now()}_${index}`,
            file_name: `file_${index}`,
            file_type: fileType,
            file_size: 0,
            url: "",
            decryptedUri: uri,
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
        rich_media: richMedia,
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
        let localUris: string[] | undefined;
        let messageType: Message["type"] = "text";
        let messageContent = "";
        let richMedia: RichMediaDTO | undefined;
        let tempId: string | undefined;
        let isOptimistic = false;

        if (data instanceof FormData) {
          messageType = (data.get("type") as Message["type"]) || "text";
          messageContent = String(data.get("content") || "");
        } else {
          messageType = data.type;
          messageContent = String(data.content || "");
          localUris = data.localUris;
          richMedia = data.richMedia;
          tempId = data.tempId;
          isOptimistic = data.isOptimistic || false;
        }

        if (isOptimistic && tempId) {
          const optimisticMessage = createOptimisticMessage(data, localUris);
          optimisticMessage.tempId = tempId;
          setMessages((prev) => [...prev, optimisticMessage]);
          return optimisticMessage;
        }

        const optimisticMessage = tempId
          ? messages.find((m) => m.tempId === tempId)
          : createOptimisticMessage(data, localUris);

        if (!tempId && optimisticMessage) {
          setMessages((prev) => [...prev, optimisticMessage]);
        } else if (tempId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === tempId
                ? { ...m, status: "sending" as MessageStatus }
                : m
            )
          );
        }

        let requestBody: any;
        let contentType = "application/json";

        if (data instanceof FormData) {
          requestBody = data;
          contentType = "multipart/form-data";
        } else {
          requestBody = {
            type: data.type,
            conversationId,
          };

          if (data.type === "text" && data.content) {
            const token = await getToken();
            if (!token) {
              throw new Error("Authentication failed");
            }

            const conversationResponse = await fetch(
              `${API_BASE_URL}/api/conversations/${conversationId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (!conversationResponse.ok) {
              throw new Error("Failed to fetch conversation");
            }

            const convResult = await conversationResponse.json();
            const participants = convResult.data.participants || [];
            const recipientId = participants.find(
              (p: any) => p.clerkId !== user?.id
            )?.clerkId;

            if (!recipientId) {
              throw new Error("Recipient not found");
            }

            const encryptedResult = await encryptMessage(
              recipientId,
              data.content
            );

            requestBody.encryptedContent = encryptedResult.encryptedContent;
            requestBody.encryptionMetadata = encryptedResult.encryptionMetadata;
          }

          if ((data.type === "gif" || data.type === "sticker") && richMedia) {
            requestBody.richMedia = richMedia;
          }

          if (data.encryptedFiles && data.encryptedFiles.length > 0) {
            requestBody.encryptedFiles = data.encryptedFiles;
          }

          if (data.attachments && data.attachments.length > 0) {
            requestBody.attachments = data.attachments;
          }

          if (data.replyTo) {
            requestBody.replyTo = data.replyTo;
          }
        }

        const token = await getToken();
        if (!token) {
          throw new Error("Authentication failed");
        }

        const headers: any = {
          Authorization: `Bearer ${token}`,
        };

        if (contentType === "application/json") {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers,
            body:
              contentType === "application/json"
                ? JSON.stringify(requestBody)
                : requestBody,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) {
            throw new Error("Session expired");
          }
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to send message");
        }

        const serverMessage = result.data;

        setMessages((prev) => {
          const targetTempId = tempId || optimisticMessage?.tempId;

          const existsByRealId = prev.findIndex(
            (m) => m._id === serverMessage._id
          );
          if (existsByRealId !== -1) {
            return prev;
          }

          const index = prev.findIndex((m) => m.tempId === targetTempId);

          if (index !== -1) {
            const updated = [...prev];
            updated[index] = {
              ...serverMessage,
              content: messageContent,
              status: "sent" as MessageStatus,
              localUri: optimisticMessage?.localUri,
              attachments:
                serverMessage.attachments ||
                optimisticMessage?.attachments ||
                [],
            };

            if (conversationId) {
              const cached = toCachedMessage(updated[index], conversationId);
              messageCacheService.saveMessages([cached]);
            }

            return updated;
          } else {
            const alreadyExists = prev.some((m) => m._id === serverMessage._id);
            if (alreadyExists) {
              return prev;
            }

            if (conversationId) {
              const cached = toCachedMessage(serverMessage, conversationId);
              messageCacheService.saveMessages([cached]);
            }

            return [...prev, serverMessage];
          }
        });

        return serverMessage;
      } catch (error) {
        console.error("❌ Failed:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId &&
            (msg.status === "sending" || msg.status === "encrypting")
              ? { ...msg, status: "failed" as MessageStatus }
              : msg
          )
        );
        throw error;
      }
    },
    [
      conversationId,
      encryptionInitialized,
      getToken,
      API_BASE_URL,
      createOptimisticMessage,
      encryptMessage,
      user,
      messages,
    ]
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
    fullyCachedMessageIds.current.clear();
    decryptingFilesRef.current.clear();
    decryptedFilesRef.current.clear();
  }, []);

  const clearMessageCache = useCallback(async () => {
    if (conversationId) {
      await messageCacheService.clearConversation(conversationId);
      fullyCachedMessageIds.current.clear();
      decryptingFilesRef.current.clear();
      decryptedFilesRef.current.clear();
      console.log("✅ Cleared cache for conversation:", conversationId);
    }
  }, [conversationId]);

  const clearAllMessageCache = useCallback(async () => {
    await messageCacheService.clearAll();
    fullyCachedMessageIds.current.clear();
    decryptingFilesRef.current.clear();
    decryptedFilesRef.current.clear();
    console.log("✅ Cleared all message cache");
  }, []);

  // Socket handlers
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleNewMessage = async (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.message) return;

      let newMessage = data.message;

      const messageExists = messagesRef.current.some(
        (msg) => msg._id === newMessage._id
      );

      if (messageExists) {
        return;
      }

      if (newMessage.metadata?.isSystemMessage === true) {
        setMessages((prev) => [...prev, newMessage]);
        return;
      }

      if (data.sender_id === user?.id) {
        setMessages((prev) => {
          const optimisticIndex = prev.findIndex(
            (msg) =>
              msg.tempId &&
              (msg.status === "sending" || msg.status === "encrypting")
          );

          if (optimisticIndex !== -1) {
            const optimisticMsg = prev[optimisticIndex];
            const updated = [...prev];

            updated[optimisticIndex] = {
              ...newMessage,
              _id: newMessage._id,
              tempId: undefined,
              content: optimisticMsg.content,
              status: "sent" as MessageStatus,
              attachments: optimisticMsg.attachments,
            };

            return updated;
          }

          return prev;
        });
        return;
      }

      try {
        const processedMessage = await processMessage(newMessage);

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === processedMessage._id)) {
            return prev;
          }

          setSocketMessageCount((c) => c + 1);

          if (conversationId) {
            const cached = toCachedMessage(processedMessage, conversationId);
            messageCacheService.saveMessages([cached]);
          }

          return [...prev, processedMessage];
        });
      } catch (error) {
        console.error("❌ Failed to process message:", error);

        newMessage = {
          ...newMessage,
          content: newMessage.encrypted_content
            ? "[🔒 Decryption failed]"
            : newMessage.content,
          status: "failed" as MessageStatus,
        };

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === newMessage._id)) {
            return prev;
          }
          setSocketMessageCount((c) => c + 1);
          return [...prev, newMessage];
        });
      }
    };

    on("newMessage", handleNewMessage);

    return () => {
      off("newMessage", handleNewMessage);
    };
  }, [socket, conversationId, on, off, user?.id, processMessage]);

  // Join conversation
  useEffect(() => {
    if (!socket || !conversationId || !user?.id || !isConnected) {
      return;
    }

    socket.emit("joinConversation", {
      user_id: user.id,
      conversation_id: conversationId,
    });

    return () => {
      if (socket && socket.connected) {
        socket.emit("leaveConversation", {
          user_id: user.id,
          conversation_id: conversationId,
        });
      }
      setTypingUsers([]);
    };
  }, [socket, conversationId, user?.id, isConnected]);

  // Send typing indicator
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

  // Initial fetch
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
    editMessage: async () => ({}) as Message,
    deleteMessage: async () => {},
    addReaction: async () => {},
    removeReaction: async () => {},
    toggleReaction: async () => {},
    markAsRead: async () => {},
    markConversationAsRead: async () => {},
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
