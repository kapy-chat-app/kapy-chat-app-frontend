// hooks/message/useGroupHistory.ts
import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useSocket } from "./useSocket";

export interface SystemMessage {
  _id: string;
  conversation: string;
  sender: {
    _id: string;
    clerkId: string;
    full_name: string;
    username: string;
    avatar?: string;
  };
  content: string;
  type: string;
  metadata: {
    isSystemMessage: boolean;
    action: string;
    [key: string]: any;
  };
  created_at: Date | string;
  updated_at: Date | string;
}

interface UseGroupHistoryReturn {
  systemMessages: SystemMessage[];
  loading: boolean;
  error: string | null;
  loadHistory: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refresh: () => Promise<void>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const useGroupHistory = (
  conversationId: string | null
): UseGroupHistoryReturn => {
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { getToken } = useAuth();
  const { socket, on, off } = useSocket();

  const loadingRef = useRef(false);

  // ============================================
  // FETCH GROUP HISTORY
  // ============================================
  const loadHistory = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!conversationId || loadingRef.current) return;

      try {
        loadingRef.current = true;
        setError(null);

        if (pageNum === 1 && !append) {
          setLoading(true);
        }

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/history?page=${pageNum}&limit=50`;

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
          throw new Error(result.error || "Failed to load group history");
        }

        const messages = result.data?.systemMessages || [];
        const pagination = result.data?.pagination;

        if (append) {
          setSystemMessages((prev) => [...prev, ...messages]);
        } else {
          setSystemMessages(messages);
        }

        setHasMore(pagination?.hasMore || false);
        setPage(pageNum + 1);

        console.log(`✅ Loaded ${messages.length} system messages`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load group history";
        setError(errorMessage);
        console.error("Error loading group history:", err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [conversationId, getToken]
  );

  const loadMore = useCallback(async () => {
    if (hasMore && !loadingRef.current) {
      await loadHistory(page, true);
    }
  }, [hasMore, page, loadHistory]);

  const refresh = useCallback(async () => {
    setPage(1);
    setHasMore(false);
    await loadHistory(1, false);
  }, [loadHistory]);

  // ============================================
  // SOCKET EVENT HANDLERS
  // ============================================
  useEffect(() => {
    if (!socket || !conversationId) return;

    // Handler for group events that create system messages
    const handleParticipantsAdded = (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.system_message) return;

      console.log("👥 Participants added event:", data);

      setSystemMessages((prev) => {
        // Check if message already exists
        const exists = prev.some((msg) => msg._id === data.system_message._id);
        if (exists) return prev;

        return [...prev, data.system_message];
      });
    };

    const handleParticipantRemoved = (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.system_message) return;

      console.log("🚪 Participant removed event:", data);

      setSystemMessages((prev) => {
        const exists = prev.some((msg) => msg._id === data.system_message._id);
        if (exists) return prev;

        return [...prev, data.system_message];
      });
    };

    const handleUserLeftGroup = (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.system_message) return;

      console.log("👋 User left group event:", data);

      setSystemMessages((prev) => {
        const exists = prev.some((msg) => msg._id === data.system_message._id);
        if (exists) return prev;

        return [...prev, data.system_message];
      });
    };

    const handleAdminTransferred = (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.system_message) return;

      console.log("👑 Admin transferred event:", data);

      setSystemMessages((prev) => {
        const exists = prev.some((msg) => msg._id === data.system_message._id);
        if (exists) return prev;

        return [...prev, data.system_message];
      });
    };

    const handleGroupAvatarUpdated = (data: any) => {
      if (data.conversation_id !== conversationId) return;
      if (!data.system_message) return;

      console.log("📷 Group avatar updated event:", data);

      setSystemMessages((prev) => {
        const exists = prev.some((msg) => msg._id === data.system_message._id);
        if (exists) return prev;

        return [...prev, data.system_message];
      });
    };

    const handleConversationUpdated = (data: any) => {
      if (data.conversation_id !== conversationId) return;
      
      // This event might contain system messages for name/description changes
      console.log("✏️ Conversation updated event:", data);
      
      // Refresh to get any new system messages
      refresh();
    };

    // Register socket listeners
    on("participantsAdded", handleParticipantsAdded);
    on("participantRemoved", handleParticipantRemoved);
    on("userLeftGroup", handleUserLeftGroup);
    on("adminTransferred", handleAdminTransferred);
    on("groupAvatarUpdated", handleGroupAvatarUpdated);
    on("conversationUpdated", handleConversationUpdated);

    console.log("✅ Group history socket listeners registered");

    return () => {
      off("participantsAdded", handleParticipantsAdded);
      off("participantRemoved", handleParticipantRemoved);
      off("userLeftGroup", handleUserLeftGroup);
      off("adminTransferred", handleAdminTransferred);
      off("groupAvatarUpdated", handleGroupAvatarUpdated);
      off("conversationUpdated", handleConversationUpdated);

      console.log("❌ Group history socket listeners removed");
    };
  }, [socket, conversationId, on, off, refresh]);

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    if (conversationId) {
      loadHistory(1, false);
    }
  }, [conversationId]);

  return {
    systemMessages,
    loading,
    error,
    loadHistory: () => loadHistory(1, false),
    loadMore,
    hasMore,
    refresh,
  };
};