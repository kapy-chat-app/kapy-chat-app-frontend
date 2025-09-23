import { useCallback, useRef, useState, useMemo } from "react";
import { useAuth } from "@clerk/clerk-expo";

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

export const usePublicProfile = () => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  // Stable API URL
  const API_BASE_URL = useRef(
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
  ).current;

  // Use ref to prevent concurrent requests
  const loadingRef = useRef(false);
  // Track current user ID to prevent unnecessary calls
  const currentUserIdRef = useRef<string | null>(null);

  const getUserProfile = useCallback(
    async (userId: string): Promise<PublicProfileApiResponse> => {
      if (loadingRef.current || !userId) {
        return {
          success: false,
          error: "Invalid request or already loading",
        };
      }

      // Prevent calling API for same user ID if already loaded
      if (currentUserIdRef.current === userId && profile) {
        return {
          success: true,
          data: profile,
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
    [getToken, API_BASE_URL, profile]
  );

  const clearError = useCallback(() => setError(null), []);

  const clearProfile = useCallback(() => {
    setProfile(null);
    currentUserIdRef.current = null;
  }, []);

  // Memoize the return object to prevent unnecessary rerenders
  const returnValue = useMemo(
    () => ({
      profile,
      loading,
      error,
      getUserProfile,
      clearError,
      clearProfile,
    }),
    [profile, loading, error, getUserProfile, clearError, clearProfile]
  );

  return returnValue;
};