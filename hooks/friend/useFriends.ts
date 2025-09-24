import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";

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

// New interface for blocked users
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

// Existing hooks (unchanged)
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

export const useFriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  const hasLoadedRef = useRef(false);

  const loadFriendRequests = useCallback(
    async (type: 'received' | 'sent' | 'all' = 'received'): Promise<ApiResponse<FriendRequest[]>> => {
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

        const response = await fetch(`${API_BASE_URL}/api/friends/request?type=${type}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (response.ok) {
          setRequests(result.requests || []);
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
    [getToken, API_BASE_URL]
  );

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFriendRequests();
    }
  }, [loadFriendRequests]);

  const sendFriendRequest = useCallback(
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
    [getToken, API_BASE_URL]
  );

  const respondToRequest = useCallback(
    async (
      requestId: string,
      action: "accept" | "decline" | "block"
    ): Promise<ApiResponse<null>> => {
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
          setRequests((prev) => prev.filter((req) => req.id !== requestId));
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
    [getToken, API_BASE_URL]
  );

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      requests,
      loading,
      error,
      loadFriendRequests,
      sendFriendRequest,
      respondToRequest,
      clearError,
    }),
    [requests, loading, error, loadFriendRequests, sendFriendRequest, respondToRequest, clearError]
  );
};

export const useFriendsList = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const { getToken } = useAuth();

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

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFriends();
    }
  }, [loadFriends]);

  const clearError = useCallback(() => setError(null), []);

  const returnValue = useMemo(
    () => ({
      friends,
      loading,
      error,
      totalCount,
      loadFriends,
      clearError,
    }),
    [friends, loading, error, totalCount, loadFriends, clearError]
  );

  return returnValue;
};

export const useBlockedUsers = () => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const { getToken } = useAuth();

  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  // LOẠI BỎ hasLoadedRef và useEffect tự động load
  // const hasLoadedRef = useRef(false);

  const loadBlockedUsers = useCallback(
    async (
      page = 1,
      search = ""
    ): Promise<ApiResponse<{ blockedUsers: BlockedUser[]; totalCount: number }>> => {
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

        const response = await fetch(`${API_BASE_URL}/api/friends/block?${params}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (response.ok) {
          // Chỉ set state khi page = 1, hoặc append nếu page > 1
          if (page === 1) {
            setBlockedUsers(result.blockedUsers || []);
          } else {
            setBlockedUsers(prev => [...prev, ...(result.blockedUsers || [])]);
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
          // Reload blocked users list với page = 1
          await loadBlockedUsers(1, "");
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
    [getToken, API_BASE_URL, loadBlockedUsers]
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
          // Remove from blocked users list immediately
          setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
          setTotalCount(prev => prev - 1);
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

  // LOẠI BỎ useEffect tự động load
  // useEffect(() => {
  //   if (!hasLoadedRef.current) {
  //     hasLoadedRef.current = true;
  //     loadBlockedUsers();
  //   }
  // }, [loadBlockedUsers]);

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
    [blockedUsers, loading, error, totalCount, loadBlockedUsers, blockUser, unblockUser, clearError]
  );
};