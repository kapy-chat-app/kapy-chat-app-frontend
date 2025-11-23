// lib/cache/ConversationCacheService.ts - FIXED VERSION
import * as SQLite from 'expo-sqlite';

export interface CachedConversation {
  _id: string;
  type: string;
  name?: string;
  description?: string;
  avatar?: string;
  participants_json: string;
  last_message_json?: string;
  last_activity: number;
  is_pinned: number;
  is_archived: number;
  unreadCount: number;
  created_at: number;
  updated_at: number;
}

class ConversationCacheService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // ✅ Prevent multiple simultaneous initializations
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing ConversationCacheService...');
      
      this.db = await SQLite.openDatabaseAsync('kapy_conversations_cache.db');

      // ✅ Execute table creation one by one to avoid issues
      await this.db.execAsync(`PRAGMA journal_mode = WAL;`);
      
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS conversations (
          _id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT,
          description TEXT,
          avatar TEXT,
          participants_json TEXT NOT NULL,
          last_message_json TEXT,
          last_activity INTEGER,
          is_pinned INTEGER DEFAULT 0,
          is_archived INTEGER DEFAULT 0,
          unreadCount INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);
      
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_conversations_activity 
          ON conversations(is_pinned DESC, last_activity DESC);
      `);
      
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS decrypted_previews (
          message_id TEXT PRIMARY KEY,
          decrypted_content TEXT,
          created_at INTEGER
        );
      `);

      this.initialized = true;
      console.log('✅ ConversationCacheService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize ConversationCacheService:', error);
      this.initialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  async getConversations(): Promise<CachedConversation[]> {
    await this.initialize();
    if (!this.db) return [];

    try {
      const result = await this.db.getAllAsync<CachedConversation>(
        `SELECT * FROM conversations 
         WHERE is_archived = 0 
         ORDER BY is_pinned DESC, last_activity DESC`
      );
      return result || [];
    } catch (error) {
      console.error('❌ Failed to get conversations:', error);
      return [];
    }
  }

  async saveConversations(conversations: CachedConversation[]): Promise<void> {
    await this.initialize();
    if (!this.db || conversations.length === 0) return;

    try {
      console.log(`💾 Saving ${conversations.length} conversations to cache...`);
      
      // ✅ Use transaction for batch insert
      await this.db.withTransactionAsync(async () => {
        for (const conv of conversations) {
          await this.db!.runAsync(
            `INSERT OR REPLACE INTO conversations 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              conv._id, 
              conv.type, 
              conv.name || null, 
              conv.description || null,
              conv.avatar || null, 
              conv.participants_json, 
              conv.last_message_json || null,
              conv.last_activity, 
              conv.is_pinned, 
              conv.is_archived,
              conv.unreadCount, 
              conv.created_at, 
              conv.updated_at
            ]
          );
        }
      });
      
      console.log(`✅ Saved ${conversations.length} conversations to cache`);
    } catch (error) {
      console.error('❌ Failed to save conversations:', error);
    }
  }

  async updateConversation(conversationId: string, updates: Partial<CachedConversation>): Promise<void> {
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
      values.push(conversationId);
      await this.db.runAsync(
        `UPDATE conversations SET ${setClauses.join(', ')} WHERE _id = ?`,
        values
      );
    } catch (error) {
      console.error('❌ Failed to update conversation:', error);
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    
    try {
      await this.db.runAsync(
        `DELETE FROM conversations WHERE _id = ?`,
        [conversationId]
      );
      console.log(`✅ Deleted conversation ${conversationId} from cache`);
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
    }
  }

  async saveDecryptedPreview(messageId: string, content: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO decrypted_previews VALUES (?, ?, ?)`,
        [messageId, content, Date.now()]
      );
    } catch (error) {
      console.error('❌ Failed to save preview:', error);
    }
  }

  async getDecryptedPreview(messageId: string): Promise<string | null> {
    await this.initialize();
    if (!this.db) return null;
    
    try {
      const result = await this.db.getFirstAsync<{ decrypted_content: string }>(
        `SELECT decrypted_content FROM decrypted_previews WHERE message_id = ?`,
        [messageId]
      );
      return result?.decrypted_content || null;
    } catch (error) {
      console.error('❌ Failed to get preview:', error);
      return null;
    }
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    if (!this.db) return;
    
    try {
      await this.db.execAsync(`DELETE FROM conversations;`);
      await this.db.execAsync(`DELETE FROM decrypted_previews;`);
      console.log('✅ All conversation cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  async getStats(): Promise<{ totalConversations: number; totalPreviews: number }> {
    await this.initialize();
    if (!this.db) return { totalConversations: 0, totalPreviews: 0 };
    
    try {
      const convResult = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM conversations`
      );
      const previewResult = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM decrypted_previews`
      );
      return {
        totalConversations: convResult?.count || 0,
        totalPreviews: previewResult?.count || 0,
      };
    } catch (error) {
      return { totalConversations: 0, totalPreviews: 0 };
    }
  }
}

export const conversationCacheService = new ConversationCacheService();