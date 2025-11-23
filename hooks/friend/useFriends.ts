// hooks/friend/useFriends.ts - COMPLETE FIXED VERSION
import {
  CachedFriend,
  CachedFriendRequest,
  friendsCacheService,
} from "@/lib/cache/FriendCacheService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../message/useSocket";

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
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

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
    [API_BASE_URL]
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
// FRIEND REQUESTS HOOK WITH FULL CACHE
// ============================================
export const useFriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const { getToken } = useAuth();
  const { socket } = useSocket();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  const getTokenRef = useRef(getToken);
  const hasLoadedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Load from cache
  const loadFromCache = useCallback(async () => {
    try {
      console.log("📦 Loading friend requests from cache...");
      const cached = await friendsCacheService.getFriendRequests();

      if (cached.length > 0) {
        const parsed: FriendRequest[] = cached.map((r) => ({
          id: r.id,
          requester: JSON.parse(r.requester_json),
          created_at: new Date(r.created_at),
        }));

        setRequests(parsed);
        setRequestCount(parsed.length);
        console.log(`✅ Loaded ${parsed.length} requests from cache`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Failed to load requests from cache:", error);
      return false;
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback(async (requestsList: FriendRequest[]) => {
    try {
      const toCache: CachedFriendRequest[] = requestsList.map((r) => ({
        id: r.id,
        requester_json: JSON.stringify(r.requester),
        created_at: r.created_at.getTime(),
      }));

      await friendsCacheService.saveFriendRequests(toCache);
    } catch (error) {
      console.error("Failed to save requests to cache:", error);
    }
  }, []);

  // Network fetch
  const fetchFromNetwork = useCallback(
    async (type: "received" | "sent" | "all" = "received") => {
      try {
        console.log(`🌐 Fetching ${type} friend requests from network...`);
        const token = await getTokenRef.current();

        if (!token) {
          throw new Error("Not authenticated");
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
        console.log("📬 loadFriendRequests response:", result);

        if (response.ok) {
          if (type === "received" || type === "all") {
            const receivedRequests = result.requests || [];
            setRequests(receivedRequests);
            setRequestCount(receivedRequests.length);

            saveToCache(receivedRequests);
          }

          if (type === "sent") {
            setSentRequests(result.requests || []);
          } else if (type === "all") {
            setSentRequests(result.sentRequests || []);
          }

          return {
            success: true,
            error: null,
            data: result.requests || [],
          };
        } else {
          throw new Error(result.error || "Failed to load friend requests");
        }
      } catch (err: any) {
        throw err;
      }
    },
    [API_BASE_URL, saveToCache]
  );

  // Load with cache support
  const loadFriendRequests = useCallback(
    async (
      type: "received" | "sent" | "all" = "received",
      useCache = true
    ): Promise<ApiResponse<FriendRequest[]>> => {
      if (isFetchingRef.current) {
        console.log("⏳ Fetch already in progress, skipping...");
        return { success: true, error: null, data: requests };
      }

      try {
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        if (useCache && type === "received") {
          const hasCache = await loadFromCache();
          if (hasCache) {
            setLoading(false);
            fetchFromNetwork(type);
            return { success: true, error: null, data: requests };
          }
        }

        return await fetchFromNetwork(type);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load friend requests";
        setError(errorMessage);
        return { success: false, error: errorMessage, data: null };
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [requests, loadFromCache, fetchFromNetwork]
  );

  const sendFriendRequest = useCallback(
    async (userId: string): Promise<ApiResponse<null>> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getTokenRef.current();
        if (!token) {
          throw new Error("Not authenticated");
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
    [API_BASE_URL]
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
          throw new Error("Not authenticated");
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
          if (action === "accept" || action === "decline") {
            await friendsCacheService.deleteFriendRequest(requestId);
            setRequests((prev) => prev.filter((r) => r.id !== requestId));
            setRequestCount((prev) => Math.max(0, prev - 1));
          }

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
          throw new Error("Not authenticated");
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
          setSentRequests((prev) => prev.filter((r) => r.id !== requestId));

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

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleFriendRequestReceived = (data: FriendRequestReceivedEvent) => {
      console.log("📬 New friend request received:", data);

      const newRequest: FriendRequest = {
        id: data.request_id,
        requester: {
          id: data.requester_id,
          username: "",
          full_name: data.requester_name,
          avatar: data.requester_avatar,
        },
        created_at: new Date(data.timestamp),
      };

      setRequests((prev) => [newRequest, ...prev]);
      setRequestCount((prev) => prev + 1);

      friendsCacheService.saveFriendRequests([
        {
          id: newRequest.id,
          requester_json: JSON.stringify(newRequest.requester),
          created_at: newRequest.created_at.getTime(),
        },
      ]);

      loadFriendRequests("received", false);
    };

    const handleFriendRequestAccepted = (data: FriendRequestAcceptedEvent) => {
      console.log("✅ Friend request accepted:", data);

      setRequests((prev) => prev.filter((r) => r.id !== data.request_id));
      setRequestCount((prev) => Math.max(0, prev - 1));

      friendsCacheService.deleteFriendRequest(data.request_id);

      loadFriendRequests("received", false);
    };

    const handleFriendRequestDeclined = (data: FriendRequestDeclinedEvent) => {
      console.log("❌ Friend request declined:", data);

      setSentRequests((prev) => prev.filter((r) => r.id !== data.request_id));
    };

    const handleFriendRequestCancelled = (
      data: FriendRequestCancelledEvent
    ) => {
      console.log("🚫 Friend request cancelled:", data);

      setRequests((prev) => prev.filter((r) => r.id !== data.request_id));
      setRequestCount((prev) => Math.max(0, prev - 1));

      friendsCacheService.deleteFriendRequest(data.request_id);
    };

    socket.on("friendRequestReceived", handleFriendRequestReceived);
    socket.on("friendRequestAccepted", handleFriendRequestAccepted);
    socket.on("friendRequestDeclined", handleFriendRequestDeclined);
    socket.on("friendRequestCancelled", handleFriendRequestCancelled);

    return () => {
      socket.off("friendRequestReceived", handleFriendRequestReceived);
      socket.off("friendRequestAccepted", handleFriendRequestAccepted);
      socket.off("friendRequestDeclined", handleFriendRequestDeclined);
      socket.off("friendRequestCancelled", handleFriendRequestCancelled);
    };
  }, [socket, loadFriendRequests]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFriendRequests("all");
    }
  }, [loadFriendRequests]);

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
// FRIENDS LIST HOOK WITH FULL CACHE
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
  const isFetchingRef = useRef(false);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Load from cache
  const loadFromCache = useCallback(async () => {
    try {
      console.log("📦 Loading friends from cache...");
      const cached = await friendsCacheService.getFriends();

      if (cached.length > 0) {
        const parsed: Friend[] = cached.map((f) => ({
          id: f.id,
          clerkId: f.clerkId,
          username: f.username,
          full_name: f.full_name,
          avatar: f.avatar,
          is_online: f.is_online === 1,
          last_seen: f.last_seen ? new Date(f.last_seen) : undefined,
          mutualFriendsCount: f.mutualFriendsCount,
          friendshipDate: new Date(f.friendshipDate),
        }));

        setFriends(parsed);
        setTotalCount(parsed.length);
        console.log(`✅ Loaded ${parsed.length} friends from cache`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Failed to load from cache:", error);
      return false;
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback(async (friendsList: Friend[]) => {
  try {
    const toCache: CachedFriend[] = friendsList.map((f) => {
      // ✅ Safe conversion helpers
      const getTimestamp = (date: Date | number | undefined): number | undefined => {
        if (!date) return undefined;
        if (typeof date === 'number') return date;
        if (date instanceof Date) return date.getTime();
        return undefined;
      };

      return {
        id: f.id,
        clerkId: f.clerkId,
        username: f.username,
        full_name: f.full_name,
        avatar: f.avatar,
        is_online: f.is_online ? 1 : 0,
        last_seen: getTimestamp(f.last_seen),
        mutualFriendsCount: f.mutualFriendsCount,
        friendshipDate: getTimestamp(f.friendshipDate) || Date.now(), // Default to now if missing
      };
    });

    await friendsCacheService.saveFriends(toCache);
  } catch (error) {
    console.error("Failed to save friends to cache:", error);
  }
}, []);

  // Network fetch
  const fetchFromNetwork = useCallback(
    async (page = 1, search = "", status: "online" | "all" = "all") => {
      try {
        console.log("🌐 Fetching friends from network...");
        const token = await getTokenRef.current();

        if (!token) {
          throw new Error("Not authenticated");
        }

        const params = new URLSearchParams({
          page: page.toString(),
          limit: "100",
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
          const fetchedFriends = result.friends || [];
          console.log(
            `✅ Fetched ${fetchedFriends.length} friends from network`
          );

          setFriends(fetchedFriends);
          setTotalCount(result.totalCount || 0);

          if (page === 1 && !search) {
            saveToCache(fetchedFriends);
          }

          return {
            success: true,
            error: null,
            data: {
              friends: fetchedFriends,
              totalCount: result.totalCount || 0,
            },
          };
        } else {
          throw new Error(result.error || "Failed to load friends");
        }
      } catch (err: any) {
        throw err;
      }
    },
    [API_BASE_URL, saveToCache]
  );

  // Load with cache support
  const loadFriends = useCallback(
    async (
      page = 1,
      search = "",
      status: "online" | "all" = "all",
      useCache = true
    ): Promise<ApiResponse<{ friends: Friend[]; totalCount: number }>> => {
      if (isFetchingRef.current) {
        console.log("⏳ Fetch already in progress, skipping...");
        return { success: true, error: null, data: { friends, totalCount } };
      }

      try {
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        if (useCache && page === 1 && !search) {
          const hasCache = await loadFromCache();
          if (hasCache) {
            setLoading(false);
            fetchFromNetwork(page, search, status);
            return {
              success: true,
              error: null,
              data: { friends, totalCount },
            };
          }
        }

        return await fetchFromNetwork(page, search, status);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load friends";
        setError(errorMessage);
        return { success: false, error: errorMessage, data: null };
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [friends, totalCount, loadFromCache, fetchFromNetwork]
  );

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleFriendRequestAccepted = (data: FriendRequestAcceptedEvent) => {
      console.log("✅ New friend added:", data);
      loadFriends(1, "", "all", false);
    };

    const handleFriendRemoved = (data: FriendRemovedEvent) => {
      console.log("👋 Friend removed:", data);

      const removedId = data.removed_user_id || data.removed_by;

      setFriends((prev) =>
        prev.filter((f) => f.clerkId !== removedId && f.id !== removedId)
      );
      setTotalCount((prev) => Math.max(0, prev - 1));

      if (removedId) {
        friendsCacheService.deleteFriend(removedId);
      }
    };

    const handleFriendBlocked = (data: FriendBlockedEvent) => {
      console.log("🚫 Friend blocked:", data);

      setFriends((prev) =>
        prev.filter(
          (f) =>
            f.clerkId !== data.blocked_user_id && f.id !== data.blocked_user_id
        )
      );
      setTotalCount((prev) => Math.max(0, prev - 1));

      friendsCacheService.deleteFriend(data.blocked_user_id);
    };

    const handleFriendUnblocked = (data: FriendUnblockedEvent) => {
      console.log("🔓 Friend unblocked:", data);
      loadFriends(1, "", "all", false);
    };

    const handleFriendCountUpdated = (data: FriendCountUpdatedEvent) => {
      console.log("🔢 Friend count updated:", data.count);
      setTotalCount(data.count);
    };

    const handleFriendStatusChanged = (data: FriendStatusChangedEvent) => {
      console.log(`👤 Friend ${data.friend_id} is now ${data.status}`);

      const isOnline = data.status === "online";

      setFriends((prev) =>
        prev.map((f) =>
          f.clerkId === data.friend_id || f.id === data.friend_id
            ? { ...f, is_online: isOnline }
            : f
        )
      );

      friendsCacheService.updateFriend(data.friend_id, {
        is_online: isOnline ? 1 : 0,
      });
    };

    socket.on("friendRequestAccepted", handleFriendRequestAccepted);
    socket.on("friendRemoved", handleFriendRemoved);
    socket.on("friendBlocked", handleFriendBlocked);
    socket.on("friendUnblocked", handleFriendUnblocked);
    socket.on("friendCountUpdated", handleFriendCountUpdated);
    socket.on("friendStatusChanged", handleFriendStatusChanged);

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
        const token = await getTokenRef.current();
        if (!token) {
          throw new Error("Not authenticated");
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
    [API_BASE_URL]
  );

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
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
};

// ============================================
// BLOCKED USERS HOOK
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

  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

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
    [API_BASE_URL]
  );

  useEffect(() => {
    if (!socket) return;

    const handleFriendBlocked = (data: FriendBlockedEvent) => {
      console.log("🚫 User blocked:", data);
      loadBlockedUsers(1, "");
    };

    const handleFriendUnblocked = (data: FriendUnblockedEvent) => {
      console.log("🔓 User unblocked:", data);

      setBlockedUsers((prev) =>
        prev.filter((user) => user.id !== data.unblocked_user_id)
      );
      setTotalCount((prev) => Math.max(0, prev - 1));
    };

    socket.on("friendBlocked", handleFriendBlocked);
    socket.on("friendUnblocked", handleFriendUnblocked);

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
    [API_BASE_URL]
  );

  const unblockUser = useCallback(
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
    [API_BASE_URL]
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
