// lib/cache/MessageCacheService.ts
import * as SQLite from 'expo-sqlite';

// =============================================
// TYPES
// =============================================

export interface CachedMessage {
  _id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  type: string;
  attachments_json: string;
  reactions_json: string;
  read_by_json: string;
  reply_to_json?: string;
  metadata_json?: string; // ✨ NEW
  is_edited: number;
  created_at: number;
  updated_at: number;
  rich_media_json?: string;
}

export interface ConversationMeta {
  conversation_id: string;
  last_sync_time: number;
  total_cached: number;
  last_message_id: string;
}

// =============================================
// SERVICE
// =============================================

class MessageCacheService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync('kapy_messages_cache.db');

      await this.db.execAsync(`
        PRAGMA journal_mode = WAL;
        
        CREATE TABLE IF NOT EXISTS messages (
          _id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT,
          sender_name TEXT,
          sender_avatar TEXT,
          content TEXT,
          type TEXT,
          attachments_json TEXT,
          reactions_json TEXT,
          read_by_json TEXT,
          reply_to_json TEXT,
          metadata_json TEXT,
          is_edited INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER,
          rich_media_json TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
          ON messages(conversation_id, created_at DESC);
        
        CREATE TABLE IF NOT EXISTS conversation_meta (
          conversation_id TEXT PRIMARY KEY,
          last_sync_time INTEGER,
          total_cached INTEGER,
          last_message_id TEXT
        );
        
        CREATE TABLE IF NOT EXISTS decrypted_files (
          file_id TEXT PRIMARY KEY,
          decrypted_uri TEXT,
          file_type TEXT,
          created_at INTEGER
        );
      `);

      // ✨ Migration: Add metadata_json column if it doesn't exist
      await this.migrateDatabase();

      this.initialized = true;
      console.log('✅ MessageCacheService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MessageCacheService:', error);
      throw error;
    }
  }

  // ✨ NEW: Migration function
  private async migrateDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      // Check if metadata_json column exists
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(messages)`
      );
      
      const hasMetadataColumn = tableInfo.some(col => col.name === 'metadata_json');
      
      if (!hasMetadataColumn) {
        console.log('🔄 Running migration: Adding metadata_json column...');
        await this.db.execAsync(`ALTER TABLE messages ADD COLUMN metadata_json TEXT`);
        console.log('✅ Migration complete: metadata_json column added');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }

  async getMessages(
    conversationId: string,
    limit: number = 50,
    beforeTimestamp?: number
  ): Promise<CachedMessage[]> {
    if (!this.db) await this.initialize();

    let query = `SELECT * FROM messages WHERE conversation_id = ?`;
    const params: any[] = [conversationId];

    if (beforeTimestamp) {
      query += ` AND created_at < ?`;
      params.push(beforeTimestamp);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    try {
      return await this.db!.getAllAsync<CachedMessage>(query, params);
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  async saveMessages(messages: CachedMessage[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (messages.length === 0) return;

    try {
      // ✨ UPDATED: Add metadata_json to statement (16 parameters now)
      const stmt = await this.db!.prepareAsync(`
        INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        for (const msg of messages) {
          await stmt.executeAsync([
            msg._id, 
            msg.conversation_id, 
            msg.sender_id, 
            msg.sender_name,
            msg.sender_avatar || null, 
            msg.content, 
            msg.type, 
            msg.attachments_json,
            msg.reactions_json, 
            msg.read_by_json, 
            msg.reply_to_json || null,
            msg.metadata_json || null, // ✨ NEW
            msg.is_edited, 
            msg.created_at, 
            msg.updated_at, 
            msg.rich_media_json || null,
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
      console.log(`✅ Saved ${messages.length} messages to cache`);
    } catch (error) {
      console.error('❌ Failed to save messages:', error);
    }
  }

  async updateMessage(messageId: string, updates: Partial<CachedMessage>): Promise<void> {
    if (!this.db) await this.initialize();

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
      values.push(messageId);
      await this.db!.runAsync(
        `UPDATE messages SET ${setClauses.join(', ')} WHERE _id = ?`,
        values
      );
    } catch (error) {
      console.error('❌ Failed to update message:', error);
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!this.db) await this.initialize();
    try {
      await this.db!.runAsync(`DELETE FROM messages WHERE _id = ?`, [messageId]);
    } catch (error) {
      console.error('❌ Failed to delete message:', error);
    }
  }

  async getConversationMeta(conversationId: string): Promise<ConversationMeta | null> {
    if (!this.db) await this.initialize();
    try {
      return await this.db!.getFirstAsync<ConversationMeta>(
        `SELECT * FROM conversation_meta WHERE conversation_id = ?`,
        [conversationId]
      ) || null;
    } catch (error) {
      return null;
    }
  }

  async updateConversationMeta(meta: ConversationMeta): Promise<void> {
    if (!this.db) await this.initialize();
    try {
      await this.db!.runAsync(
        `INSERT OR REPLACE INTO conversation_meta VALUES (?, ?, ?, ?)`,
        [meta.conversation_id, meta.last_sync_time, meta.total_cached, meta.last_message_id]
      );
    } catch (error) {
      console.error('❌ Failed to update meta:', error);
    }
  }

  async saveDecryptedFile(fileId: string, uri: string, type: string): Promise<void> {
    if (!this.db) await this.initialize();
    try {
      await this.db!.runAsync(
        `INSERT OR REPLACE INTO decrypted_files VALUES (?, ?, ?, ?)`,
        [fileId, uri, type, Date.now()]
      );
    } catch (error) {
      console.error('❌ Failed to save file:', error);
    }
  }

  async getDecryptedFile(fileId: string): Promise<string | null> {
    if (!this.db) await this.initialize();
    try {
      const result = await this.db!.getFirstAsync<{ decrypted_uri: string }>(
        `SELECT decrypted_uri FROM decrypted_files WHERE file_id = ?`,
        [fileId]
      );
      return result?.decrypted_uri || null;
    } catch (error) {
      return null;
    }
  }

  async clearConversation(conversationId: string): Promise<void> {
    if (!this.db) await this.initialize();
    try {
      await this.db!.runAsync(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);
      await this.db!.runAsync(`DELETE FROM conversation_meta WHERE conversation_id = ?`, [conversationId]);
    } catch (error) {
      console.error('❌ Failed to clear conversation:', error);
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.initialize();
    try {
      await this.db!.execAsync(`DELETE FROM messages; DELETE FROM conversation_meta; DELETE FROM decrypted_files;`);
      console.log('✅ All cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }
}

export const messageCacheService = new MessageCacheService();