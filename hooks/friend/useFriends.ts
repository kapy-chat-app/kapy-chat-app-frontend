import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../message/useSocket";

// Existing interfaces
export interface User {
  id: string;
  username: string;
  full_name: string;
  avatar?: string;
  bio?: string;
  is_online: boolean;
  mutualFriendsCount: number;
  friendshipStatus: "none" | "pending" | "accepted" | "sent" | "blocked";
}

export interface Friend {
  id: string;
  clerkId: string;
  username: string;
  full_name: string;
  avatar?: string;
  is_online: boolean;
  last_seen?: Date;
  mutualFriendsCount: number;
  friendshipDate: Date;
}

export interface FriendRequest {
  id: string;
  requester: {
    id: string;
    username: string;
    full_name: string;
    avatar?: string;
  };
  created_at: Date;
}

export interface BlockedUser {
  id: string;
  username: string;
  full_name: string;
  avatar?: string;
  blocked_at: Date;
  reason?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  error: string | null;
  data: T | null;
  message?: string;
}

// Socket event types
interface FriendRequestReceivedEvent {
  request_id: string;
  requester_id: string;
  requester_name: string;
  requester_avatar?: string;
  timestamp: Date;
}

interface FriendRequestSentEvent {
  request_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_avatar?: string;
  timestamp: Date;
}

interface FriendRequestAcceptedEvent {
  request_id: string;
  accepted_by: string;
  new_friend_id: string;
  new_friend_name: string;
  new_friend_avatar?: string;
  timestamp: Date;
}

interface FriendRequestDeclinedEvent {
  request_id: string;
  declined_by: string;
  declined_by_name: string;
  timestamp: Date;
}

interface FriendRequestCancelledEvent {
  request_id: string;
  cancelled_by: string;
  cancelled_by_name: string;
  timestamp: Date;
}

interface FriendRemovedEvent {
  friendship_id: string;
  removed_by?: string;
  removed_by_name?: string;
  removed_user_id?: string;
  removed_user_name?: string;
  timestamp: Date;
}

interface FriendBlockedEvent {
  friendship_id: string;
  blocked_user_id: string;
  blocked_user_name: string;
  timestamp: Date;
}

interface FriendUnblockedEvent {
  friendship_id: string;
  unblocked_user_id: string;
  unblocked_user_name: string;
  timestamp: Date;
}

interface FriendCountUpdatedEvent {
  count: number;
  timestamp: Date;
}

interface FriendRequestCountUpdatedEvent {
  count: number;
  timestamp: Date;
}

interface FriendStatusChangedEvent {
  friend_id: string;
  status: "online" | "offline";
  timestamp: Date;
}

// ============================================
// FRIEND SEARCH HOOK
// ============================================
export const useFriendSearch = () => {
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchUsers = useCallback(
    async (query: string, immediate = false): Promise<ApiResponse<User[]>> => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      if (!query.trim()) {
        setSearchResults([]);
        return {
          success: true,
          error: null,
          data: [],
        };
      }

      if (!immediate) {
        return new Promise((resolve) => {
          debounceTimeoutRef.current = setTimeout(async () => {
            const result = await searchUsers(query, true);
            resolve(result);
          }, 300);
        });
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/friends/search?q=${encodeURIComponent(
            query
          )}&limit=10`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();

        if (response.ok) {
          setSearchResults(result.users || []);
          return {
            success: true,
            error: null,
            data: result.users || [],
          };
        } else {
          const errorMessage = result.error || "Search failed";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Network error occurred";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      searchResults,
      loading,
      error,
      searchUsers,
      clearError,
    }),
    [searchResults, loading, error, searchUsers, clearError]
  );
};

// ============================================
// FRIEND REQUESTS HOOK WITH SOCKET EVENTS
// ============================================
export const useFriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const { getToken } = useAuth();  // This changes every render
  const { socket } = useSocket();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  // NEW: Use ref to track latest getToken without unstable dep
  const getTokenRef = useRef<typeof getToken>(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const hasLoadedRef = useRef(false);

 const loadFriendRequests = useCallback(
  async (
    type: "received" | "sent" | "all" = "received"
  ): Promise<ApiResponse<FriendRequest[]>> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getTokenRef.current();
      if (!token) {
        const errorResponse = {
          success: false as const,
          error: "Not authenticated",
          data: null,
        };
        setError("Not authenticated");
        return errorResponse;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/friends/request?type=${type}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      console.log("📬 loadFriendRequests response:", result); // DEBUG

      if (response.ok) {
        // Handle received requests
        if (type === "received" || type === "all") {
          setRequests(result.requests || []);
          setRequestCount(result.requests?.length || 0);
        }
        
        // Handle sent requests - ĐÂY LÀ PHẦN QUAN TRỌNG
        if (type === "sent") {
          // Khi type === "sent", backend trả về trong trường requests
          setSentRequests(result.requests || []);
        } else if (type === "all") {
          // Khi type === "all", backend trả về sentRequests riêng
          setSentRequests(result.sentRequests || []);
        }

        return {
          success: true,
          error: null,
          data: result.requests || [],
        };
      } else {
        const errorMessage = result.error || "Failed to load friend requests";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load friend requests";
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    } finally {
      setLoading(false);
    }
  },
  [API_BASE_URL]
);

  // Apply same pattern to other functions (sendFriendRequest, respondToRequest, cancelRequest)
  const sendFriendRequest = useCallback(
    async (userId: string): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getTokenRef.current();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ recipientId: userId }),
        });

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            error: null,
            data: null,
            message: result.message,
          };
        } else {
          const errorMessage = result.message || "Failed to send request";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to send request";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL]  // Stable deps
  );

  const respondToRequest = useCallback(
    async (
      requestId: string,
      action: "accept" | "decline" | "block"
    ): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getTokenRef.current();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ requestId, action }),
        });

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            error: null,
            data: null,
            message: result.message,
          };
        } else {
          const errorMessage = result.message || "Failed to respond to request";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to respond to request";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL]
  );

  const cancelRequest = useCallback(
    async (requestId: string): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getTokenRef.current();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/friends/request/${requestId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            error: null,
            data: null,
            message: result.message,
          };
        } else {
          const errorMessage = result.message || "Failed to cancel request";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to cancel request";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL]
  );

  // ... (socket useEffect remains unchanged)

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFriendRequests();  // Defaults to "received"
    }
  }, [loadFriendRequests]);  // Now stable!

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      requests,
      sentRequests,
      loading,
      error,
      requestCount,
      loadFriendRequests,
      sendFriendRequest,
      respondToRequest,
      cancelRequest,
      clearError,
    }),
    [
      requests,
      sentRequests,
      loading,
      error,
      requestCount,
      loadFriendRequests,
      sendFriendRequest,
      respondToRequest,
      cancelRequest,
      clearError,
    ]
  );
};

// ============================================
// FRIENDS LIST HOOK WITH SOCKET EVENTS
// ============================================
export const useFriendsList = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const { getToken } = useAuth();
  const { socket } = useSocket();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  const hasLoadedRef = useRef(false);

  const loadFriends = useCallback(
    async (
      page = 1,
      search = "",
      status: "online" | "all" = "all"
    ): Promise<ApiResponse<{ friends: Friend[]; totalCount: number }>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const params = new URLSearchParams({
          page: page.toString(),
          limit: "20",
          ...(search && { search }),
          ...(status !== "all" && { status }),
        });

        const response = await fetch(`${API_BASE_URL}/api/friends?${params}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (response.ok) {
          setFriends(result.friends || []);
          setTotalCount(result.totalCount || 0);
          return {
            success: true,
            error: null,
            data: {
              friends: result.friends || [],
              totalCount: result.totalCount || 0,
            },
          };
        } else {
          const errorMessage = result.error || "Failed to load friends";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load friends";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle friend request accepted - add new friend
    const handleFriendRequestAccepted = (data: FriendRequestAcceptedEvent) => {
      console.log("✅ New friend added:", data);

      // Reload friends list to get complete data
      loadFriends();
    };

    // Handle friend removed
    const handleFriendRemoved = (data: FriendRemovedEvent) => {
      console.log("👋 Friend removed:", data);

      // Remove friend from list
      setFriends((prev) => {
        const removedId = data.removed_user_id || data.removed_by;
        return prev.filter(
          (friend) => friend.clerkId !== removedId && friend.id !== removedId
        );
      });
      setTotalCount((prev) => Math.max(0, prev - 1));
    };

    // Handle friend blocked
    const handleFriendBlocked = (data: FriendBlockedEvent) => {
      console.log("🚫 Friend blocked:", data);

      // Remove from friends list
      setFriends((prev) =>
        prev.filter(
          (friend) =>
            friend.clerkId !== data.blocked_user_id &&
            friend.id !== data.blocked_user_id
        )
      );
      setTotalCount((prev) => Math.max(0, prev - 1));
    };

    // Handle friend unblocked
    const handleFriendUnblocked = (data: FriendUnblockedEvent) => {
      console.log("🔓 Friend unblocked:", data);

      // Reload friends list
      loadFriends();
    };

    // Handle friend count update
    const handleFriendCountUpdated = (data: FriendCountUpdatedEvent) => {
      console.log("🔢 Friend count updated:", data.count);
      setTotalCount(data.count);
    };

    // Handle friend online/offline status change
    const handleFriendStatusChanged = (data: FriendStatusChangedEvent) => {
      console.log(`👤 Friend ${data.friend_id} is now ${data.status}`);

      setFriends((prev) =>
        prev.map((friend) =>
          friend.clerkId === data.friend_id || friend.id === data.friend_id
            ? { ...friend, is_online: data.status === "online" }
            : friend
        )
      );
    };

    // Register socket listeners
    socket.on("friendRequestAccepted", handleFriendRequestAccepted);
    socket.on("friendRemoved", handleFriendRemoved);
    socket.on("friendBlocked", handleFriendBlocked);
    socket.on("friendUnblocked", handleFriendUnblocked);
    socket.on("friendCountUpdated", handleFriendCountUpdated);
    socket.on("friendStatusChanged", handleFriendStatusChanged);

    // Cleanup
    return () => {
      socket.off("friendRequestAccepted", handleFriendRequestAccepted);
      socket.off("friendRemoved", handleFriendRemoved);
      socket.off("friendBlocked", handleFriendBlocked);
      socket.off("friendUnblocked", handleFriendUnblocked);
      socket.off("friendCountUpdated", handleFriendCountUpdated);
      socket.off("friendStatusChanged", handleFriendStatusChanged);
    };
  }, [socket, loadFriends]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFriends();
    }
  }, [loadFriends]);

  const removeFriend = useCallback(
    async (friendId: string): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/friends/${friendId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            error: null,
            data: null,
            message: result.message,
          };
        } else {
          const errorMessage = result.error || "Failed to remove friend";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to remove friend";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  const clearError = useCallback(() => setError(null), []);

  const returnValue = useMemo(
    () => ({
      friends,
      loading,
      error,
      totalCount,
      loadFriends,
      removeFriend,
      clearError,
    }),
    [friends, loading, error, totalCount, loadFriends, removeFriend, clearError]
  );

  return returnValue;
};

// ============================================
// BLOCKED USERS HOOK WITH SOCKET EVENTS
// ============================================
export const useBlockedUsers = () => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const { getToken } = useAuth();
  const { socket } = useSocket();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  const loadBlockedUsers = useCallback(
    async (
      page = 1,
      search = ""
    ): Promise<
      ApiResponse<{ blockedUsers: BlockedUser[]; totalCount: number }>
    > => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const params = new URLSearchParams({
          page: page.toString(),
          limit: "20",
          ...(search && { search }),
        });

        const response = await fetch(
          `${API_BASE_URL}/api/friends/block?${params}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();

        if (response.ok) {
          if (page === 1) {
            setBlockedUsers(result.blockedUsers || []);
          } else {
            setBlockedUsers((prev) => [
              ...prev,
              ...(result.blockedUsers || []),
            ]);
          }
          setTotalCount(result.totalCount || 0);
          return {
            success: true,
            error: null,
            data: {
              blockedUsers: result.blockedUsers || [],
              totalCount: result.totalCount || 0,
            },
          };
        } else {
          const errorMessage = result.error || "Failed to load blocked users";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load blocked users";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle friend blocked - add to blocked list
    const handleFriendBlocked = (data: FriendBlockedEvent) => {
      console.log("🚫 User blocked:", data);

      // Reload blocked users list to get complete data
      loadBlockedUsers(1, "");
    };

    // Handle friend unblocked
    const handleFriendUnblocked = (data: FriendUnblockedEvent) => {
      console.log("🔓 User unblocked:", data);

      // Remove from blocked list
      setBlockedUsers((prev) =>
        prev.filter((user) => user.id !== data.unblocked_user_id)
      );
      setTotalCount((prev) => Math.max(0, prev - 1));
    };

    // Register socket listeners
    socket.on("friendBlocked", handleFriendBlocked);
    socket.on("friendUnblocked", handleFriendUnblocked);

    // Cleanup
    return () => {
      socket.off("friendBlocked", handleFriendBlocked);
      socket.off("friendUnblocked", handleFriendUnblocked);
    };
  }, [socket, loadBlockedUsers]);

  const blockUser = useCallback(
    async (userId: string, reason?: string): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(`${API_BASE_URL}/api/friends/block`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId, reason }),
        });

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            error: null,
            data: null,
            message: result.message || "User blocked successfully",
          };
        } else {
          const errorMessage = result.error || "Failed to block user";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to block user";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  const unblockUser = useCallback(
    async (userId: string): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false as const,
            error: "Not authenticated",
            data: null,
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(`${API_BASE_URL}/api/friends/block`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        });

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            error: null,
            data: null,
            message: result.message || "User unblocked successfully",
          };
        } else {
          const errorMessage = result.error || "Failed to unblock user";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            data: null,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to unblock user";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      blockedUsers,
      loading,
      error,
      totalCount,
      loadBlockedUsers,
      blockUser,
      unblockUser,
      clearError,
    }),
    [
      blockedUsers,
      loading,
      error,
      totalCount,
      loadBlockedUsers,
      blockUser,
      unblockUser,
      clearError,
    ]
  );
};
