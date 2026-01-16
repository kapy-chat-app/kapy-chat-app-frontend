// lib/encryption/KeyCacheService.ts
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'encryption_key_';
const MY_KEY_STORE = 'e2ee_master_key';

export class KeyCacheService {
  private static memoryCache = new Map<string, string>();
  private static failedFetches = new Set<string>(); // ✅ Track failed fetches

  /**
   * Get my own encryption key
   */
  static async getMyKey(): Promise<string | null> {
    try {
      const cached = this.memoryCache.get('my_key');
      if (cached) {
        console.log('✅ [KeyCache] Using cached my key from memory');
        return cached;
      }

      const key = await SecureStore.getItemAsync(MY_KEY_STORE);
      if (key) {
        console.log('✅ [KeyCache] Loaded my key from SecureStore');
        this.memoryCache.set('my_key', key);
        return key;
      }

      console.warn('⚠️ [KeyCache] My key not found');
      return null;
    } catch (error) {
      console.error('❌ [KeyCache] Error getting my key:', error);
      return null;
    }
  }

  /**
   * Get cached key for a user
   */
  static async getKey(userId: string): Promise<string | null> {
    try {
      // Check memory cache first
      const cached = this.memoryCache.get(userId);
      if (cached) {
        console.log(`✅ [KeyCache] Using cached key for ${userId} from memory`);
        return cached;
      }

      // Check SecureStore
      const key = await SecureStore.getItemAsync(`${KEY_PREFIX}${userId}`);
      if (key) {
        console.log(`✅ [KeyCache] Loaded key for ${userId} from SecureStore`);
        this.memoryCache.set(userId, key);
        return key;
      }

      console.log(`⚠️ [KeyCache] No cached key for ${userId}`);
      return null;
    } catch (error) {
      console.error(`❌ [KeyCache] Error getting key for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Cache a user's key
   */
  static async setKey(userId: string, key: string): Promise<void> {
    try {
      this.memoryCache.set(userId, key);
      await SecureStore.setItemAsync(`${KEY_PREFIX}${userId}`, key);
      
      // ✅ Remove from failed fetches if successfully cached
      this.failedFetches.delete(userId);
      
      console.log(`✅ [KeyCache] Cached key for ${userId}`);
    } catch (error) {
      console.error(`❌ [KeyCache] Error caching key for ${userId}:`, error);
    }
  }

  /**
   * Fetch and cache keys for multiple users
   */
  static async prefetchKeys(
    userIds: string[],
    getToken: () => Promise<string | null>,
    apiBaseUrl: string
  ): Promise<void> {
    console.log(`🔄 [KeyCache] Prefetching keys for ${userIds.length} users...`);

    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    // ✅ Filter out users we've already failed to fetch
    const usersToFetch = userIds.filter(userId => {
      if (this.failedFetches.has(userId)) {
        console.log(`⏭️ [KeyCache] Skipping ${userId} - previous fetch failed`);
        return false;
      }
      return true;
    });

    if (usersToFetch.length === 0) {
      console.log('⏭️ [KeyCache] No users to prefetch (all previously failed)');
      return;
    }

    // Fetch all keys in parallel
    const results = await Promise.allSettled(
      usersToFetch.map(async (userId) => {
        // Skip if already cached
        const cached = await this.getKey(userId);
        if (cached) {
          console.log(`⏭️ [KeyCache] Key for ${userId} already cached`);
          return;
        }

        // Fetch from server
        console.log(`📡 [KeyCache] Fetching key for ${userId}...`);
        
        try {
          const response = await fetch(`${apiBaseUrl}/api/keys/${userId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          // ✅ Handle 404 gracefully
          if (response.status === 404) {
            console.warn(`⚠️ [KeyCache] User ${userId} has no encryption key yet`);
            this.failedFetches.add(userId);
            return; // Don't throw, just skip
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();
          if (!result.success || !result.data?.publicKey) {
            throw new Error(`Invalid key response`);
          }

          // Cache the key
          await this.setKey(userId, result.data.publicKey);
          console.log(`✅ [KeyCache] Cached key for ${userId}`);
        } catch (error: any) {
          // ✅ Mark as failed and log warning instead of error
          this.failedFetches.add(userId);
          console.warn(`⚠️ [KeyCache] Failed to fetch key for ${userId}:`, error.message);
          // Don't re-throw - we want prefetch to continue for other users
        }
      })
    );

    // Log results
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ [KeyCache] Prefetch complete: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Clear failed fetches cache (call when users might have set up encryption)
   */
  static clearFailedFetches(): void {
    this.failedFetches.clear();
    console.log('✅ [KeyCache] Cleared failed fetches cache');
  }

  /**
   * Clear all cached keys
   */
  static async clearAll(): Promise<void> {
    console.log('🧹 [KeyCache] Clearing all cached keys...');
    this.memoryCache.clear();
    this.failedFetches.clear();
    console.log('✅ [KeyCache] Memory cache cleared');
  }

  /**
   * Clear cache for specific user
   */
  static async clearKey(userId: string): Promise<void> {
    try {
      this.memoryCache.delete(userId);
      this.failedFetches.delete(userId);
      await SecureStore.deleteItemAsync(`${KEY_PREFIX}${userId}`);
      console.log(`✅ [KeyCache] Cleared key for ${userId}`);
    } catch (error) {
      console.error(`❌ [KeyCache] Error clearing key for ${userId}:`, error);
    }
  }
}