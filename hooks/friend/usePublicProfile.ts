import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../message/useSocket";

export interface PublicUserProfile {
  id: string;
  username: string;
  full_name: string;
  bio?: string;
  avatar?: string | null;
  cover_photo?: string | null;
  location?: string;
  website?: string;
  is_online: boolean;
  last_seen?: Date;
  status?: string;
  friendsCount: number;
  mutualFriendsCount: number;
  friendshipStatus: "none" | "pending" | "accepted" | "sent" | "blocked";
  canViewProfile: boolean;
}

export interface PublicProfileApiResponse {
  success: boolean;
  error?: string;
  data?: PublicUserProfile;
}

// Socket event types
interface FriendRequestSentEvent {
  request_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_avatar?: string;
  timestamp: Date;
}

interface FriendRequestReceivedEvent {
  request_id: string;
  requester_id: string;
  requester_name: string;
  requester_avatar?: string;
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

interface FriendStatusChangedEvent {
  friend_id: string;
  status: "online" | "offline";
  timestamp: Date;
}

export const usePublicProfile = () => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { socket } = useSocket();

  // Stable API URL
  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  // Use ref to prevent concurrent requests
  const loadingRef = useRef(false);
  // Track current user ID to prevent unnecessary calls
  const currentUserIdRef = useRef<string | null>(null);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const getUserProfile = useCallback(
    async (userId: string): Promise<PublicProfileApiResponse> => {
      if (loadingRef.current || !userId) {
        return {
          success: false,
          error: "Invalid request or already loading",
        };
      }

      // Prevent calling API for same user ID if already loaded
      if (currentUserIdRef.current === userId && profileRef.current) {
      return {
        success: true,
        data: profileRef.current,
      };
    }

      loadingRef.current = true;
      setLoading(true);
      setError(null);
      currentUserIdRef.current = userId;

      try {
        const token = await getToken();
        if (!token) {
          const errorResponse = {
            success: false,
            error: "Not authenticated",
          };
          setError("Not authenticated");
          return errorResponse;
        }

        const response = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (response.ok && result.profile) {
          setProfile(result.profile);
          return {
            success: true,
            data: result.profile,
          };
        } else {
          const errorMessage = result.error || "Failed to load user profile";
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
          };
        }
      } catch (err: any) {
        const errorMessage = err.message || "Network error occurred";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Socket event listeners for profile updates
  useEffect(() => {
    if (!socket || !profile) return;

    const currentProfileId = profile.id;

    // Handle friend request sent to this profile
    const handleFriendRequestSent = (data: FriendRequestSentEvent) => {
      if (data.recipient_id === currentProfileId) {
        console.log("📤 Friend request sent to profile:", data);
        setProfile((prev) =>
          prev ? { ...prev, friendshipStatus: "sent" } : prev
        );
      }
    };

    // Handle friend request received from this profile
    const handleFriendRequestReceived = (data: FriendRequestReceivedEvent) => {
      if (data.requester_id === currentProfileId) {
        console.log("📬 Friend request received from profile:", data);
        setProfile((prev) =>
          prev ? { ...prev, friendshipStatus: "pending" } : prev
        );
      }
    };

    // Handle friend request accepted
    const handleFriendRequestAccepted = (data: FriendRequestAcceptedEvent) => {
      if (
        data.new_friend_id === currentProfileId ||
        data.accepted_by === currentProfileId
      ) {
        console.log("✅ Friend request accepted with profile:", data);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendshipStatus: "accepted",
                canViewProfile: true,
              }
            : prev
        );
      }
    };

    // Handle friend request declined
    const handleFriendRequestDeclined = (data: FriendRequestDeclinedEvent) => {
      if (data.declined_by === currentProfileId) {
        console.log("❌ Friend request declined by profile:", data);
        setProfile((prev) =>
          prev ? { ...prev, friendshipStatus: "none" } : prev
        );
      }
    };

    // Handle friend request cancelled
    const handleFriendRequestCancelled = (
      data: FriendRequestCancelledEvent
    ) => {
      if (data.cancelled_by === currentProfileId) {
        console.log("🚫 Friend request cancelled by profile:", data);
        setProfile((prev) =>
          prev ? { ...prev, friendshipStatus: "none" } : prev
        );
      }
    };

    // Handle friend removed
    const handleFriendRemoved = (data: FriendRemovedEvent) => {
      const removedId = data.removed_user_id || data.removed_by;
      if (removedId === currentProfileId) {
        console.log("👋 Friend removed - profile:", data);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendshipStatus: "none",
                canViewProfile: prev.canViewProfile, // Keep as is based on privacy settings
              }
            : prev
        );
      }
    };

    // Handle friend blocked
    const handleFriendBlocked = (data: FriendBlockedEvent) => {
      if (data.blocked_user_id === currentProfileId) {
        console.log("🚫 Profile blocked:", data);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendshipStatus: "blocked",
                canViewProfile: false,
              }
            : prev
        );
      }
    };

    // Handle friend unblocked
    const handleFriendUnblocked = (data: FriendUnblockedEvent) => {
      if (data.unblocked_user_id === currentProfileId) {
        console.log("🔓 Profile unblocked:", data);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendshipStatus: "accepted",
                canViewProfile: true,
              }
            : prev
        );
      }
    };

    // Handle online/offline status change
    const handleFriendStatusChanged = (data: FriendStatusChangedEvent) => {
      if (data.friend_id === currentProfileId) {
        console.log(`👤 Profile ${data.friend_id} is now ${data.status}`);
        setProfile((prev) =>
          prev ? { ...prev, is_online: data.status === "online" } : prev
        );
      }
    };

    // Register socket listeners
    socket.on("friendRequestSent", handleFriendRequestSent);
    socket.on("friendRequestReceived", handleFriendRequestReceived);
    socket.on("friendRequestAccepted", handleFriendRequestAccepted);
    socket.on("friendRequestDeclined", handleFriendRequestDeclined);
    socket.on("friendRequestCancelled", handleFriendRequestCancelled);
    socket.on("friendRemoved", handleFriendRemoved);
    socket.on("friendBlocked", handleFriendBlocked);
    socket.on("friendUnblocked", handleFriendUnblocked);
    socket.on("friendStatusChanged", handleFriendStatusChanged);

    // Cleanup
    return () => {
      socket.off("friendRequestSent", handleFriendRequestSent);
      socket.off("friendRequestReceived", handleFriendRequestReceived);
      socket.off("friendRequestAccepted", handleFriendRequestAccepted);
      socket.off("friendRequestDeclined", handleFriendRequestDeclined);
      socket.off("friendRequestCancelled", handleFriendRequestCancelled);
      socket.off("friendRemoved", handleFriendRemoved);
      socket.off("friendBlocked", handleFriendBlocked);
      socket.off("friendUnblocked", handleFriendUnblocked);
      socket.off("friendStatusChanged", handleFriendStatusChanged);
    };
  }, [socket, profile?.id]);

  const clearError = useCallback(() => setError(null), []);

  const clearProfile = useCallback(() => {
    setProfile(null);
    currentUserIdRef.current = null;
  }, []);

  // Manual update profile function for optimistic updates
  const updateProfileStatus = useCallback(
    (status: "none" | "pending" | "accepted" | "sent" | "blocked") => {
      setProfile((prev) =>
        prev ? { ...prev, friendshipStatus: status } : prev
      );
    },
    []
  );

  // Memoize the return object to prevent unnecessary rerenders
  const returnValue = useMemo(
    () => ({
      profile,
      loading,
      error,
      getUserProfile,
      clearError,
      clearProfile,
      updateProfileStatus,
    }),
    [
      profile,
      loading,
      error,
      getUserProfile,
      clearError,
      clearProfile,
      updateProfileStatus,
    ]
  );

  return returnValue;
};
