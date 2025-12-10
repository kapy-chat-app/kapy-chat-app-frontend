// lib/cache/MessageCacheService.ts
// ✅ COMPLETE FIXED VERSION - Full implementation with in-memory metadata cache

import { UnifiedEncryptionService } from '../encryption/UnifiedEncryptionService';

// =============================================
// TYPES (keep existing interfaces)
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
  // ✅ In-memory metadata cache (since native module doesn't have metadata table)
  private metadataCache: Map<string, ConversationMeta> = new Map();

  /**
   * ✅ Save messages to cache with validation
   */
  async saveMessages(messages: CachedMessage[]): Promise<void> {
    if (!messages || messages.length === 0) {
      console.log("⚠️ [CACHE] No messages to save");
      return;
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

      // Call native module through UnifiedEncryptionService
      await UnifiedEncryptionService.saveMessages(normalized);
      
      console.log(`✅ [CACHE] Messages saved successfully`);
      
    } catch (error) {
      console.error(`❌ [CACHE] Save failed:`, error);
      throw error;
    }
  }

  /**
   * ✅ Get messages from cache
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

    console.log(`📥 [CACHE] Getting messages: conversation=${conversationId}, limit=${limit}`);

    try {
      const messages = await UnifiedEncryptionService.getMessages(
        conversationId,
        limit,
        beforeTimestamp
      );

      console.log(`✅ [CACHE] Retrieved ${messages.length} messages`);

      if (messages.length > 0) {
        const first = messages[0];
        const atts = JSON.parse(first.attachments_json || "[]");
        
        console.log(`📦 [CACHE] First retrieved message:`, {
          _id: first._id,
          hasContent: !!first.content,
          attachmentCount: atts.length,
          firstHasUri: atts[0]?.decryptedUri ? true : false,
        });
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
    console.log(`🔗 [CACHE] Updating attachment URI: msg=${messageId}, att=${attachmentId}`);
    console.log(`   URI: ${decryptedUri.substring(0, 60)}...`);

    try {
      await UnifiedEncryptionService.updateAttachmentUri(
        messageId,
        attachmentId,
        decryptedUri
      );
      
      console.log(`✅ [CACHE] Attachment URI updated`);
      
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
      await UnifiedEncryptionService.clearConversation(conversationId);
      
      // Also clear metadata from memory
      this.metadataCache.delete(conversationId);
      
      console.log(`✅ [CACHE] Conversation cleared`);
      
    } catch (error) {
      console.error(`❌ [CACHE] Clear conversation failed:`, error);
      throw error;
    }
  }

  /**
 * ✅ Get conversation metadata FROM SQLITE (not memory)
 */
async getConversationMeta(conversationId: string): Promise<ConversationMeta | null> {
  console.log(`📊 [CACHE] getConversationMeta for ${conversationId}`);
  
  // ✅ Try native first
  const nativeMeta = await UnifiedEncryptionService.getConversationMeta(conversationId);
  
  if (nativeMeta) {
    console.log(`✅ [CACHE] Found metadata in SQLite:`, {
      last_sync_time: nativeMeta.last_sync_time,
      total_cached: nativeMeta.total_cached,
    });
    
    // Update memory cache
    this.metadataCache.set(conversationId, nativeMeta);
    return nativeMeta;
  }
  
  // ✅ Fallback to memory
  const memoryMeta = this.metadataCache.get(conversationId);
  
  if (memoryMeta) {
    console.log(`✅ [CACHE] Found metadata in memory`);
    return memoryMeta;
  }
  
  console.log(`📊 [CACHE] No metadata found for ${conversationId}`);
  return null;
}

/**
 * ✅ Update conversation metadata TO SQLITE (not just memory)
 */
async updateConversationMeta(meta: ConversationMeta): Promise<void> {
  console.log(`📊 [CACHE] updateConversationMeta for ${meta.conversation_id}`, {
    last_sync_time: meta.last_sync_time,
    total_cached: meta.total_cached,
    last_message_id: meta.last_message_id,
  });
  
  // ✅ Save to BOTH memory AND SQLite
  this.metadataCache.set(meta.conversation_id, meta);
  
  await UnifiedEncryptionService.updateConversationMeta(
    meta.conversation_id,
    meta.last_sync_time,
    meta.total_cached,
    meta.last_message_id
  );
  
  console.log(`✅ [CACHE] Metadata saved to SQLite and memory`);
}

  /**
   * ✅ Clear all cache
   */
  async clearAll(): Promise<void> {
    console.log('🧹 [CACHE] clearAll called');
    
    try {
      // Clear memory cache
      this.metadataCache.clear();
      console.log('✅ [CACHE] Memory metadata cleared');
      
      // Try to clear native cache if method exists
      if (typeof UnifiedEncryptionService.clearAll === 'function') {
        await UnifiedEncryptionService.clearAll();
        console.log('✅ [CACHE] Native cache cleared');
      } else {
        console.warn('⚠️ [CACHE] Native clearAll not implemented');
      }
      
      console.log('✅ [CACHE] All cache cleared');
      
    } catch (error) {
      console.error('❌ [CACHE] clearAll failed:', error);
      // Don't throw - best effort
    }
  }
}

// =============================================
// SINGLETON EXPORT
// =============================================

export const messageCacheService = new MessageCacheService();