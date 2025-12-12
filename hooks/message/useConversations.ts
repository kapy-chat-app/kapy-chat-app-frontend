// hooks/message/useConversations.ts - FINAL COMPLETE FIX
import { conversationCacheService } from "@/lib/cache/ConversationCacheService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEncryption } from "./useEncryption";
import { useSocket } from "./useSocket";

export interface ConversationParticipant {
  _id: string;
  clerkId: string;
  full_name: string;
  username: string;
  avatar?: string;
  is_online: boolean;
  last_seen?: Date;
}

export interface ConversationMessage {
  _id: string;
  content?: string;
  encrypted_content?: string;
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "voice_note"
    | "location";
  sender: ConversationParticipant;
  created_at: Date;
}

export interface Conversation {
  _id: string;
  type: "private" | "group";
  participants: ConversationParticipant[];
  name?: string;
  description?: string;
  avatar?: string;
  last_message?: ConversationMessage;
  last_activity: Date;
  is_archived: boolean;
  is_pinned: boolean;
  is_muted: boolean;
  unreadCount: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConversationData {
  type: "private" | "group";
  participantIds: string[];
  name?: string;
  description?: string;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  createConversation: (data: CreateConversationData) => Promise<Conversation>;
  updateConversation: (id: string, data: any) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  getConversationById: (id: string) => Promise<Conversation | null>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const useConversations = (): UseConversationsReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, on, off } = useSocket();
  const { getToken, userId } = useAuth();
  const { decryptMessage, isInitialized: encryptionReady } = useEncryption();

  const getTokenRef = useRef(getToken);
  const userIdRef = useRef(userId);
  const isFetchingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);
  const cachedDataRef = useRef<Conversation[]>([]);
  const isComponentMountedRef = useRef(true);

  useEffect(() => {
    getTokenRef.current = getToken;
    userIdRef.current = userId;
  }, [getToken, userId]);

  // Track component lifecycle
  useEffect(() => {
    isComponentMountedRef.current = true;
    console.log("✅ useConversations mounted");
    
    return () => {
      isComponentMountedRef.current = false;
      isFetchingRef.current = false;
      hasInitialLoadRef.current = false;
      console.log("❌ useConversations unmounted");
    };
  }, []);

  // Load from cache
  const loadFromCache = useCallback(async () => {
    try {
      console.log("📦 Loading conversations from cache...");
      const cached = await conversationCacheService.getConversations();

      if (cached.length > 0) {
        const parsed = cached.map((conv) => ({
          _id: conv._id,
          type: conv.type as "private" | "group",
          name: conv.name,
          description: conv.description,
          avatar: conv.avatar,
          participants: JSON.parse(conv.participants_json),
          last_message: conv.last_message_json
            ? JSON.parse(conv.last_message_json)
            : undefined,
          last_activity: new Date(conv.last_activity),
          is_pinned: conv.is_pinned === 1,
          is_archived: conv.is_archived === 1,
          is_muted: false,
          unreadCount: conv.unreadCount,
          created_at: new Date(conv.created_at),
          updated_at: new Date(conv.updated_at),
        }));

        // Check if messages need decryption
        const needsDecryption = parsed.some(conv => {
          const msg = conv.last_message;
          return msg && msg.encrypted_content && !msg.content;
        });

        if (needsDecryption && encryptionReady) {
          console.log("🔐 Decrypting cached conversations before display...");
          const decrypted = await decryptLastMessages(parsed);
          
          if (isComponentMountedRef.current) {
            setConversations(decrypted);
            console.log(`✅ Loaded ${decrypted.length} decrypted conversations from cache`);
          }
          return true;
        }

        // No decryption needed or encryption not ready yet
        cachedDataRef.current = parsed;
        
        if (isComponentMountedRef.current) {
          setConversations(parsed);
          console.log(`✅ Loaded ${parsed.length} conversations from cache`);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Failed to load from cache:", error);
      return false;
    }
  }, [encryptionReady]);

  // Decrypt last messages
  const decryptLastMessages = useCallback(
    async (convs: Conversation[]) => {
      if (!encryptionReady) {
        console.log("⚠️ Encryption not ready, cannot decrypt");
        return convs;
      }

      console.log(`🔐 Decrypting ${convs.length} conversation previews...`);

      const decryptPromises = convs.map(async (conv) => {
        const lastMessage = conv.last_message;
        
        if (!lastMessage) return conv;
        
        const normalizedMessage = {
          ...lastMessage,
          type: (lastMessage as any).type || (lastMessage as any).message_type || 'text',
        };
        
        // If already has valid content
        if (normalizedMessage.content && 
            normalizedMessage.content !== "[🔒 Encrypted]" &&
            normalizedMessage.content !== "🔒 Encrypted message" &&
            normalizedMessage.content !== "null") {
          console.log(`✅ Message ${normalizedMessage._id.substring(0, 8)} already decrypted`);
          return { ...conv, last_message: normalizedMessage };
        }
        
        if (!normalizedMessage.encrypted_content) {
          console.log(`📝 Message ${normalizedMessage._id.substring(0, 8)} is NOT encrypted`);
          return { ...conv, last_message: normalizedMessage };
        }

        const messageId = normalizedMessage._id;

        // Check decryption cache
        const cached = await conversationCacheService.getDecryptedPreview(messageId);
        if (cached) {
          console.log(`📦 Using cached preview for ${messageId.substring(0, 8)}: "${cached.substring(0, 20)}..."`);
          return {
            ...conv,
            last_message: { ...normalizedMessage, content: cached },
          };
        }

        // Decrypt
        try {
          const senderId = normalizedMessage.sender?.clerkId;
          if (!senderId) {
            console.warn(`⚠️ No sender for message ${messageId}`);
            return {
              ...conv,
              last_message: { ...normalizedMessage, content: "[🔒 No sender info]" },
            };
          }

          console.log(`🔓 Decrypting message ${messageId.substring(0, 8)}...`);
          const decrypted = await decryptMessage(senderId, normalizedMessage.encrypted_content);

          await conversationCacheService.saveDecryptedPreview(messageId, decrypted);
          console.log(`✅ Decrypted: "${decrypted.substring(0, 30)}..."`);

          return {
            ...conv,
            last_message: { ...normalizedMessage, content: decrypted },
          };
        } catch (error) {
          console.error(`❌ Failed to decrypt ${messageId}:`, error);
          return {
            ...conv,
            last_message: { ...normalizedMessage, content: "[🔒 Decryption failed]" },
          };
        }
      });

      const results = await Promise.all(decryptPromises);
      console.log("✅ Batch decryption complete");
      return results;
    },
    [encryptionReady, decryptMessage]
  );

  // Auto-decrypt when encryption ready
  const decryptCachedDataEffect = useCallback(async () => {
    if (!encryptionReady || cachedDataRef.current.length === 0) return;
    if (!isComponentMountedRef.current) return;
    
    console.log("🔐 Encryption ready! Decrypting cached conversations...");
    
    try {
      const decrypted = await decryptLastMessages(cachedDataRef.current);
      
      if (isComponentMountedRef.current) {
        setConversations(decrypted);
        console.log("✅ Cached conversations decrypted successfully");
      }
      
      cachedDataRef.current = [];
    } catch (error) {
      console.error("❌ Failed to decrypt cached conversations:", error);
    }
  }, [encryptionReady, decryptLastMessages]);

  useEffect(() => {
    decryptCachedDataEffect();
  }, [encryptionReady]);

  // Network fetch - ALWAYS DECRYPT BEFORE SAVING
  const fetchFromNetwork = useCallback(async () => {
    try {
      console.log("🌐 Fetching conversations from network...");
      const token = await getTokenRef.current();

      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch conversations");
      }

      let fetchedConvs = result.data.conversations || [];
      console.log(`✅ Fetched ${fetchedConvs.length} conversations from network`);

      // ✅ CRITICAL: Wait for encryption if not ready
      if (!encryptionReady) {
        console.log("⏳ Waiting for encryption to initialize...");
        
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds
        
        while (!encryptionReady && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!encryptionReady) {
          console.log("⚠️ Encryption still not ready, saving without decryption");
          await saveToCache(fetchedConvs);
          return;
        }
      }

      // Decrypt before setting state AND saving
      console.log("🔐 Encryption ready, decrypting fresh data...");
      fetchedConvs = await decryptLastMessages(fetchedConvs);
      
      if (isComponentMountedRef.current) {
        console.log("✅ Setting conversations to state");
        setConversations(fetchedConvs);
      }
      
      cachedDataRef.current = [];

      // Save DECRYPTED data to cache
      await saveToCache(fetchedConvs);
    } catch (err) {
      console.error("Network fetch error:", err);
      throw err;
    }
  }, [encryptionReady, decryptLastMessages]);

  // Save to cache
  const saveToCache = useCallback(async (convs: Conversation[]) => {
    try {
      console.log("💾 Saving conversations to cache...");
      
      // Log what we're saving
      if (convs.length > 0 && convs[0].last_message) {
        console.log("📄 Saving last_message:", {
          has_content: !!convs[0].last_message.content,
          content_preview: convs[0].last_message.content?.substring(0, 30),
          has_encrypted: !!convs[0].last_message.encrypted_content,
        });
      }
      
      const toCache = convs.map((conv) => ({
        _id: conv._id,
        type: conv.type,
        name: conv.name,
        description: conv.description,
        avatar: conv.avatar,
        participants_json: JSON.stringify(conv.participants),
        last_message_json: conv.last_message
          ? JSON.stringify(conv.last_message)
          : null,
        last_activity: new Date(conv.last_activity).getTime(),
        is_pinned: conv.is_pinned ? 1 : 0,
        is_archived: conv.is_archived ? 1 : 0,
        unreadCount: conv.unreadCount || 0,
        created_at: new Date(conv.created_at).getTime(),
        updated_at: new Date(conv.updated_at).getTime(),
      }));

      await conversationCacheService.saveConversations(toCache);
      console.log("✅ Saved conversations to cache");
    } catch (error) {
      console.error("Failed to save conversations to cache:", error);
    }
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(
    async (useCache = true) => {
      if (isFetchingRef.current) {
        console.log("⏳ Fetch already in progress, skipping...");
        return;
      }

      if (hasInitialLoadRef.current && useCache) {
        console.log("⏭️ Already loaded, skipping...");
        return;
      }

      try {
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        // Load cache first
        if (useCache && !hasInitialLoadRef.current) {
          const hasCache = await loadFromCache();
          if (hasCache) {
            console.log("📦 Cache loaded successfully");
            setLoading(false);
            hasInitialLoadRef.current = true;
            
            // Fetch network in background
            fetchFromNetwork().catch(err => {
              console.error("Background network fetch failed:", err);
            });
            
            return;
          }
        }

        // No cache, fetch from network
        await fetchFromNetwork();
        hasInitialLoadRef.current = true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch conversations";
        setError(errorMessage);
        console.error("Error fetching conversations:", err);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [loadFromCache, fetchFromNetwork]
  );

  const createConversation = useCallback(
    async (data: CreateConversationData): Promise<Conversation> => {
      try {
        setError(null);
        const token = await getTokenRef.current();
        const response = await fetch(`${API_BASE_URL}/api/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to create conversation");
        }

        const newConversation = result.data;
        setConversations((prev) => [newConversation, ...prev]);

        await saveToCache([newConversation]);

        return newConversation;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create conversation";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [saveToCache]
  );

  const updateConversation = useCallback(
    async (id: string, data: any): Promise<Conversation> => {
      try {
        setError(null);
        const token = await getTokenRef.current();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          }
        );

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to update conversation");
        }

        const updatedConversation = result.data;
        setConversations((prev) =>
          prev.map((conv) => (conv._id === id ? updatedConversation : conv))
        );

        await conversationCacheService.updateConversation(id, {
          ...data,
          updated_at: Date.now(),
        });

        return updatedConversation;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update conversation";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    []
  );

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      const token = await getTokenRef.current();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to delete conversation");
      }

      setConversations((prev) => prev.filter((conv) => conv._id !== id));

      await conversationCacheService.deleteConversation(id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete conversation";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getConversationById = useCallback(
    async (id: string): Promise<Conversation | null> => {
      try {
        setError(null);
        const token = await getTokenRef.current();
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to get conversation");
        }

        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get conversation";
        setError(errorMessage);
        return null;
      }
    },
    []
  );

  // Socket handlers
  useEffect(() => {
    if (!socket) return;

    if (!hasInitialLoadRef.current) {
      console.log("✅ Setting up conversation socket listeners");
    }

    const handleNewConversation = async (data: any) => {
  console.log("🆕 New conversation received:", data);

  // ✅ CRITICAL: Format conversation data properly
  const newConversation: Conversation = {
    _id: data.conversation_id,
    type: data.type,
    name: data.name,
    description: data.description,
    avatar: data.avatar,
    participants: data.participants || [],
    last_message: undefined, // No messages yet
    last_activity: new Date(data.last_activity || data.created_at),
    is_archived: data.is_archived || false,
    is_pinned: data.is_pinned || false,
    is_muted: false,
    unreadCount: data.unreadCount || 0,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.created_at),
  };

  setConversations((prev) => {
    // Check if conversation already exists
    const exists = prev.some((conv) => conv._id === data.conversation_id);
    
    if (exists) {
      console.log("⚠️ Conversation already exists, skipping");
      return prev;
    }

    console.log("✅ Adding new conversation to list");
    
    // Save to cache
    saveToCache([newConversation]).catch(err => 
      console.error("Failed to cache new conversation:", err)
    );

    // Add to beginning of list
    return [newConversation, ...prev];
  });
};

    const handleConversationUpdated = (data: any) => {
      console.log("📝 Conversation updated:", data.conversation_id);

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv._id === data.conversation_id) {
            const updated = {
              ...conv,
              ...data.updates,
              updated_at: new Date(),
            };
            conversationCacheService.updateConversation(data.conversation_id, {
              ...data.updates,
              updated_at: Date.now(),
            });
            return updated;
          }
          return conv;
        })
      );
    };

    const handleConversationDeleted = (data: any) => {
      console.log("🗑️ Conversation deleted:", data.conversation_id);

      setConversations((prev) =>
        prev.filter((conv) => conv._id !== data.conversation_id)
      );

      conversationCacheService.deleteConversation(data.conversation_id);
    };

    const handleNewMessage = async (data: any) => {
      if (!data.conversation_id) {
        console.log("⚠️ newMessage event missing conversation_id:", data);
        return;
      }

      console.log("💬 NEW MESSAGE EVENT:", {
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        currentUserId: userIdRef.current,
        hasEncryptedContent: !!data.encrypted_content,
      });

      setConversations((prev) => {
        const conversationIndex = prev.findIndex(
          (c) => c._id === data.conversation_id
        );

        if (conversationIndex === -1) {
          console.log("⚠️ Conversation not found in list");
          return prev;
        }

        const conversation = prev[conversationIndex];

        let lastMessageContent = data.message_content || "";

        const newLastMessage: ConversationMessage = {
          _id: data.message_id,
          content: lastMessageContent,
          encrypted_content: data.encrypted_content,
          type: data.message_type || "text",
          sender: {
            _id: "",
            clerkId: data.sender_id,
            full_name: data.sender_name || "Unknown",
            username: data.sender_username || "unknown",
            avatar: data.sender_avatar,
            is_online: false,
          },
          created_at: new Date(),
        };

        if (data.encrypted_content && encryptionReady) {
          (async () => {
            try {
              const decrypted = await decryptMessage(
                data.sender_id,
                data.encrypted_content
              );
              await conversationCacheService.saveDecryptedPreview(
                data.message_id,
                decrypted
              );

              setConversations((current) =>
                current.map((c) => {
                  if (
                    c._id === data.conversation_id &&
                    c.last_message?._id === data.message_id
                  ) {
                    const updatedMessage: ConversationMessage = {
                      ...c.last_message,
                      content: decrypted,
                    };
                    return {
                      ...c,
                      last_message: updatedMessage,
                    };
                  }
                  return c;
                })
              );
            } catch (err) {
              console.error("Failed to decrypt new message:", err);
            }
          })();

          newLastMessage.content = "🔒 Encrypted message";
        }

        const updatedConv: Conversation = {
          ...conversation,
          last_message: newLastMessage,
          last_activity: new Date(),
          unreadCount:
            data.sender_id !== userIdRef.current
              ? (conversation.unreadCount || 0) + 1
              : conversation.unreadCount,
        };

        conversationCacheService
          .updateConversation(data.conversation_id, {
            last_message_json: JSON.stringify(updatedConv.last_message),
            last_activity: updatedConv.last_activity.getTime(),
            unreadCount: updatedConv.unreadCount,
            updated_at: Date.now(),
          })
          .catch((err) => console.error("Failed to update cache:", err));

        const newConversations = [...prev];
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(updatedConv);

        return newConversations;
      });
    };

    const handleMessageRead = (data: any) => {
      console.log("📖 Message read:", data);

      if (data.user_id === userIdRef.current && data.conversation_id) {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv._id === data.conversation_id && conv.unreadCount > 0) {
              const newCount = Math.max(0, conv.unreadCount - 1);

              conversationCacheService.updateConversation(
                data.conversation_id,
                {
                  unreadCount: newCount,
                }
              );

              return { ...conv, unreadCount: newCount };
            }
            return conv;
          })
        );
      }
    };

    const handleConversationMarkedAsRead = (data: any) => {
      console.log("📖 Conversation marked as read:", data);

      if (data.read_by === userIdRef.current) {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv._id === data.conversation_id) {
              conversationCacheService.updateConversation(
                data.conversation_id,
                {
                  unreadCount: 0,
                }
              );

              return { ...conv, unreadCount: 0 };
            }
            return conv;
          })
        );
      }
    };

    on("newConversation", handleNewConversation);
    on("conversationUpdated", handleConversationUpdated);
    on("conversationDeleted", handleConversationDeleted);
    on("newMessage", handleNewMessage);
    on("messageRead", handleMessageRead);
    on("conversationMarkedAsRead", handleConversationMarkedAsRead);

    return () => {
      off("newConversation", handleNewConversation);
      off("conversationUpdated", handleConversationUpdated);
      off("conversationDeleted", handleConversationDeleted);
      off("newMessage", handleNewMessage);
      off("messageRead", handleMessageRead);
      off("conversationMarkedAsRead", handleConversationMarkedAsRead);
    };
  }, [socket, on, off, encryptionReady, decryptMessage, saveToCache]);

  // Load only ONCE on mount
  useEffect(() => {
    console.log("🔍 Mount check - hasInitialLoadRef:", hasInitialLoadRef.current);
    
    if (!hasInitialLoadRef.current) {
      console.log("🚀 Initial load triggered");
      fetchConversations();
    }
  }, []);

  return {
    conversations,
    loading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    refreshConversations: () => {
      hasInitialLoadRef.current = false;
      return fetchConversations(false);
    },
    getConversationById,
  };
};