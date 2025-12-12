// hooks/message/useMessageInfo.ts
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';

interface MediaItem {
  _id: string;
  sender: {
    _id: string;
    clerkId: string;
    full_name: string;
    username: string;
    avatar?: string;
  };
  attachments: {
    _id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    url: string;
  }[];
  created_at: string;
  type: string;
}

interface SearchResult {
  _id: string;
  sender: {
    _id: string;
    clerkId: string;
    full_name: string;
    username: string;
    avatar?: string;
  };
  content: string;
  attachments?: {
    _id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    url: string;
  }[];
  created_at: string;
}

interface GroupMember {
  clerkId: string;
  full_name: string;
  username: string;
  email?: string;
  avatar: string | null;
  is_online: boolean;
  last_seen: string;
  isAdmin: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  isCurrentUser: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface GroupHistoryItem {
  _id: string;
  sender: {
    _id: string;
    clerkId: string;
    full_name: string;
    username: string;
    avatar?: string;
  };
  content: string;
  metadata: {
    isSystemMessage: boolean;
    action: string;
    [key: string]: any;
  };
  created_at: string;
}


// ============================================
// HOOK: useConversationMedia
// ============================================
export const useConversationMedia = (conversationId: string) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentType, setCurrentType] = useState<'image' | 'video' | 'file' | 'audio'>('image');

  const { getToken } = useAuth();
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );

  const loadMedia = useCallback(
    async (mediaType: 'image' | 'video' | 'file' | 'audio', reset = false) => {
      if (loading || !conversationId) return;

      if (mediaType !== currentType) {
        setMedia([]);
        setPage(1);
        setHasMore(true);
        setCurrentType(mediaType);
      }

      const currentPage = reset ? 1 : page;

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/media?type=${mediaType}&page=${currentPage}&limit=20`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to load media');
        }

        const newMedia = result.data?.messages || [];
        const pagination: PaginationInfo = result.data?.pagination;

        if (reset) {
          setMedia(newMedia);
          setPage(2);
        } else {
          setMedia((prev) => [...prev, ...newMedia]);
          setPage((prev) => prev + 1);
        }

        setHasMore(pagination?.hasMore || false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load media';
        setError(errorMessage);
        console.error('Error loading media:', err);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, page, loading, currentType, API_BASE_URL, getToken]
  );

  const loadMore = useCallback(
    (type: 'image' | 'video' | 'file' | 'audio') => {
      if (hasMore && !loading) {
        loadMedia(type, false);
      }
    },
    [hasMore, loading, loadMedia]
  );

  const refresh = useCallback(
    (type: 'image' | 'video' | 'file' | 'audio') => {
      setMedia([]);
      setPage(1);
      setHasMore(true);
      loadMedia(type, true);
    },
    [loadMedia]
  );

  const reset = useCallback(() => {
    setMedia([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    media,
    loading,
    hasMore,
    error,
    loadMedia,
    loadMore,
    refresh,
    reset,
  };
};

// ============================================
// HOOK: useSearchMessages
// ============================================
export const useSearchMessages = (conversationId: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { getToken } = useAuth();
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );

  const search = useCallback(
    async (query: string, reset = true): Promise<SearchResult[]> => {
      if (loading || !conversationId) return [];

      try {
        setLoading(true);
        setError(null);

        if (!query || query.trim().length < 2) {
          setResults([]);
          setSearchQuery('');
          return [];
        }

        const currentPage = reset ? 1 : page;
        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/search?q=${encodeURIComponent(query.trim())}&page=${currentPage}&limit=20`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Search failed');
        }

        const newResults = result.data?.messages || [];
        const pagination: PaginationInfo = result.data?.pagination;

        setSearchQuery(query);

        if (reset) {
          setResults(newResults);
          setPage(2);
        } else {
          setResults((prev) => [...prev, ...newResults]);
          setPage((prev) => prev + 1);
        }

        setHasMore(pagination?.hasMore || false);
        return newResults;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        console.error('Error searching messages:', err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [conversationId, page, loading, API_BASE_URL, getToken]
  );

  const loadMore = useCallback(() => {
    if (hasMore && !loading && searchQuery) {
      search(searchQuery, false);
    }
  }, [hasMore, loading, searchQuery, search]);

  const reset = useCallback(() => {
    setResults([]);
    setPage(1);
    setHasMore(false);
    setError(null);
    setSearchQuery('');
  }, []);

  return {
    results,
    loading,
    hasMore,
    error,
    searchQuery,
    search,
    loadMore,
    reset,
  };
};
export const useGroupHistory = (conversationId: string) => {
  const [history, setHistory] = useState<GroupHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { getToken } = useAuth();
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );

  const loadHistory = useCallback(async (reset = false) => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 1 : page;
      const token = await getToken();
      const url = `${API_BASE_URL}/api/conversations/${conversationId}/history?page=${currentPage}&limit=50`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load group history');
      }

      const messages = result.data?.systemMessages || [];
      const pagination = result.data?.pagination;

      if (reset) {
        setHistory(messages);
        setPage(2);
      } else {
        setHistory((prev) => [...prev, ...messages]);
        setPage((prev) => prev + 1);
      }

      setHasMore(pagination?.hasMore || false);

      console.log(`✅ Loaded ${messages.length} group history items`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load group history';
      setError(errorMessage);
      console.error('Error loading group history:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, page, API_BASE_URL, getToken]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadHistory(false);
    }
  }, [hasMore, loading, loadHistory]);

  const refresh = useCallback(() => {
    setHistory([]);
    setPage(1);
    setHasMore(false);
    loadHistory(true);
  }, [loadHistory]);

  return {
    history,
    loading,
    hasMore,
    error,
    loadHistory: () => loadHistory(true),
    loadMore,
    refresh,
  };
};
// ============================================
// HOOK: useGroupMembers
// ============================================
export const useGroupMembers = (conversationId: string) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [conversationInfo, setConversationInfo] = useState<any>(null);

  const { getToken } = useAuth();
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );

  const loadMembers = useCallback(async () => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      const url = `${API_BASE_URL}/api/conversations/${conversationId}/members`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load members');
      }

      setMembers(result.data.members || []);
      setAdmin(result.data.admin);
      setConversationInfo({
        id: result.data.conversationId,
        type: result.data.conversationType,
        name: result.data.conversationName,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load members';
      setError(errorMessage);
      console.error('Error loading members:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, API_BASE_URL, getToken]);

  return {
    members,
    admin,
    conversationInfo,
    loading,
    error,
    loadMembers,
    refresh: loadMembers,
  };
};

// ============================================
// HOOK: useConversationActions
// ============================================
export const useConversationActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<{ success: boolean; error?: string }> => {
      if (!conversationId) {
        return { success: false, error: 'Conversation ID is required' };
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete conversation');
        }

        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
        setError(errorMessage);
        console.error('Error deleting conversation:', err);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL, getToken]
  );

  const leaveGroup = useCallback(
    async (conversationId: string): Promise<{ success: boolean; error?: string; data?: any }> => {
      if (!conversationId) {
        return { success: false, error: 'Conversation ID is required' };
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/leave`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to leave group');
        }

        return { success: true, data: result.data };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to leave group';
        setError(errorMessage);
        console.error('Error leaving group:', err);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL, getToken]
  );

  const updateGroupAvatar = useCallback(
    async (conversationId: string, imageUri: string): Promise<{ success: boolean; error?: string; data?: any }> => {
      if (!conversationId || !imageUri) {
        return { success: false, error: 'Conversation ID and image are required' };
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        
        // Create FormData
        const formData = new FormData();
        const filename = imageUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('avatar', {
          uri: imageUri,
          name: filename,
          type,
        } as any);

        const url = `${API_BASE_URL}/api/conversations/${conversationId}/avatar`;

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to update avatar');
        }

        return { success: true, data: result.data };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update avatar';
        setError(errorMessage);
        console.error('Error updating avatar:', err);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL, getToken]
  );

  const addParticipants = useCallback(
    async (conversationId: string, participantIds: string[]): Promise<{ success: boolean; error?: string; data?: any }> => {
      if (!conversationId || !participantIds.length) {
        return { success: false, error: 'Conversation ID and participant IDs are required' };
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/add`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ participantIds }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to add participants');
        }

        return { success: true, data: result.data };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add participants';
        setError(errorMessage);
        console.error('Error adding participants:', err);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL, getToken]
  );

  const removeParticipant = useCallback(
    async (conversationId: string, participantId: string): Promise<{ success: boolean; error?: string; data?: any }> => {
      if (!conversationId || !participantId) {
        return { success: false, error: 'Conversation ID and participant ID are required' };
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/remove?participantId=${participantId}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to remove participant');
        }

        return { success: true, data: result.data };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove participant';
        setError(errorMessage);
        console.error('Error removing participant:', err);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL, getToken]
  );

  const transferAdmin = useCallback(
    async (conversationId: string, newAdminId: string): Promise<{ success: boolean; error?: string; data?: any }> => {
      if (!conversationId || !newAdminId) {
        return { success: false, error: 'Conversation ID and new admin ID are required' };
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const url = `${API_BASE_URL}/api/conversations/${conversationId}/transfer-admin`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ newAdminId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to transfer admin');
        }

        return { success: true, data: result.data };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to transfer admin';
        setError(errorMessage);
        console.error('Error transferring admin:', err);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [API_BASE_URL, getToken]
  );

  return {
    loading,
    error,
    deleteConversation,
    leaveGroup,
    updateGroupAvatar,
    addParticipants,
    removeParticipant,
    transferAdmin,
  };
};