// hooks/message/useGiphy.ts
import { useAuth } from "@clerk/clerk-expo";
import { useState, useCallback, useMemo } from "react";

interface GiphyItem {
  id: string;
  url: string;
  title: string;
  rating: string;
  images: {
    original: {
      url: string;
      width: number;
      height: number;
      size: number;
    };
    preview_gif?: {
      url: string;
      width: number;
      height: number;
    };
    fixed_width?: {
      url: string;
      width: number;
      height: number;
    };
    fixed_height?: {
      url: string;
      width: number;
      height: number;
    };
    downsized?: {
      url: string;
      width: number;
      height: number;
      size: number;
    };
  };
  tags?: string[];
}

interface GiphyResponse {
  items: GiphyItem[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
}

export interface RichMediaDTO {
  provider: "giphy" | "tenor" | "custom" | string;
  provider_id: string;
  url: string;
  media_url: string;
  preview_url?: string;
  width: number;
  height: number;
  size?: number;
  title?: string;
  rating?: string;
  tags?: string[];
  source_url?: string;
  extra_data?: Record<string, any>;
}

export const useGiphy = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );

  // Search GIFs
  const searchGifs = useCallback(
    async (
      query: string,
      limit: number = 25,
      offset: number = 0
    ): Promise<GiphyResponse | null> => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/giphy/search?query=${encodeURIComponent(query)}&type=gif&limit=${limit}&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to search GIFs");
        }

        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to search GIFs";
        setError(errorMessage);
        console.error("❌ Error searching GIFs:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Search Stickers
  const searchStickers = useCallback(
    async (
      query: string,
      limit: number = 25,
      offset: number = 0
    ): Promise<GiphyResponse | null> => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/giphy/search?query=${encodeURIComponent(query)}&type=sticker&limit=${limit}&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to search Stickers");
        }

        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to search Stickers";
        setError(errorMessage);
        console.error("❌ Error searching Stickers:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Get Trending GIFs
  const getTrendingGifs = useCallback(
    async (limit: number = 25, offset: number = 0): Promise<GiphyResponse | null> => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/giphy/trending?type=gif&limit=${limit}&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to get trending GIFs");
        }

        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get trending GIFs";
        setError(errorMessage);
        console.error("❌ Error getting trending GIFs:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Get Trending Stickers
  const getTrendingStickers = useCallback(
    async (limit: number = 25, offset: number = 0): Promise<GiphyResponse | null> => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/giphy/trending?type=sticker&limit=${limit}&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to get trending Stickers");
        }

        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get trending Stickers";
        setError(errorMessage);
        console.error("❌ Error getting trending Stickers:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, API_BASE_URL]
  );

  // Helper: Convert Giphy item to RichMedia
  const giphyToRichMedia = useCallback((giphyItem: GiphyItem, type: "gif" | "sticker"): RichMediaDTO => {
    return {
      provider: "giphy",
      provider_id: giphyItem.id,
      url: giphyItem.url,
      media_url: giphyItem.images.original.url,
      preview_url:
        giphyItem.images.preview_gif?.url ||
        giphyItem.images.fixed_width?.url ||
        giphyItem.images.downsized?.url ||
        giphyItem.images.original.url,
      width: giphyItem.images.original.width,
      height: giphyItem.images.original.height,
      size: giphyItem.images.original.size,
      title: giphyItem.title,
      rating: giphyItem.rating,
      tags: giphyItem.tags,
      source_url: giphyItem.url,
    };
  }, []);

  return {
    loading,
    error,
    searchGifs,
    searchStickers,
    getTrendingGifs,
    getTrendingStickers,
    giphyToRichMedia,
  };
};