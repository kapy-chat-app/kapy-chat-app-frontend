// lib/cache/FriendsCacheService.ts
import * as SQLite from 'expo-sqlite';

export interface CachedFriend {
  id: string;
  clerkId: string;
  username: string;
  full_name: string;
  avatar?: string;
  is_online: number; // SQLite doesn't support boolean
  last_seen?: number;
  mutualFriendsCount: number;
  friendshipDate: number;
}

export interface CachedFriendRequest {
  id: string;
  requester_json: string; // JSON stringified requester object
  created_at: number;
}

class FriendsCacheService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing FriendsCacheService...');
      
      this.db = await SQLite.openDatabaseAsync('kapy_friends_cache.db');

      await this.db.execAsync(`PRAGMA journal_mode = WAL;`);
      
      // Friends table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS friends (
          id TEXT PRIMARY KEY,
          clerkId TEXT NOT NULL,
          username TEXT NOT NULL,
          full_name TEXT NOT NULL,
          avatar TEXT,
          is_online INTEGER DEFAULT 0,
          last_seen INTEGER,
          mutualFriendsCount INTEGER DEFAULT 0,
          friendshipDate INTEGER NOT NULL,
          updated_at INTEGER
        );
      `);
      
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_friends_name 
          ON friends(full_name ASC);
      `);
      
      // Friend requests table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS friend_requests (
          id TEXT PRIMARY KEY,
          requester_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER
        );
      `);
      
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_requests_created 
          ON friend_requests(created_at DESC);
      `);

      this.initialized = true;
      console.log('✅ FriendsCacheService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize FriendsCacheService:', error);
      this.initialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  // ============= FRIENDS =============
  async getFriends(): Promise<CachedFriend[]> {
    await this.initialize();
    if (!this.db) return [];

    try {
      const result = await this.db.getAllAsync<CachedFriend>(
        `SELECT * FROM friends ORDER BY full_name ASC`
      );
      return result || [];
    } catch (error) {
      console.error('❌ Failed to get friends:', error);
      return [];
    }
  }

  async saveFriends(friends: CachedFriend[]): Promise<void> {
    await this.initialize();
    if (!this.db || friends.length === 0) return;

    try {
      console.log(`💾 Saving ${friends.length} friends to cache...`);
      
      await this.db.withTransactionAsync(async () => {
        for (const friend of friends) {
          await this.db!.runAsync(
            `INSERT OR REPLACE INTO friends 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              friend.id,
              friend.clerkId,
              friend.username,
              friend.full_name,
              friend.avatar || null,
              friend.is_online,
              friend.last_seen || null,
              friend.mutualFriendsCount,
              friend.friendshipDate,
              Date.now()
            ]
          );
        }
      });
      
      console.log(`✅ Saved ${friends.length} friends to cache`);
    } catch (error) {
      console.error('❌ Failed to save friends:', error);
    }
  }

  async updateFriend(friendId: string, updates: Partial<CachedFriend>): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    const setClauses: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (setClauses.length === 0) return;

    try {
      values.push(friendId);
      await this.db.runAsync(
        `UPDATE friends SET ${setClauses.join(', ')}, updated_at = ? WHERE id = ?`,
        [...values, Date.now(), friendId]
      );
    } catch (error) {
      console.error('❌ Failed to update friend:', error);
    }
  }

  async deleteFriend(friendId: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    
    try {
      await this.db.runAsync(`DELETE FROM friends WHERE id = ?`, [friendId]);
      console.log(`✅ Deleted friend ${friendId} from cache`);
    } catch (error) {
      console.error('❌ Failed to delete friend:', error);
    }
  }

  // ============= FRIEND REQUESTS =============
  async getFriendRequests(): Promise<CachedFriendRequest[]> {
    await this.initialize();
    if (!this.db) return [];

    try {
      const result = await this.db.getAllAsync<CachedFriendRequest>(
        `SELECT * FROM friend_requests ORDER BY created_at DESC`
      );
      return result || [];
    } catch (error) {
      console.error('❌ Failed to get friend requests:', error);
      return [];
    }
  }

  async saveFriendRequests(requests: CachedFriendRequest[]): Promise<void> {
    await this.initialize();
    if (!this.db || requests.length === 0) return;

    try {
      console.log(`💾 Saving ${requests.length} friend requests to cache...`);
      
      await this.db.withTransactionAsync(async () => {
        for (const request of requests) {
          await this.db!.runAsync(
            `INSERT OR REPLACE INTO friend_requests VALUES (?, ?, ?, ?)`,
            [
              request.id,
              request.requester_json,
              request.created_at,
              Date.now()
            ]
          );
        }
      });
      
      console.log(`✅ Saved ${requests.length} friend requests to cache`);
    } catch (error) {
      console.error('❌ Failed to save friend requests:', error);
    }
  }

  async deleteFriendRequest(requestId: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    
    try {
      await this.db.runAsync(`DELETE FROM friend_requests WHERE id = ?`, [requestId]);
      console.log(`✅ Deleted friend request ${requestId} from cache`);
    } catch (error) {
      console.error('❌ Failed to delete friend request:', error);
    }
  }

  // ============= UTILITIES =============
  async clearAll(): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    
    try {
      await this.db.execAsync(`DELETE FROM friends;`);
      await this.db.execAsync(`DELETE FROM friend_requests;`);
      console.log('✅ All friends cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  async getStats(): Promise<{ totalFriends: number; totalRequests: number }> {
    await this.initialize();
    if (!this.db) return { totalFriends: 0, totalRequests: 0 };
    
    try {
      const friendsResult = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM friends`
      );
      const requestsResult = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM friend_requests`
      );
      return {
        totalFriends: friendsResult?.count || 0,
        totalRequests: requestsResult?.count || 0,
      };
    } catch (error) {
      return { totalFriends: 0, totalRequests: 0 };
    }
  }
}

export const friendsCacheService = new FriendsCacheService();