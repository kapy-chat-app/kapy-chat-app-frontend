// hooks/message/useMessages.ts - FIXED WITH OPTIMISTIC MESSAGES
// ✅ Instant optimistic message UI update
// ✅ Non-blocking message sending
// ✅ Background sync always runs
// ✅ TYPING INDICATOR FIXED

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
  encryption_metadata?: any;
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
  recallMessage: (id: string) => Promise<void>;
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
  typingUsers: string[];
  sendTypingIndicator: (isTyping: boolean) => void;
  retryDecryption: (messageId: string) => Promise<void>;
  clearMessageCache: () => Promise<void>;
  clearAllMessageCache: () => Promise<void>;
}

const MESSAGES_PER_PAGE = 15;

const toCachedMessage = (
  msg: Message,
  conversationId: string
): CachedMessage => {
  console.log(`💾 [CACHE] Saving message ${msg._id}:`, {
    hasContent: !!msg.content,
    hasEncryptedContent: !!msg.encrypted_content,
    isRecalled: msg.metadata?.isRecalled,
    contentPreview: msg.content?.substring(0, 30),
  });

  // ✅ FIX: Extract avatar URL from object if needed
  const getSenderAvatar = (sender: MessageSender): string | undefined => {
    if (!sender?.avatar) return undefined;

    // If avatar is already a string URL, return it
    if (typeof sender.avatar === "string") {
      return sender.avatar;
    }

    // If avatar is an object with url property
    if (typeof sender.avatar === "object" && sender.avatar !== null) {
      const avatarObj = sender.avatar as any;
      return avatarObj.url || avatarObj.uri || undefined;
    }

    return undefined;
  };

  return {
    _id: msg._id,
    conversation_id: conversationId,
    sender_id: msg.sender.clerkId,
    sender_name: msg.sender.full_name,
    sender_avatar: getSenderAvatar(msg.sender), // ✅ USE HELPER
    content: msg.content || "",
    encrypted_content: msg.encrypted_content,
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
        decryptedUri: att.decryptedUri,
      }))
    ),
    reactions_json: JSON.stringify(msg.reactions),
    read_by_json: JSON.stringify(msg.read_by),
    reply_to_json: msg.reply_to
      ? JSON.stringify({
          _id: msg.reply_to._id,
          content: msg.reply_to.content,
          sender: {
            ...msg.reply_to.sender,
            avatar: getSenderAvatar(msg.reply_to.sender), // ✅ FIX reply_to avatar too
          },
          type: msg.reply_to.type,
        })
      : undefined,
    metadata_json: msg.metadata ? JSON.stringify(msg.metadata) : undefined,
    is_edited: msg.is_edited ? 1 : 0,
    created_at: new Date(msg.created_at).getTime(),
    updated_at: new Date(msg.updated_at).getTime(),
    rich_media_json: msg.rich_media
      ? JSON.stringify(msg.rich_media)
      : undefined,
  };
};

const fromCachedMessage = (cached: CachedMessage): Message => {
  const attachments = JSON.parse(cached.attachments_json || "[]");
  const replyTo = cached.reply_to_json
    ? JSON.parse(cached.reply_to_json)
    : undefined;
  const metadata = cached.metadata_json
    ? JSON.parse(cached.metadata_json)
    : undefined;

  console.log(`📦 [CACHE] Loading message ${cached._id}:`, {
    hasContent: !!cached.content,
    hasEncryptedContent: !!cached.encrypted_content,
    contentPreview: cached.content?.substring(0, 30),
  });

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
    encrypted_content: cached.encrypted_content,
    type: cached.type as Message["type"],
    attachments: attachments,
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

export const useMessages = (
  conversationId: string | null
): MessageHookReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [socketMessageCount, setSocketMessageCount] = useState(0);
  // const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const { socket, emit, on, off, isConnected } = useSocket();
  const { user } = useUser();
  const { getToken, userId } = useAuth();
  const {
    encryptMessage,
    decryptMessage,
    isInitialized: encryptionInitialized,
  } = useEncryption();
  const { getDecryptedUri } = useFileDecryption();
  const { getDecryptedUriChunked } = useChunkedFileDecryption();

  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const fullyProcessedIds = useRef<Set<string>>(new Set());
  const decryptingFiles = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);
  const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  // ✅ NEW: Typing debounce refs
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTypingRef = useRef(false);

  const normalizeTime = (d: any): number => {
    if (!d) return 0;
    if (typeof d === "number") return d;
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  };

  const sortMessagesStable = (arr: Message[]) => {
    return [...arr].sort((a, b) => {
      const ta = normalizeTime(a.created_at);
      const tb = normalizeTime(b.created_at);
      if (ta !== tb) return ta - tb;

      // tie-breaker: fallback to _id (stable)
      return (a._id || "").localeCompare(b._id || "");
    });
  };

  const mergeMessages = (prev: Message[], incoming: Message[]) => {
    const map = new Map<string, Message>();

    // keep latest version
    [...prev, ...incoming].forEach((m) => {
      if (!m?._id) return;
      const existing = map.get(m._id);

      // choose newer updated_at
      if (!existing) map.set(m._id, m);
      else {
        const eu = normalizeTime(existing.updated_at);
        const mu = normalizeTime(m.updated_at);

        map.set(m._id, mu >= eu ? { ...existing, ...m } : existing);
      }
    });

    return sortMessagesStable(Array.from(map.values()));
  };

  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
      // ✅ NEW: Cleanup typing debounce
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      isSyncingRef.current = false;
    };
  }, []);

  const isMessageFullyProcessed = useCallback((msg: Message): boolean => {
    if (fullyProcessedIds.current.has(msg._id)) {
      return true;
    }

    if (msg.metadata?.isSystemMessage) {
      fullyProcessedIds.current.add(msg._id);
      return true;
    }

    const hasDecryptedText = !msg.encrypted_content || !!msg.content;
    if (!hasDecryptedText) {
      return false;
    }

    if (msg.attachments && msg.attachments.length > 0) {
      const allAttachmentsDecrypted = msg.attachments.every((att) => {
        if (!att.is_encrypted) return true;
        return !!att.decryptedUri;
      });

      if (!allAttachmentsDecrypted) {
        return false;
      }
    }

    fullyProcessedIds.current.add(msg._id);
    return true;
  }, []);

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

          if (att.decryptedUri && decryptingFiles.current.has(attKey)) {
            return att;
          }

          if (!att.is_encrypted || !att.encryption_metadata) {
            return att;
          }

          if (decryptingFiles.current.has(attKey)) {
            const startTime = Date.now();
            while (decryptingFiles.current.has(attKey)) {
              if (Date.now() - startTime > 30000) break;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            return att;
          }

          try {
            decryptingFiles.current.add(attKey);

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

            if (messageId && conversationId) {
              await messageCacheService.updateAttachmentUri(
                messageId,
                att._id,
                decryptedUri
              );
            }

            decryptingFiles.current.delete(attKey);

            return {
              ...att,
              decryptedUri,
            };
          } catch (error) {
            console.error(`❌ Failed: ${att.file_name}`, error);
            decryptingFiles.current.delete(attKey);

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

  const processMessage = useCallback(
    async (msg: Message): Promise<Message> => {
      try {
        if (msg.metadata?.isRecalled === true) {
          return {
            ...msg,
            content: "",
            encrypted_content: undefined,
            attachments: [],
            rich_media: undefined,
            status: "sent" as MessageStatus,
          };
        }
        if (isMessageFullyProcessed(msg)) {
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
            if (att.decryptedUri && decryptingFiles.current.has(attKey)) {
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
          fullyProcessedIds.current.add(result._id);
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
      isMessageFullyProcessed,
      decryptMessage,
      decryptAttachments,
      encryptionInitialized,
    ]
  );

  const fetchMessages = useCallback(
    async (isLoadMore: boolean = false) => {
      if (!conversationId || loadingRef.current) return;

      try {
        loadingRef.current = true;
        setLoading(true);
        setError(null);

        console.log(
          `📥 [FETCH] Starting - isLoadMore: ${isLoadMore}, isInitial: ${isInitialLoadRef.current}`
        );

        if (!isLoadMore && isInitialLoadRef.current) {
          console.log("📦 [FETCH] Loading from cache first...");

          const cachedMessages = await messageCacheService.getMessages(
            conversationId,
            MESSAGES_PER_PAGE
          );

          if (cachedMessages.length > 0) {
            console.log(`✅ [FETCH] Found ${cachedMessages.length} in cache`);

            const msgs = cachedMessages.map(fromCachedMessage);

            const messagesNeedingDecryption = msgs.filter((msg) => {
              if (
                msg.type === "text" &&
                msg.encrypted_content &&
                !msg.content
              ) {
                return true;
              }
              if (
                msg.attachments?.some(
                  (att) => att.is_encrypted && !att.decryptedUri
                )
              ) {
                return true;
              }
              return false;
            });

            const needsDecryption = messagesNeedingDecryption.length > 0;

            console.log(`📊 [CACHE] Stats:`, {
              total: msgs.length,
              needsDecryption: messagesNeedingDecryption.length,
              alreadyDecrypted: msgs.length - messagesNeedingDecryption.length,
            });

            if (msgs.length > 0) {
              const sample = msgs[0];
              console.log(`📝 [CACHE] Sample message:`, {
                _id: sample._id,
                type: sample.type,
                hasContent: !!sample.content,
                hasEncryptedContent: !!sample.encrypted_content,
                contentPreview:
                  sample.content?.substring(0, 30) || "[NO CONTENT]",
              });
            }

            setMessages(sortMessagesStable(msgs));
            setLoading(false);
            loadingRef.current = false;
            isInitialLoadRef.current = false;

            console.log("✅ [FETCH] Messages displayed from cache INSTANTLY!");

            if (needsDecryption && encryptionInitialized) {
              console.log(
                `🔐 [FETCH] Decrypting ${messagesNeedingDecryption.length} messages in background...`
              );

              setTimeout(async () => {
                try {
                  const decryptedMessages = await Promise.all(
                    messagesNeedingDecryption.map(async (msg) => {
                      console.log(`🔐 [DECRYPT] Processing message ${msg._id}`);
                      const processed = await processMessage(msg);
                      console.log(`✅ [DECRYPT] Message ${msg._id}:`, {
                        hasContent: !!processed.content,
                        contentPreview: processed.content?.substring(0, 30),
                      });
                      return processed;
                    })
                  );

                  console.log("✅ [FETCH] Background decryption complete");

                  if (decryptedMessages.length > 0) {
                    const messagesToCache = decryptedMessages.map((msg) =>
                      toCachedMessage(msg, conversationId)
                    );

                    console.log(
                      `💾 [FETCH] Saving ${messagesToCache.length} decrypted messages to cache...`
                    );
                    await messageCacheService.saveMessages(messagesToCache);
                    console.log("✅ [FETCH] Decrypted messages saved to cache");
                  }

                  setMessages((prev) => {
                    const decryptedMap = new Map(
                      decryptedMessages.map((msg) => [msg._id, msg])
                    );

                    return prev.map((msg) => decryptedMap.get(msg._id) || msg);
                  });
                } catch (error) {
                  console.error(
                    "❌ [FETCH] Background decryption failed:",
                    error
                  );
                }
              }, 100);
            } else {
              console.log("✅ [FETCH] All cached messages already decrypted!");
            }

            // ✅ CRITICAL FIX: ALWAYS run background sync
            const meta =
              await messageCacheService.getConversationMeta(conversationId);

            if (meta && meta.last_sync_time > 0 && !isSyncingRef.current) {
              if (syncDebounceTimerRef.current) {
                clearTimeout(syncDebounceTimerRef.current);
              }

              syncDebounceTimerRef.current = setTimeout(async () => {
                if (isSyncingRef.current) return;

                isSyncingRef.current = true;

                try {
                  const token = await getToken();
                  const lastSyncISO = new Date(
                    meta.last_sync_time
                  ).toISOString();
                  const url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=1&limit=${MESSAGES_PER_PAGE}&after=${encodeURIComponent(lastSyncISO)}`;

                  console.log(
                    `🔄 [SYNC] Checking for new messages after ${lastSyncISO}`
                  );

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
                        `📥 [SYNC] Found ${serverMessages.length} NEW messages`
                      );

                      const processedMessages = await Promise.all(
                        serverMessages.map((msg: Message) =>
                          processMessage(msg)
                        )
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

                      setMessages((prev) => {
                        const existingIds = new Set(prev.map((m) => m._id));
                        const newMessages = processedMessages.filter(
                          (msg) => !existingIds.has(msg._id)
                        );

                        if (newMessages.length === 0) {
                          console.log("✅ [SYNC] No new messages (all exist)");
                          return prev;
                        }

                        console.log(
                          `✅ [SYNC] Adding ${newMessages.length} new messages`
                        );
                        return mergeMessages(prev, newMessages);
                      });
                    } else {
                      console.log("✅ [SYNC] No new messages");
                    }
                  }
                } catch (e) {
                  console.error("❌ [SYNC] Failed:", e);
                } finally {
                  isSyncingRef.current = false;
                  syncDebounceTimerRef.current = null;
                }
              }, 2000);
            }

            return;
          }
        }

        const token = await getToken();
        let url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=1&limit=${MESSAGES_PER_PAGE}`;

        if (isLoadMore && messages.length > 0) {
          const oldestMessage = messages[0];
          const beforeTimestamp = new Date(
            oldestMessage.created_at
          ).toISOString();

          console.log(
            `📜 [LOAD MORE] Loading messages BEFORE ${beforeTimestamp}`
          );

          url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?page=1&limit=${MESSAGES_PER_PAGE}&before=${encodeURIComponent(beforeTimestamp)}`;
        }

        console.log(`📡 [FETCH] Fetching from server...`);

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

        console.log(`📥 [FETCH] Got ${serverMessages.length} from server`);

        if (serverMessages.length === 0) {
          console.log(`✅ [FETCH] No more messages`);
          setHasMore(false);
          setLoading(false);
          loadingRef.current = false;
          return;
        }

        const processedMessages = await Promise.all(
          serverMessages.map(async (msg: Message) => {
            const processed = await processMessage(msg);

            if (processed.attachments?.length > 0) {
              const needsDecryption = processed.attachments.some(
                (att) => att.is_encrypted && !att.decryptedUri
              );

              if (needsDecryption) {
                const decryptedAtts = await decryptAttachments(
                  processed.attachments,
                  processed.sender.clerkId,
                  processed._id
                );

                return { ...processed, attachments: decryptedAtts };
              }
            }

            return processed;
          })
        );

        if (processedMessages.length > 0) {
          const messagesToCache = processedMessages.map((msg) =>
            toCachedMessage(msg, conversationId)
          );

          console.log(
            `💾 [FETCH] Saving ${messagesToCache.length} server messages to cache...`
          );
          await messageCacheService.saveMessages(messagesToCache);

          const currentMeta =
            await messageCacheService.getConversationMeta(conversationId);

          await messageCacheService.updateConversationMeta({
            conversation_id: conversationId,
            last_sync_time: currentMeta?.last_sync_time || Date.now(),
            total_cached:
              (currentMeta?.total_cached || 0) + processedMessages.length,
            last_message_id: currentMeta?.last_message_id,
          });
        }

        if (isLoadMore) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m._id));
            const newOlderMessages = processedMessages.filter(
              (msg) => !existingIds.has(msg._id)
            );

            if (newOlderMessages.length === 0) return prev;

            return mergeMessages(prev, newOlderMessages);
          });
        } else {
          setMessages(processedMessages);
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
        isInitialLoadRef.current = false;
      }
    },
    [
      conversationId,
      getToken,
      API_BASE_URL,
      processMessage,
      messages,
      isMessageFullyProcessed,
      decryptAttachments,
      encryptionInitialized,
    ]
  );

  const sendMessage = useCallback(
    async (data: CreateMessageData | FormData): Promise<Message> => {
      if (!conversationId) throw new Error("No conversation ID");

      try {
        const token = await getToken();
        if (!token) throw new Error("No auth token");

        let tempId: string;
        let content: string | undefined;
        let messageType: Message["type"];
        let bodyToSend: FormData | string;
        let isJson = false;

        if (data instanceof FormData) {
          console.log("📦 [SEND] Received FormData");
          bodyToSend = data;
          tempId =
            (data.get("tempId") as string) ||
            `temp-${Date.now()}-${Math.random()}`;
          content = data.get("content") as string;
          messageType = (data.get("type") as Message["type"]) || "text";
        } else {
          console.log("📦 [SEND] Received Object:", {
            type: data.type,
            hasContent: !!data.content,
            hasEncryptedContent: !!(data as any).encryptedContent,
            hasEncryptionMetadata: !!(data as any).encryptionMetadata,
            hasEncryptedFiles: !!(data as any).encryptedFiles,
            isOptimistic: !!(data as any).isOptimistic,
          });

          tempId = data.tempId || `temp-${Date.now()}-${Math.random()}`;
          content = data.content;
          messageType = data.type;

          if ((data as any).isOptimistic === true) {
            console.log(
              "🎯 [SEND] Creating optimistic message locally WITH ATTACHMENTS"
            );

            const localAttachments = (data as any).localAttachments || [];

            const optimisticMessage: Message = {
              _id: tempId,
              conversation: conversationId,
              sender: {
                _id: user?.id || "",
                clerkId: user?.id || "",
                full_name: user?.fullName || "",
                username: user?.username || "",
                avatar: user?.imageUrl,
              },
              content: data.content,
              type: data.type,

              attachments: localAttachments.map((att: any, index: number) => ({
                _id: `temp-att-${tempId}-${index}`,
                file_name: att.name || "unknown",
                file_type: att.mimeType || "application/octet-stream",
                file_size: att.size || 0,
                url: att.uri,
                is_encrypted: false,
                decryptedUri: att.uri,
              })),

              reactions: [],
              read_by: [],
              is_edited: false,
              created_at: new Date(),
              updated_at: new Date(),
              status: "sending",
              tempId: tempId,
              localUri: (data as any).localUris,
              reply_to: data.replyTo
                ? messages.find((m) => m._id === data.replyTo)
                : undefined,
            };

            setMessages((prev) => [...prev, optimisticMessage]);

            console.log(
              "✅ [SEND] Optimistic message with LOCAL ATTACHMENTS added to UI"
            );

            return optimisticMessage;
          }

          if ((data as any).encryptedContent) {
            console.log("🔐 [SEND] Has encryptedContent - will send as JSON");

            isJson = true;
            const jsonPayload: any = {
              content: data.content,
              encryptedContent: (data as any).encryptedContent,
              type: data.type,
            };

            if ((data as any).encryptionMetadata) {
              jsonPayload.encryptionMetadata = (data as any).encryptionMetadata;
            }

            if (data.replyTo) {
              jsonPayload.replyTo = data.replyTo;
            }

            bodyToSend = JSON.stringify(jsonPayload);

            console.log("📤 [SEND] JSON payload created:", {
              hasContent: !!jsonPayload.content,
              hasEncryptedContent: !!jsonPayload.encryptedContent,
              hasMetadata: !!jsonPayload.encryptionMetadata,
              type: jsonPayload.type,
              bodyLength: bodyToSend.length,
            });
          } else if (
            (data as any).encryptedFiles &&
            (data as any).encryptedFiles.length > 0
          ) {
            console.log("📦 [SEND] Has encryptedFiles - creating FormData");
            const formData = new FormData();
            if (data.content) formData.append("content", data.content);
            formData.append("type", data.type);
            if (data.replyTo) formData.append("replyTo", data.replyTo);
            formData.append(
              "encryptedFiles",
              JSON.stringify((data as any).encryptedFiles)
            );
            formData.append("tempId", tempId);
            bodyToSend = formData;
          } else {
            console.log("📦 [SEND] No encryption - creating FormData");
            const formData = new FormData();
            if (data.content) formData.append("content", data.content);
            formData.append("type", data.type);
            if (data.replyTo) formData.append("replyTo", data.replyTo);

            if (data.attachments && data.attachments.length > 0) {
              data.attachments.forEach((att) => {
                formData.append("attachments[]", att);
              });
            }

            // ❌ BUG: richMedia được thêm nhưng KHÔNG được stringify!
            if ((data as any).richMedia) {
              formData.append(
                "richMedia",
                JSON.stringify((data as any).richMedia)
              );
            }

            formData.append("tempId", tempId);
            bodyToSend = formData;
          }
        }

        console.log("📡 [SEND] Sending to server:", {
          isJson,
          type: messageType,
          hasContent: !!content,
          bodyType: typeof bodyToSend,
          isString: typeof bodyToSend === "string",
        });

        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              ...(isJson && { "Content-Type": "application/json" }),
            },
            body: bodyToSend,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ [SEND] Response not OK:", {
            status: response.status,
            body: errorText,
          });
          throw new Error(`Failed to send message: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to send message");
        }

        const serverMessage = result.data;
        console.log("✅ [SEND] Message sent successfully:", serverMessage._id);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === tempId
              ? { ...serverMessage, status: "sent" as MessageStatus }
              : msg
          )
        );

        return serverMessage;
      } catch (error: any) {
        console.error("❌ Send message failed:", error);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.status === "sending" && msg._id.startsWith("temp-")
              ? { ...msg, status: "failed" as MessageStatus }
              : msg
          )
        );

        throw error;
      }
    },
    [conversationId, getToken, user, API_BASE_URL, messages]
  );

  const editMessage = useCallback(
    async (id: string, newContent: string): Promise<Message> => {
      try {
        console.log(`📝 [EDIT] Starting edit for message ${id}`);

        const originalMessage = messagesRef.current.find((m) => m._id === id);

        if (!originalMessage) {
          throw new Error("Message not found");
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id
              ? {
                  ...msg,
                  content: newContent,
                  is_edited: true,
                  edited_at: new Date(),
                  status: "sending" as MessageStatus,
                }
              : msg
          )
        );

        console.log("✅ [EDIT] Optimistic update applied");

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
              action: "edit",
              content: newContent,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ [EDIT] Response not OK:", {
            status: response.status,
            body: errorText,
          });
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to update message");
        }

        const updatedMessage = result.data;

        console.log("✅ [EDIT] Server confirmed update");

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id
              ? {
                  ...updatedMessage,
                  content: newContent,
                  status: "sent" as MessageStatus,
                }
              : msg
          )
        );

        if (conversationId) {
          setTimeout(async () => {
            try {
              const cached = toCachedMessage(
                {
                  ...updatedMessage,
                  content: newContent,
                },
                conversationId
              );

              await messageCacheService.saveMessages([cached]);
              console.log(`💾 [EDIT] Cache updated for ${id}`);
            } catch (error) {
              console.error("❌ [EDIT] Cache update failed:", error);
            }
          }, 0);
        }

        return updatedMessage;
      } catch (error: any) {
        console.error("❌ [EDIT] Failed:", error);

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg._id === id) {
              const original = messagesRef.current.find((m) => m._id === id);
              return original
                ? { ...original, status: "failed" as MessageStatus }
                : msg;
            }
            return msg;
          })
        );

        throw error;
      }
    },
    [conversationId, getToken, API_BASE_URL]
  );

  const recallMessage = useCallback(
    async (id: string): Promise<void> => {
      try {
        console.log(`🔄 [RECALL] Starting recall for message ${id}`);
        console.log(`   Current user: ${userId}`);
        console.log(`   Conversation: ${conversationId}`);

        // ✅ 1) Optimistic update: mark recalled + STRIP content
        let recalledMessageToCache: Message | null = null;

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg._id !== id) return msg;

            const recalled: Message = {
              ...msg,

              // ✅ CRITICAL: never allow old content to show again
              content: "",
              encrypted_content: undefined,
              attachments: [], // optional: nếu recall phải ẩn luôn file
              rich_media: undefined,

              metadata: {
                ...msg.metadata,
                isRecalled: true,
                recalledAt: new Date(),
                recalledBy: userId,
              },
              status: "sending" as MessageStatus,
            };

            recalledMessageToCache = recalled;
            return recalled;
          })
        );

        console.log(`✅ [RECALL] Optimistic update applied (content stripped)`);

        // ✅ 2) Update cache immediately (IMPORTANT)
        if (conversationId && recalledMessageToCache) {
          setTimeout(async () => {
            try {
              await messageCacheService.saveMessages([
                toCachedMessage(recalledMessageToCache!, conversationId),
              ]);
              console.log(
                `💾 [RECALL] Cached recalled message optimistic: ${id}`
              );
            } catch (e) {
              console.error("❌ [RECALL] Cache optimistic recall failed:", e);
            }
          }, 0);
        }

        // ✅ 3) Call API recall
        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: "recall" }),
          }
        );

        console.log(`📡 [RECALL] API response status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to recall message");
        }

        console.log(`✅ [RECALL] Message recalled successfully on server`);

        // ✅ 4) Finalize UI status (optional but recommended)
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id
              ? {
                  ...msg,
                  status: "sent" as MessageStatus,
                  metadata: {
                    ...msg.metadata,
                    isRecalled: true,
                  },
                }
              : msg
          )
        );
      } catch (error) {
        console.error("❌ [RECALL] Failed:", error);

        // rollback: nếu fail thì bỏ recalled
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === id
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    isRecalled: false,
                  },
                  status: "failed" as MessageStatus,
                }
              : msg
          )
        );

        throw error;
      }
    },
    [conversationId, getToken, API_BASE_URL, userId]
  );

  const deleteMessage = useCallback(
    async (id: string, type: "only_me" | "both" = "both"): Promise<void> => {
      try {
        const token = await getToken();
        await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}?type=${type}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setMessages((prev) => prev.filter((msg) => msg._id !== id));
      } catch (error) {
        console.error("❌ Delete failed:", error);
        throw error;
      }
    },
    [conversationId, getToken, API_BASE_URL]
  );

  const addReaction = useCallback(
    async (id: string, reaction: string): Promise<void> => {
      if (!userId) return;

      try {
        console.log(`🚀 [REACTION] Optimistic add: ${reaction} to ${id}`);

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg._id !== id) return msg;

            const filteredReactions = msg.reactions.filter(
              (r) => r.user.clerkId !== userId
            );

            const newReaction: MessageReaction = {
              user: {
                _id: userId,
                clerkId: userId,
                full_name: user?.fullName || "You",
                username: user?.username || "you",
                avatar: user?.imageUrl,
              },
              type: reaction as any,
              created_at: new Date(),
            };

            return {
              ...msg,
              reactions: [...filteredReactions, newReaction],
            };
          })
        );

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
              toggle: true,
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data) {
            console.log(`✅ [REACTION] Server confirmed: ${id}`);

            setMessages((prev) =>
              prev.map((msg) =>
                msg._id === id
                  ? { ...msg, reactions: result.data.reactions }
                  : msg
              )
            );

            if (conversationId) {
              setTimeout(async () => {
                try {
                  const updatedMessage = messagesRef.current.find(
                    (m) => m._id === id
                  );

                  if (updatedMessage) {
                    const cached = toCachedMessage(
                      { ...updatedMessage, reactions: result.data.reactions },
                      conversationId
                    );

                    await messageCacheService.saveMessages([cached]);
                    console.log(`💾 [REACTION] Cached for ${id}`);
                  }
                } catch (error) {
                  console.error(`❌ [REACTION] Cache failed:`, error);
                }
              }, 0);
            }
          }
        } else {
          console.error(`❌ [REACTION] API failed, rolling back`);

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg._id !== id) return msg;

              return {
                ...msg,
                reactions: msg.reactions.filter(
                  (r) => r.user.clerkId !== userId
                ),
              };
            })
          );
        }
      } catch (error) {
        console.error("❌ Add reaction failed:", error);

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg._id !== id) return msg;

            return {
              ...msg,
              reactions: msg.reactions.filter((r) => r.user.clerkId !== userId),
            };
          })
        );
      }
    },
    [getToken, API_BASE_URL, conversationId, userId, user]
  );

  const removeReaction = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;

      try {
        console.log(`🚀 [REACTION] Optimistic remove from ${id}`);

        const originalMessage = messagesRef.current.find((m) => m._id === id);

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg._id !== id) return msg;

            return {
              ...msg,
              reactions: msg.reactions.filter((r) => r.user.clerkId !== userId),
            };
          })
        );

        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages/${id}?type=remove_reaction`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data) {
            console.log(`✅ [REACTION] Server confirmed removal: ${id}`);

            setMessages((prev) =>
              prev.map((msg) =>
                msg._id === id
                  ? { ...msg, reactions: result.data.reactions }
                  : msg
              )
            );

            if (conversationId) {
              setTimeout(async () => {
                try {
                  const updatedMessage = messagesRef.current.find(
                    (m) => m._id === id
                  );

                  if (updatedMessage) {
                    const cached = toCachedMessage(
                      { ...updatedMessage, reactions: result.data.reactions },
                      conversationId
                    );

                    await messageCacheService.saveMessages([cached]);
                    console.log(`💾 [REACTION] Removal cached for ${id}`);
                  }
                } catch (error) {
                  console.error(`❌ [REACTION] Cache failed:`, error);
                }
              }, 0);
            }
          }
        } else {
          console.error(`❌ [REACTION] API failed, rolling back`);

          if (originalMessage) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg._id === id
                  ? { ...msg, reactions: originalMessage.reactions }
                  : msg
              )
            );
          }
        }
      } catch (error) {
        console.error("❌ Remove reaction failed:", error);

        const originalMessage = messagesRef.current.find((m) => m._id === id);
        if (originalMessage) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === id
                ? { ...msg, reactions: originalMessage.reactions }
                : msg
            )
          );
        }
      }
    },
    [getToken, API_BASE_URL, conversationId, userId]
  );

  const toggleReaction = useCallback(
    async (id: string, reaction: string): Promise<void> => {
      const message = messages.find((m) => m._id === id);
      if (!message) return;

      const hasReaction = message.reactions.some(
        (r) => r.user.clerkId === userId && r.type === reaction
      );

      if (hasReaction) {
        await removeReaction(id);
      } else {
        await addReaction(id, reaction);
      }
    },
    [messages, userId, addReaction, removeReaction]
  );

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      try {
        const token = await getToken();

        await fetch(
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
      } catch (error) {
        console.error("❌ Mark as read failed:", error);
      }
    },
    [conversationId, getToken, API_BASE_URL]
  );

  const markConversationAsRead = useCallback(
    async (convId: string): Promise<void> => {
      try {
        const token = await getToken();

        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${convId}/read`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok && response.status === 404) {
          console.warn("⚠️ Conversation read endpoint not found, skipping...");
          return;
        }
      } catch (error) {
        console.error("❌ Mark conversation as read failed:", error);
      }
    },
    [getToken, API_BASE_URL]
  );

  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loadingRef.current) return;
    console.log("📜 [LOAD MORE] Loading older messages...");
    await fetchMessages(true);
  }, [hasMore, fetchMessages]);

  const refreshMessages = useCallback(async () => {
    isInitialLoadRef.current = true;
    await fetchMessages(false);
  }, [fetchMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSocketMessageCount(0);
    fullyProcessedIds.current.clear();
    decryptingFiles.current.clear();
    isInitialLoadRef.current = true;
  }, []);

  const clearMessageCache = useCallback(async () => {
    if (conversationId) {
      await messageCacheService.clearConversation(conversationId);
      fullyProcessedIds.current.clear();
      decryptingFiles.current.clear();
      console.log("✅ Cleared cache for conversation:", conversationId);
    }
  }, [conversationId]);

  const clearAllMessageCache = useCallback(async () => {
    await messageCacheService.clearAll();
    fullyProcessedIds.current.clear();
    decryptingFiles.current.clear();
    console.log("✅ Cleared all message cache");
  }, []);

  // ✅ FIXED: Typing indicator with debounce
  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!socket || !conversationId || !user || !emit) {
        console.warn("⌨️ [CLIENT] Cannot send typing:", {
          hasSocket: !!socket,
          hasConversationId: !!conversationId,
          hasUser: !!user,
          hasEmit: !!emit,
        });
        return;
      }

      if (!socket.connected) {
        console.warn("⌨️ [CLIENT] Socket not connected");
        return;
      }

      console.log(`⌨️ [CLIENT] Sending typing: ${isTyping}`);
      console.log("   Conversation:", conversationId);
      console.log("   User:", user.fullName || user.username);

      emit("sendTypingIndicator", {
        conversation_id: conversationId,
        user_id: user.id,
        user_name: user.fullName || user.username || "User",
        is_typing: isTyping,
      });

      isCurrentlyTypingRef.current = isTyping;

      // Auto-stop after 3 seconds
      if (isTyping) {
        if (typingDebounceRef.current) {
          clearTimeout(typingDebounceRef.current);
        }

        typingDebounceRef.current = setTimeout(() => {
          console.log("⌨️ [CLIENT] Auto-stopping (timeout)");
          emit("sendTypingIndicator", {
            conversation_id: conversationId,
            user_id: user.id,
            user_name: user.fullName || user.username || "User",
            is_typing: false,
          });
          isCurrentlyTypingRef.current = false;
        }, 3000);
      } else {
        if (typingDebounceRef.current) {
          clearTimeout(typingDebounceRef.current);
          typingDebounceRef.current = null;
        }
      }
    },
    [socket, conversationId, user, emit] // ✅ Include emit
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
        if (!message) throw new Error("Message not found");

        fullyProcessedIds.current.delete(messageId);
        message.attachments.forEach((att) => {
          const attKey = `${messageId}_${att._id}`;
          decryptingFiles.current.delete(attKey);
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

  // ✅ FIXED: Socket listener for typing with proper dependencies
  useEffect(() => {
    if (!socket || !conversationId || !on || !off) {
      console.log("⌨️ [useMessages] ❌ Missing dependencies:", {
        hasSocket: !!socket,
        hasConversationId: !!conversationId,
        hasOn: !!on,
        hasOff: !!off,
      });
      return;
    }

    console.log("✅ [useMessages] Setting up typing listener");
    console.log("   Conversation:", conversationId);
    console.log("   Socket ID:", socket.id);
    console.log("   User ID:", user?.id);

    const handleTyping = (data: any) => {
      console.log("⌨️ [CLIENT] ✅ RECEIVED userTyping event:", {
        conversation_id: data.conversation_id,
        user_id: data.user_id,
        user_name: data.user_name,
        is_typing: data.is_typing,
        timestamp: data.timestamp,
      });

      // Validate conversation
      if (data.conversation_id !== conversationId) {
        console.log("⌨️ [CLIENT] ❌ Wrong conversation, ignoring");
        return;
      }

      // Ignore own typing
      if (data.user_id === user?.id) {
        console.log("⌨️ [CLIENT] ❌ Own typing, ignoring");
        return;
      }

      console.log(`⌨️ [CLIENT] ✅ Processing typing from ${data.user_name}`);

      setTypingUsers((prev) => {
        console.log("⌨️ [CLIENT] Current typing users:", prev);

        if (data.is_typing) {
          // Add user if not already typing
          if (prev.includes(data.user_name)) {
            console.log(`⌨️ [CLIENT] ⚠️ ${data.user_name} already typing`);
            return prev;
          }

          console.log(`⌨️ [CLIENT] ➕ Adding ${data.user_name}`);
          const updated = [...prev, data.user_name];
          console.log("⌨️ [CLIENT] New typing users:", updated);
          return updated;
        } else {
          console.log(`⌨️ [CLIENT] ➖ Removing ${data.user_name}`);
          const updated = prev.filter((name) => name !== data.user_name);
          console.log("⌨️ [CLIENT] New typing users:", updated);
          return updated;
        }
      });
    };

    // ✅ Register listener with on() from useSocket
    console.log("✅ [useMessages] Registering userTyping listener");
    on("userTyping", handleTyping);

    return () => {
      console.log("🧹 [useMessages] Cleaning up typing listener");
      off("userTyping", handleTyping);

      // Send typing stop when unmounting
      if (isCurrentlyTypingRef.current && socket.connected) {
        console.log("⌨️ [useMessages] Sending typing stop on unmount");
        emit("sendTypingIndicator", {
          conversation_id: conversationId,
          user_id: user?.id,
          user_name: user?.fullName || user?.username || "User",
          is_typing: false,
        });
        isCurrentlyTypingRef.current = false;
      }
    };
  }, [
    socket,
    conversationId,
    on,
    off,
    emit,
    user?.id,
    user?.fullName,
    user?.username,
  ]); // ✅ REMOVED on, off, emit from dependencies

  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleNewMessage = async (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.message) return;

      const newMessage = data.message;

      const messageExists = messagesRef.current.some(
        (msg) => msg._id === newMessage._id
      );

      if (messageExists) {
        console.log(
          `⚠️ [SOCKET] Message ${newMessage._id} already exists, skipping`
        );
        return;
      }

      const extractAvatarUrl = (avatar: any): string | undefined => {
        if (!avatar) return undefined;
        if (typeof avatar === "string") return avatar;
        if (typeof avatar === "object" && avatar !== null) {
          return avatar.url || avatar.uri || undefined;
        }
        return undefined;
      };

      const normalizeAttachments = (
        attachments: any[]
      ): MessageAttachment[] => {
        if (!Array.isArray(attachments)) {
          console.warn("⚠️ attachments is not array:", attachments);
          return [];
        }

        return attachments
          .map((att, index) => {
            if (!att || typeof att !== "object") {
              console.warn(`⚠️ Invalid attachment at index ${index}:`, att);
              return null;
            }

            const normalized: MessageAttachment = {
              _id: att._id?.toString() || `temp-att-${index}`,
              file_name: att.file_name || "unknown_file",
              file_type: att.file_type || "application/octet-stream",
              file_size: Number(att.file_size) || 0,
              url: att.url || "",
              is_encrypted: Boolean(att.is_encrypted),
              encryption_metadata: att.encryption_metadata || null,
              decryptedUri: att.decryptedUri || undefined,
            };

            return normalized;
          })
          .filter(Boolean) as MessageAttachment[];
      };

      const normalizedMessage: Message = {
        _id: newMessage._id || "",
        conversation: newMessage.conversation || conversationId,

        sender: newMessage.sender
          ? {
              _id: newMessage.sender._id || "",
              clerkId: newMessage.sender.clerkId || "",
              full_name: newMessage.sender.full_name || "Unknown",
              username: newMessage.sender.username || "unknown",
              avatar: extractAvatarUrl(newMessage.sender.avatar),
            }
          : {
              _id: data.sender_id || "",
              clerkId: data.sender_id || "",
              full_name: data.sender_name || "Unknown",
              username: data.sender_username || "unknown",
              avatar: extractAvatarUrl(data.sender_avatar),
            },

        content: newMessage.content,
        encrypted_content: newMessage.encrypted_content,
        encryption_metadata: newMessage.encryption_metadata,
        type: newMessage.type || "text",
        attachments: normalizeAttachments(newMessage.attachments || []),
        reactions: Array.isArray(newMessage.reactions)
          ? newMessage.reactions
          : [],
        read_by: Array.isArray(newMessage.read_by) ? newMessage.read_by : [],
        metadata: newMessage.metadata || {},
        is_edited: newMessage.is_edited || false,
        edited_at: newMessage.edited_at
          ? new Date(newMessage.edited_at)
          : undefined,
        rich_media: newMessage.rich_media,
        created_at: new Date(newMessage.created_at || Date.now()),
        updated_at: new Date(newMessage.updated_at || Date.now()),

        reply_to: newMessage.reply_to
          ? {
              _id: newMessage.reply_to._id || "",
              conversation: newMessage.reply_to.conversation || conversationId,
              sender: newMessage.reply_to.sender
                ? {
                    _id: newMessage.reply_to.sender._id || "",
                    clerkId: newMessage.reply_to.sender.clerkId || "",
                    full_name:
                      newMessage.reply_to.sender.full_name || "Unknown",
                    username: newMessage.reply_to.sender.username || "unknown",
                    avatar: extractAvatarUrl(newMessage.reply_to.sender.avatar),
                  }
                : {
                    _id: "",
                    clerkId: "",
                    full_name: "Unknown",
                    username: "unknown",
                  },
              content: newMessage.reply_to.content,
              encrypted_content: newMessage.reply_to.encrypted_content,
              encryption_metadata: newMessage.reply_to.encryption_metadata,
              type: newMessage.reply_to.type || "text",
              attachments: normalizeAttachments(
                newMessage.reply_to.attachments || []
              ),
              reactions: [],
              read_by: [],
              is_edited: false,
              metadata: {},
              created_at: new Date(
                newMessage.reply_to.created_at || Date.now()
              ),
              updated_at: new Date(
                newMessage.reply_to.updated_at || Date.now()
              ),
              reply_to: undefined,
              status: "sent" as MessageStatus,
            }
          : undefined,

        status: "sent" as MessageStatus,
      };

      console.log("✅ [SOCKET] Normalized message:", {
        _id: normalizedMessage._id,
        type: normalizedMessage.type,
        attachmentCount: normalizedMessage.attachments.length,
      });

      if (normalizedMessage.metadata?.isSystemMessage === true) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === normalizedMessage._id)) return prev;
          return [...prev, normalizedMessage];
        });
        setSocketMessageCount((c) => c + 1);
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
              ...normalizedMessage,
              _id: normalizedMessage._id,
              tempId: undefined,
              content: optimisticMsg.content || normalizedMessage.content,
              status: "sent" as MessageStatus,
              attachments:
                optimisticMsg.attachments.length > 0
                  ? optimisticMsg.attachments
                  : normalizedMessage.attachments,
            };

            return updated;
          }

          if (prev.some((m) => m._id === normalizedMessage._id)) return prev;
          return prev;
        });
        return;
      }

      try {
        console.log(
          `🔐 [SOCKET] Processing message ${normalizedMessage._id} BEFORE adding to UI...`
        );

        const processedMessage = await processMessage(normalizedMessage);

        const hasEncryptedText =
          processedMessage.encrypted_content && !processedMessage.content;
        const hasEncryptedFiles = processedMessage.attachments.some(
          (att) => att.is_encrypted && !att.decryptedUri
        );

        if (hasEncryptedText || hasEncryptedFiles) {
          console.warn(
            `⚠️ [SOCKET] Message ${processedMessage._id} not fully decrypted yet:`,
            {
              hasEncryptedText,
              hasEncryptedFiles,
              encryptedFileCount: processedMessage.attachments.filter(
                (att) => att.is_encrypted && !att.decryptedUri
              ).length,
            }
          );

          return;
        }

        console.log(
          `✅ [SOCKET] Message ${processedMessage._id} FULLY processed, adding to UI`
        );

        setMessages((prev) => mergeMessages(prev, [processedMessage]));
      } catch (error) {
        console.error("❌ [SOCKET] Failed to process message:", error);

        console.error(
          "❌ [SOCKET] Message will not be displayed:",
          normalizedMessage._id
        );
      }
    };

    const handleReactionUpdate = async (data: any) => {
      console.log(`🎭 [SOCKET] Reaction update:`, data);

      if (data.message_id && data.reactions) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id
              ? { ...msg, reactions: data.reactions }
              : msg
          )
        );

        if (conversationId) {
          setTimeout(async () => {
            try {
              const updatedMessage = messagesRef.current.find(
                (m) => m._id === data.message_id
              );

              if (updatedMessage) {
                const cached = toCachedMessage(
                  { ...updatedMessage, reactions: data.reactions },
                  conversationId
                );

                await messageCacheService.saveMessages([cached]);
                console.log(
                  `💾 [SOCKET] Reaction cached for ${data.message_id}`
                );
              }
            } catch (error) {
              console.error(`❌ [SOCKET] Failed to cache reaction:`, error);
            }
          }, 0);
        }
      }
    };

    const handleReactionRemove = async (data: any) => {
      console.log(`🎭 [SOCKET] Reaction removed:`, data);

      if (data.message_id && data.reactions) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id
              ? { ...msg, reactions: data.reactions }
              : msg
          )
        );

        if (conversationId) {
          setTimeout(async () => {
            try {
              const updatedMessage = messagesRef.current.find(
                (m) => m._id === data.message_id
              );

              if (updatedMessage) {
                const cached = toCachedMessage(
                  { ...updatedMessage, reactions: data.reactions },
                  conversationId
                );

                await messageCacheService.saveMessages([cached]);
                console.log(
                  `💾 [SOCKET] Reaction removal cached for ${data.message_id}`
                );
              }
            } catch (error) {
              console.error(
                `❌ [SOCKET] Failed to cache reaction removal:`,
                error
              );
            }
          }, 0);
        }
      }
    };

    on("newMessage", handleNewMessage);
    on("newReaction", handleReactionUpdate);
    on("deleteReaction", handleReactionRemove);
    return () => {
      off("newMessage", handleNewMessage);
      off("newReaction", handleReactionUpdate);
      off("deleteReaction", handleReactionRemove);
    };
  }, [socket, conversationId, on, off, user?.id, processMessage]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleUpdateMessage = async (data: any) => {
      console.log("📝 [SOCKET] Received updateMessage:", data);

      if (data.conversation_id !== conversationId) {
        console.log("⏭️ [SOCKET] Different conversation, skipping");
        return;
      }

      if (!data.message) {
        console.warn("⚠️ [SOCKET] Missing message data");
        return;
      }

      if (data.user_id === user?.id) {
        console.log("✅ [SOCKET] Own update, already applied");
        return;
      }

      try {
        const updatedMessage = data.message;

        let processedMessage = updatedMessage;

        if (
          updatedMessage.encrypted_content &&
          !updatedMessage.content &&
          encryptionInitialized
        ) {
          console.log(
            `🔐 [SOCKET] Decrypting edited message ${updatedMessage._id}`
          );

          const decryptedContent = await decryptMessage(
            updatedMessage.sender.clerkId,
            updatedMessage.encrypted_content
          );

          processedMessage = {
            ...updatedMessage,
            content: decryptedContent,
          };

          console.log("✅ [SOCKET] Message decrypted");
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === processedMessage._id
              ? {
                  ...processedMessage,
                  is_edited: true,
                  edited_at: new Date(data.edited_at),
                  status: "sent" as MessageStatus,
                }
              : msg
          )
        );

        console.log(
          `✅ [SOCKET] Message ${processedMessage._id} updated in UI`
        );

        if (conversationId) {
          setTimeout(async () => {
            try {
              const cached = toCachedMessage(processedMessage, conversationId);
              await messageCacheService.saveMessages([cached]);
              console.log(
                `💾 [SOCKET] Cache updated for ${processedMessage._id}`
              );
            } catch (error) {
              console.error("❌ [SOCKET] Cache update failed:", error);
            }
          }, 0);
        }
      } catch (error) {
        console.error("❌ [SOCKET] Failed to process updateMessage:", error);
      }
    };

    on("updateMessage", handleUpdateMessage);

    return () => {
      off("updateMessage", handleUpdateMessage);
    };
  }, [
    socket,
    conversationId,
    user?.id,
    on,
    off,
    decryptMessage,
    encryptionInitialized,
  ]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleRecallMessage = async (data: any) => {
      console.log("🔄 [SOCKET] Received recallMessage:", {
        message_id: data.message_id,
        conversation_id: data.conversation_id,
        recalled_by: data.recalled_by,
        current_conversation: conversationId,
      });

      if (data.conversation_id !== conversationId) {
        console.log("⏭️ [SOCKET] Different conversation, skipping recall");
        return;
      }

      const messageExists = messagesRef.current.some(
        (m) => m._id === data.message_id
      );

      if (!messageExists) {
        console.warn(
          `⚠️ [SOCKET] Message ${data.message_id} not found in local state`
        );
        return;
      }

      console.log(`✅ [SOCKET] Applying recall to message ${data.message_id}`);

      // ✅ IMPORTANT: do NOT cache stale version from messagesRef
      // We build recalled version inside setMessages and cache exactly that.
      let recalledMessageToCache: Message | null = null;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id !== data.message_id) return msg;

          const recalled: Message = {
            ...msg,

            // ✅ CRITICAL: strip sensitive content so it can NEVER reappear from cache/server
            content: "",
            encrypted_content: undefined,
            attachments: [], // optional: if your recall should hide files too
            rich_media: undefined,

            metadata: {
              ...msg.metadata,
              isRecalled: true,
              recalledAt: new Date(data.recalled_at || Date.now()),
              recalledBy: data.recalled_by,
            },
            status: "sent" as MessageStatus,
          };

          recalledMessageToCache = recalled;

          console.log(
            `🔄 [SOCKET] Message ${msg._id} recalled -> stripped content`
          );
          return recalled;
        })
      );

      // ✅ Cache recalled version (NOT stale)
      if (conversationId) {
        setTimeout(async () => {
          try {
            if (!recalledMessageToCache) return;
            const cached = toCachedMessage(
              recalledMessageToCache,
              conversationId
            );
            await messageCacheService.saveMessages([cached]);
            console.log(
              `💾 [SOCKET] Recalled message cached: ${data.message_id}`
            );
          } catch (error) {
            console.error(
              "❌ [SOCKET] Failed to cache recalled message:",
              error
            );
          }
        }, 0);
      }
    };

    console.log("✅ [useMessages] Setting up recallMessage listener");
    on("recallMessage", handleRecallMessage);

    return () => {
      console.log("🧹 [useMessages] Cleaning up recallMessage listener");
      off("recallMessage", handleRecallMessage);
    };
  }, [socket, conversationId, on, off]);

  useEffect(() => {
    if (conversationId && encryptionInitialized) {
      isInitialLoadRef.current = true;
      isSyncingRef.current = false;
      fullyProcessedIds.current.clear();
      decryptingFiles.current.clear();
      setMessages([]);
      fetchMessages(false);
    }
  }, [conversationId, encryptionInitialized]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    editMessage,
    recallMessage,
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
