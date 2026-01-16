// lib/cache/MessageCacheService.ts
// ✅ COMPLETE VERSION - Synced with KapyCacheModule.kt v3

import { NativeCacheBridge } from '../encryption/NativeEncryptionBridge';

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
  encrypted_content?: string; // ✅ NEW
  type: string;
  attachments_json: string;
  reactions_json: string;
  read_by_json: string;
  reply_to_json?: string;
  metadata_json?: string;
  rich_media_json?: string;
  is_edited: number;
  created_at: number;
  updated_at: number;
}

export interface ConversationMeta {
  conversation_id: string;
  last_sync_time: number;
  total_cached: number;
  last_message_id?: string;
}

// =============================================
// MESSAGE CACHE SERVICE
// =============================================

export class MessageCacheService {
  /**
   * ✅ NEW: Quick check if messages exist (0.01s)
   */
  async hasMessages(conversationId: string): Promise<boolean> {
    if (!conversationId) {
      console.error("❌ [CACHE] conversationId is required");
      return false;
    }

    try {
      const exists = await NativeCacheBridge.hasMessages(conversationId);
      console.log(`🔍 [CACHE] hasMessages(${conversationId}): ${exists}`);
      return exists;
    } catch (error) {
      console.error(`❌ [CACHE] hasMessages failed:`, error);
      return false;
    }
  }

  /**
   * ✅ NEW: Get total message count (0.01s)
   */
  async getMessageCount(conversationId: string): Promise<number> {
    if (!conversationId) {
      console.error("❌ [CACHE] conversationId is required");
      return 0;
    }

    try {
      const count = await NativeCacheBridge.getMessageCount(conversationId);
      console.log(`📊 [CACHE] getMessageCount(${conversationId}): ${count}`);
      return count;
    } catch (error) {
      console.error(`❌ [CACHE] getMessageCount failed:`, error);
      return 0;
    }
  }

  /**
   * ✅ Save messages to cache with validation
   */
  async saveMessages(messages: CachedMessage[]): Promise<number> {
    if (!messages || messages.length === 0) {
      console.log("⚠️ [CACHE] No messages to save");
      return 0;
    }

    console.log(`💾 [CACHE] Saving ${messages.length} messages...`);

    try {
      // Validate and normalize
      const normalized = messages.map(msg => {
        // Validate required fields
        if (!msg._id || !msg.conversation_id) {
          throw new Error(`Invalid message: ${msg._id || 'unknown'}`);
        }

        // Validate JSON fields
        const validateJson = (json: string | undefined, defaultValue: string = "[]") => {
          if (!json) return defaultValue;
          try {
            JSON.parse(json);
            return json;
          } catch (e) {
            console.warn(`⚠️ [CACHE] Invalid JSON, using default`);
            return defaultValue;
          }
        };

        return {
          _id: msg._id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id || "",
          sender_name: msg.sender_name || "Unknown",
          sender_avatar: msg.sender_avatar || undefined,
          content: msg.content || "",
          type: msg.type || "text",
          attachments_json: validateJson(msg.attachments_json),
          reactions_json: validateJson(msg.reactions_json),
          read_by_json: validateJson(msg.read_by_json),
          reply_to_json: msg.reply_to_json || undefined,
          metadata_json: msg.metadata_json || undefined,
          rich_media_json: msg.rich_media_json || undefined,
          is_edited: msg.is_edited ? 1 : 0,
          created_at: Math.floor(msg.created_at),
          updated_at: Math.floor(msg.updated_at),
        };
      });

      console.log(`✅ [CACHE] Validated ${normalized.length} messages`);

      // Log first message for debugging
      if (normalized.length > 0) {
        const first = normalized[0];
        const atts = JSON.parse(first.attachments_json || "[]");
        
        console.log(`📦 [CACHE] First message:`, {
          _id: first._id,
          conversation_id: first.conversation_id,
          type: first.type,
          hasContent: !!first.content,
          attachmentCount: atts.length,
          firstHasUri: atts[0]?.decryptedUri ? true : false,
        });
        
        if (atts.length > 0 && atts[0].decryptedUri) {
          console.log(`📎 [CACHE] First attachment URI: ${atts[0].decryptedUri.substring(0, 60)}...`);
        }
      }

      // Call native module - returns count
      const savedCount = await NativeCacheBridge.saveMessages(normalized);
      
      console.log(`✅ [CACHE] Saved ${savedCount} messages successfully`);
      
      return savedCount;
      
    } catch (error) {
      console.error(`❌ [CACHE] Save failed:`, error);
      throw error;
    }
  }

  /**
   * ✅ Get messages from cache with pagination
   */
  async getMessages(
    conversationId: string,
    limit: number,
    beforeTimestamp?: number
  ): Promise<CachedMessage[]> {
    if (!conversationId) {
      console.error("❌ [CACHE] conversationId is required");
      return [];
    }

    console.log(`📥 [CACHE] Getting messages:`, {
      conversationId,
      limit,
      beforeTimestamp: beforeTimestamp 
        ? new Date(beforeTimestamp).toISOString() 
        : 'none',
    });

    try {
      const messages = await NativeCacheBridge.getMessages(
        conversationId,
        limit,
        beforeTimestamp
      );

      console.log(`✅ [CACHE] Retrieved ${messages.length} messages`);

      if (messages.length > 0) {
        const first = messages[0];
        const last = messages[messages.length - 1];
        const atts = JSON.parse(first.attachments_json || "[]");
        
        console.log(`📦 [CACHE] Message range:`, {
          first_id: first._id,
          first_created: new Date(first.created_at).toISOString(),
          last_id: last._id,
          last_created: new Date(last.created_at).toISOString(),
          total: messages.length,
          hasAttachments: atts.length > 0,
        });
        
        if (beforeTimestamp) {
          console.log(`📊 [CACHE] All messages BEFORE ${new Date(beforeTimestamp).toISOString()}`);
        }
      }

      return messages;
      
    } catch (error) {
      console.error(`❌ [CACHE] Get messages failed:`, error);
      return [];
    }
  }

  /**
   * ✅ Update attachment URI in cache
   */
  async updateAttachmentUri(
    messageId: string,
    attachmentId: string,
    decryptedUri: string
  ): Promise<void> {
    console.log(`🔗 [CACHE] Updating attachment URI:`, {
      messageId,
      attachmentId,
      uriPreview: decryptedUri.substring(0, 60) + '...',
    });

    try {
      const success = await NativeCacheBridge.updateAttachmentUri(
        messageId,
        attachmentId,
        decryptedUri
      );
      
      if (success) {
        console.log(`✅ [CACHE] Attachment URI updated`);
      } else {
        console.warn(`⚠️ [CACHE] Attachment URI update returned false`);
      }
      
    } catch (error) {
      console.error(`❌ [CACHE] Update attachment URI failed:`, error);
      throw error;
    }
  }

  /**
   * ✅ Clear conversation cache
   */
  async clearConversation(conversationId: string): Promise<void> {
    console.log(`🗑️ [CACHE] Clearing conversation: ${conversationId}`);

    try {
      await NativeCacheBridge.clearConversation(conversationId);
      console.log(`✅ [CACHE] Conversation cleared`);
      
    } catch (error) {
      console.error(`❌ [CACHE] Clear conversation failed:`, error);
      throw error;
    }
  }

  /**
   * ✅ Get conversation metadata FROM SQLITE
   */
  async getConversationMeta(conversationId: string): Promise<ConversationMeta | null> {
    console.log(`📊 [CACHE] getConversationMeta for ${conversationId}`);
    
    try {
      const meta = await NativeCacheBridge.getConversationMeta(conversationId);
      
      if (meta) {
        console.log(`✅ [CACHE] Found metadata in SQLite:`, {
          last_sync_time: meta.last_sync_time,
          total_cached: meta.total_cached,
          last_message_id: meta.last_message_id,
        });
        return meta;
      }
      
      console.log(`📊 [CACHE] No metadata found for ${conversationId}`);
      return null;
      
    } catch (error) {
      console.error(`❌ [CACHE] getConversationMeta failed:`, error);
      return null;
    }
  }

  /**
   * ✅ Update conversation metadata TO SQLITE
   */
  async updateConversationMeta(meta: ConversationMeta): Promise<void> {
    console.log(`📊 [CACHE] updateConversationMeta for ${meta.conversation_id}`, {
      last_sync_time: meta.last_sync_time,
      total_cached: meta.total_cached,
      last_message_id: meta.last_message_id,
    });
    
    try {
      await NativeCacheBridge.updateConversationMeta(
        meta.conversation_id,
        meta.last_sync_time,
        meta.total_cached,
        meta.last_message_id
      );
      
      console.log(`✅ [CACHE] Metadata saved to SQLite`);
      
    } catch (error) {
      console.error(`❌ [CACHE] updateConversationMeta failed:`, error);
      throw error;
    }
  }

  /**
   * ✅ Clear all cache
   */
  async clearAll(): Promise<void> {
    console.log('🧹 [CACHE] clearAll called');
    
    try {
      await NativeCacheBridge.clearAll();
      console.log('✅ [CACHE] All cache cleared');
      
    } catch (error) {
      console.error('❌ [CACHE] clearAll failed:', error);
      throw error;
    }
  }

  /**
   * ✅ Check if cache is available
   */
  isAvailable(): boolean {
    return NativeCacheBridge.isAvailable();
  }
}

// =============================================
// SINGLETON EXPORT
// =============================================

export const messageCacheService = new MessageCacheService();