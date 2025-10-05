// hooks/useContacts.ts
import { useState, useCallback, useMemo } from 'react';

export interface Contact {
  _id: string;
  clerkId: string;
  full_name: string;
  username: string;
  email?: string;
  avatar?: {
    url: string;
    name: string;
    type: string;
  };
  is_online: boolean;
  last_seen?: Date;
}

interface UseContactsReturn {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  searchResults: Contact[];
  searchLoading: boolean;
  searchUsers: (query: string) => Promise<Contact[]>;
  clearSearchResults: () => void;
}

export const useContacts = (): UseContactsReturn => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );
  const searchUsers = useCallback(async (query: string): Promise<Contact[]> => {
   
    try {
      setSearchLoading(true);
      setError(null);
      
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query.trim())}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }

      const results = result.data || [];
      setSearchResults(results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      console.error('Error searching users:', err);
      return [];
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    contacts,
    loading,
    error,
    searchResults,
    searchLoading,
    searchUsers,
    clearSearchResults,
  };
};