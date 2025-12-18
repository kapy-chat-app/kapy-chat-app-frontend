// src/hooks/useGames.ts

import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// ============================================
// TYPES
// ============================================
export interface Game {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  rating: number;
  plays: number;
  embedUrl: string;
  gameUrl: string;
}

export interface FilterOptions {
  category?: string;
  search?: string;
  sort?: "title" | "rating" | "popular";
}

// ============================================
// MAIN HOOK
// ============================================
export const useGames = (initialFilters: FilterOptions = {}) => {
  // States
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);

  // ============================================
  // API: GET GAMES
  // ============================================
  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const queryParams = new URLSearchParams();
      if (filters.category && filters.category !== "all") {
        queryParams.append("category", filters.category);
      }
      if (filters.search) {
        queryParams.append("search", filters.search);
      }
      if (filters.sort) {
        queryParams.append("sort", filters.sort);
      }

      // Nếu cần authentication
      // const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/games?${queryParams.toString()}`,
        {
          // headers: {
          //   Authorization: `Bearer ${token}`,
          //   'Content-Type': 'application/json',
          // },
        }
      );

      if (response.data.success) {
        setGames(response.data.data || []);
      } else {
        setError(response.data.error || "Failed to fetch games");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch games");
      console.error("❌ Error fetching games:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  // ============================================
  // API: GET CATEGORIES
  // ============================================
  // src/hooks/useGames.ts

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/games/categories`);

      if (response.data.success) {
        setCategories(["all", ...(response.data.data || [])]);
      } else {
        // Set default categories nếu fail (dựa trên data thực tế)
        setCategories([
          "all",
          "Arcade",
          "Matching",
          "Multiplayer",
          "Climb",
          "Racing",
          "Casual",
          "Sport",
          "Puzzle",
          "Agility",
          "Dress-up",
          "Cooking",
        ]);
      }
    } catch (err: any) {
      console.error("❌ Error fetching categories:", err);
      // Set default categories (dựa trên data thực tế)
      setCategories([
        "all",
        "Arcade",
        "Matching",
        "Multiplayer",
        "Climb",
        "Racing",
        "Casual",
        "Sport",
        "Puzzle",
        "Agility",
        "Dress-up",
        "Cooking",
      ]);
    }
  }, []);

  // ============================================
  // API: GET GAME BY SLUG
  // ============================================
  const getGameBySlug = useCallback(
    async (slug: string): Promise<Game | null> => {
      try {
        const response = await axios.get(`${API_URL}/api/games/${slug}`);

        if (response.data.success) {
          return response.data.data;
        } else {
          console.error("Game not found:", response.data.error);
          return null;
        }
      } catch (err: any) {
        console.error("❌ Error fetching game:", err);
        return null;
      }
    },
    []
  );

  // ============================================
  // API: PLAY GAME (Track & Get Embed URL)
  // ============================================
  const playGame = useCallback(
    async (slug: string, userId?: string): Promise<string | null> => {
      try {
        const response = await axios.post(
          `${API_URL}/api/games/${slug}/play`,
          {
            userId,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          return response.data.data.embedUrl;
        } else {
          console.error("Failed to load game:", response.data.error);
          return null;
        }
      } catch (err: any) {
        console.error("❌ Error playing game:", err);
        return null;
      }
    },
    []
  );

  // ============================================
  // API: GET FEATURED GAMES
  // ============================================
  const getFeaturedGames = useCallback(async (limit: number = 10) => {
    try {
      const response = await axios.get(`${API_URL}/api/games/featured`, {
        params: { limit },
      });

      if (response.data.success) {
        return response.data.data || [];
      } else {
        return [];
      }
    } catch (err: any) {
      console.error("❌ Error fetching featured games:", err);
      return [];
    }
  }, []);

  // ============================================
  // ACTIONS
  // ============================================
  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchGames();
  }, [fetchGames]);

  const updateFilters = useCallback((newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const changeCategory = useCallback((category: string) => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const searchGames = useCallback((searchQuery: string) => {
    setFilters((prev) => ({ ...prev, search: searchQuery }));
  }, []);

  // ============================================
  // COMPUTED DATA
  // ============================================
  const selectedCategory = useMemo(() => {
    return filters.category || "all";
  }, [filters.category]);

  const topGames = useMemo(() => {
    return games.slice(0, 10);
  }, [games]);

  const gamesByCategory = useMemo(() => {
    const grouped: { [key: string]: number } = {};
    games.forEach((game) => {
      grouped[game.category] = (grouped[game.category] || 0) + 1;
    });
    return grouped;
  }, [games]);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ============================================
  // RETURN
  // ============================================
  return {
    // Raw data
    games,
    categories,

    // Loading states
    loading,
    refreshing,
    error,

    // Filters
    filters,
    selectedCategory,
    updateFilters,
    clearFilters,
    changeCategory,
    searchGames,

    // Actions
    refresh,
    getGameBySlug,
    playGame,
    getFeaturedGames,

    // Computed data
    topGames,
    gamesByCategory,
  };
};
