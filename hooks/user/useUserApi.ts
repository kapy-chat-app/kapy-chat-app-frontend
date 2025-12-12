// hooks/user/useUserApi.ts
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';

export interface UserCreateData {
  email: string;
  full_name: string;
  username: string;
  bio?: string;
  phone?: string;
  date_of_birth?: Date;
  gender?: string;
  location?: string;
  website?: string;
}

export interface ProfileUpdateData {
  full_name?: string;
  username?: string;
  bio?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'private';
  location?: string;
  website?: string;
  status?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  error: string | null;
  data: T | null;
  profileComplete?: boolean;
  message?: string;
}

export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  full_name: string;
  username: string;
  bio?: string;
  phone?: string;
  date_of_birth?: Date;
  gender?: string;
  location?: string;
  website?: string;
  status?: string;
  avatar?: {
    id: string;
    url: string;
    file_name: string;
  };
  created_at: Date;
  updated_at: Date;
  clerk_data?: {
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    email_verified?: boolean;
    phone_verified?: boolean;
    last_sign_in?: Date;
    created_at_clerk?: Date;
  };
}

export const useUserApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  // Memoize API_BASE_URL to prevent recreating functions
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );

  const createUser = useCallback(async (userData: UserCreateData): Promise<ApiResponse<any>> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        return {
          success: false,
          error: "Not authenticated",
          data: null
        };
      }
      
      const response = await fetch(`${API_BASE_URL}/api/user/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Network error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null
      };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, API_BASE_URL]);

  const checkUsername = useCallback(async (username: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/check-username?username=${encodeURIComponent(username)}`);
      const result = await response.json();
      
      if (result.success) {
        return result.isAvailable;
      }
      return false;
    } catch (err) {
      console.error('Error checking username:', err);
      return false;
    }
  }, [API_BASE_URL]);

  const getUserProfile = useCallback(async (): Promise<ApiResponse<UserProfile>> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        return {
          success: false,
          error: "Not authenticated",
          data: null,
          profileComplete: false
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      console.log("API Response:", response.status, result);

      let profileComplete = false;
      
      if (result.hasOwnProperty('profileComplete')) {
        profileComplete = result.profileComplete;
      } else {
        profileComplete = result.success && result.data !== null;
      }

      return {
        success: result.success,
        error: result.error || null,
        data: result.data,
        profileComplete: profileComplete
      };
    } catch (err: any) {
      console.error("getUserProfile error:", err);
      const errorMessage = err.message || 'Network error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
        profileComplete: false
      };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, API_BASE_URL]);

  const updateUserProfile = useCallback(async (updateData: ProfileUpdateData): Promise<ApiResponse<UserProfile>> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        return {
          success: false,
          error: "Not authenticated",
          data: null,
          profileComplete: false
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/user/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update profile';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
        profileComplete: false
      };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, API_BASE_URL]);

  const uploadAvatar = useCallback(async (imageUri: string): Promise<ApiResponse<any>> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        return {
          success: false,
          error: "Not authenticated",
          data: null
        };
      }

      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/user/profile/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload avatar');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload avatar';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null
      };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, API_BASE_URL]);

  const removeAvatar = useCallback(async (): Promise<ApiResponse<UserProfile>> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        return {
          success: false,
          error: "Not authenticated",
          data: null,
          profileComplete: false
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/user/profile/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove avatar');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to remove avatar';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
        profileComplete: false
      };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, API_BASE_URL]);

  const clearError = useCallback(() => setError(null), []);

  // Memoize return object to prevent recreating on every render
  return useMemo(() => ({
    createUser,
    checkUsername,
    getUserProfile,
    updateUserProfile,
    uploadAvatar,
    removeAvatar,
    isLoading,
    error,
    clearError
  }), [
    createUser,
    checkUsername,
    getUserProfile,
    updateUserProfile,
    uploadAvatar,
    removeAvatar,
    isLoading,
    error,
    clearError
  ]);
};