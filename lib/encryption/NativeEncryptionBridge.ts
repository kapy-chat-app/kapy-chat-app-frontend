// lib/encryption/NativeEncryptionBridge.ts
// ✅ FIXED VERSION - Enhanced logging and type conversion for cache
// ✅ Bridge to native Android encryption module
// ✅ 5-10x faster than JavaScript implementation
// ✅ Streaming support for large files

import { NativeEventEmitter, NativeModules, Platform } from "react-native";

const { KapyEncryption, KapyCache } = NativeModules;

if (!KapyEncryption && Platform.OS === "android") {
  throw new Error("KapyEncryption native module not found");
}

// =============================================
// TYPES
// =============================================

export interface EncryptionProgress {
  phase:
    | "encrypting"
    | "decrypting"
    | "reading"
    | "finalizing"
    | "streaming-decrypt";
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  bytesProcessed: number;
  totalBytes: number;
}

export interface EncryptedMessageResult {
  encryptedContent: string;
  iv: string;
  authTag: string;
}

export interface EncryptedFileResult {
  encryptedBase64: string;
  iv: string;
  authTag: string;
  originalSize: number;
  encryptedSize: number;
  fileName: string;
  totalChunks: number;
  chunks: ChunkInfo[];
}

export interface StreamingUploadResult {
  fileId: string;
  messageId: string;
  masterIv: string;
  masterAuthTag: string;
  chunks: ChunkInfo[];
  totalChunks: number;
  originalSize: number;
  encryptedSize: number;
  fileName: string;
}

export interface ChunkInfo {
  index: number;
  iv: string;
  authTag: string;
  gcmAuthTag: string;
  originalSize: number;
  encryptedSize: number;
}

export interface EncryptedSymmetricKey {
  encryptedSymmetricKey: string;
  keyIv: string;
  keyAuthTag: string;
}

export type ProgressCallback = (progress: EncryptionProgress) => void;

// =============================================
// EVENT EMITTER
// =============================================

const eventEmitter = new NativeEventEmitter(KapyEncryption);

// =============================================
// NATIVE ENCRYPTION BRIDGE
// =============================================

export class NativeEncryptionBridge {
  private static progressListeners: Map<string, ProgressCallback> = new Map();
  private static subscriptions: any[] = [];

  /**
   * Initialize the bridge
   */
  static initialize(): void {
    // Subscribe to progress events
    const subscription = eventEmitter.addListener(
      "KapyEncryptionProgress",
      (progress: EncryptionProgress) => {
        // Notify all active listeners
        this.progressListeners.forEach((callback) => {
          callback(progress);
        });
      }
    );

    this.subscriptions.push(subscription);
    console.log("✅ NativeEncryptionBridge initialized");
  }

  /**
   * Cleanup
   */
  static cleanup(): void {
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
    this.progressListeners.clear();
  }

  // ============================================
  // KEY MANAGEMENT
  // ============================================

  /**
   * Generate encryption key
   */
  static async generateKey(): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }
    return await KapyEncryption.generateKey();
  }

  /**
   * Derive key from base64 string
   */
  static async deriveKey(keyBase64: string): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }
    return await KapyEncryption.deriveKey(keyBase64);
  }

  /**
   * Clear key cache
   */
  static async clearKeyCache(): Promise<void> {
    if (Platform.OS !== "android") return;
    await KapyEncryption.clearKeyCache();
  }

  // ============================================
  // TEXT MESSAGE ENCRYPTION
  // ============================================

  /**
   * Encrypt text message
   */
  static async encryptMessage(
    message: string,
    keyBase64: string
  ): Promise<EncryptedMessageResult> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    const result = await KapyEncryption.encryptMessage(message, keyBase64);

    return {
      encryptedContent: result.encryptedContent,
      iv: result.iv,
      authTag: result.authTag,
    };
  }

  /**
   * Decrypt text message
   */
  static async decryptMessage(
    encryptedBase64: string,
    ivBase64: string,
    authTagBase64: string,
    senderKeyBase64: string
  ): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    return await KapyEncryption.decryptMessage(
      encryptedBase64,
      ivBase64,
      authTagBase64,
      senderKeyBase64
    );
  }

  // ============================================
  // FILE ENCRYPTION - STREAMING
  // ============================================

  /**
   * Encrypt file with streaming (for large files)
   */
  static async encryptFileStreaming(
    fileUri: string,
    fileName: string,
    keyBase64: string,
    onProgress?: ProgressCallback
  ): Promise<EncryptedFileResult> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    // Register progress callback
    const listenerId = `encrypt_${Date.now()}`;
    if (onProgress) {
      this.progressListeners.set(listenerId, onProgress);
    }

    try {
      const result = await KapyEncryption.encryptFileStreaming(
        fileUri,
        fileName,
        keyBase64
      );

      return result as EncryptedFileResult;
    } finally {
      // Cleanup listener
      this.progressListeners.delete(listenerId);
    }
  }

  /**
   * ✅ Decrypt file directly (single-pass, no chunks)
   * Best for small files (<1MB) or when data is already in memory
   */
  static async decryptFileDirect(
    encryptedBase64: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string,
    outputPath: string
  ): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    return await KapyEncryption.decryptFileDirect(
      encryptedBase64,
      iv,
      authTag,
      senderKeyBase64,
      outputPath
    );
  }

  /**
   * Decrypt file with streaming (OLD - requires full base64 in memory)
   */
  static async decryptFileStreaming(
    encryptedBase64: string,
    chunks: ChunkInfo[],
    masterAuthTag: string,
    senderKeyBase64: string,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    // Register progress callback
    const listenerId = `decrypt_${Date.now()}`;
    if (onProgress) {
      this.progressListeners.set(listenerId, onProgress);
    }

    try {
      const resultPath = await KapyEncryption.decryptFileStreaming(
        encryptedBase64,
        chunks,
        masterAuthTag,
        senderKeyBase64,
        outputPath
      );

      return resultPath;
    } finally {
      // Cleanup listener
      this.progressListeners.delete(listenerId);
    }
  }

  /**
   * ✅ NEW: Decrypt file streaming from S3 URL (TRUE STREAMING)
   * Downloads and decrypts simultaneously - minimal RAM usage
   */
  static async decryptFileStreamingFromUrl(
    s3Url: string,
    chunks: ChunkInfo[],
    masterAuthTag: string,
    senderKeyBase64: string,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    const listenerId = `decrypt_stream_${Date.now()}`;
    if (onProgress) {
      this.progressListeners.set(listenerId, onProgress);
    }

    try {
      const resultPath = await KapyEncryption.decryptFileStreamingFromUrl(
        s3Url,
        chunks,
        masterAuthTag,
        senderKeyBase64,
        outputPath
      );

      return resultPath;
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  // ============================================
  // FALLBACK DETECTION
  // ============================================

  /**
   * Check if native encryption is available
   */
  static isAvailable(): boolean {
    const available = Platform.OS === "android" && !!KapyEncryption;
    return available;
  }

  /**
   * Get performance estimate
   */
  static getPerformanceMultiplier(): number {
    // Native is ~5-10x faster than JS
    return this.isAvailable() ? 7 : 1;
  }

  /**
   * Generate random symmetric key for file encryption
   */
  static async generateSymmetricKey(): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }
    return await KapyEncryption.generateSymmetricKey();
  }

  /**
   * Encrypt symmetric key với public key của recipient
   * @param symmetricKey - Base64 symmetric key
   * @param recipientPublicKey - Base64 public key của recipient
   */
  static async encryptSymmetricKey(
    symmetricKey: string,
    recipientPublicKey: string
  ): Promise<EncryptedSymmetricKey> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    const result = await KapyEncryption.encryptSymmetricKey(
      symmetricKey,
      recipientPublicKey
    );

    return {
      encryptedSymmetricKey: result.encryptedSymmetricKey,
      keyIv: result.keyIv,
      keyAuthTag: result.keyAuthTag,
    };
  }

  /**
   * Decrypt symmetric key bằng own private key
   * @param encryptedKey - Encrypted symmetric key
   * @param keyIv - IV used for key encryption
   * @param keyAuthTag - Auth tag for key encryption
   * @param senderPublicKey - Sender's public key (để derive shared secret)
   */
  static async decryptSymmetricKey(
    encryptedKey: string,
    keyIv: string,
    keyAuthTag: string,
    senderPublicKey: string
  ): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    return await KapyEncryption.decryptSymmetricKey(
      encryptedKey,
      keyIv,
      keyAuthTag,
      senderPublicKey
    );
  }

  /**
   * ✅ NEW: Encrypt file với symmetric key (thay vì recipient's public key)
   */
  static async encryptFileWithSymmetricKey(
    fileUri: string,
    fileName: string,
    symmetricKey: string,
    onProgress?: ProgressCallback
  ): Promise<EncryptedFileResult> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    const listenerId = `encrypt_${Date.now()}`;
    if (onProgress) {
      this.progressListeners.set(listenerId, onProgress);
    }

    try {
      const result = await KapyEncryption.encryptFileStreamingWithSymmetricKey(
        fileUri,
        fileName,
        symmetricKey
      );

      return result as EncryptedFileResult;
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  /**
   * ✅ NEW: Decrypt file với symmetric key
   */
  static async decryptFileWithSymmetricKey(
    s3Url: string,
    chunks: ChunkInfo[],
    masterAuthTag: string,
    symmetricKey: string,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    // ✅ CRITICAL: Validate chunks array
    if (!chunks || !Array.isArray(chunks)) {
      console.error("❌ [Bridge] chunks is null or not array:", chunks);
      throw new Error("chunks parameter is null or not an array");
    }

    if (chunks.length === 0) {
      console.error("❌ [Bridge] chunks array is empty");
      throw new Error("chunks array is empty");
    }

    console.log("🔍 [Bridge] Chunks validation:");
    console.log(`   Type: ${typeof chunks}`);
    console.log(`   Is Array: ${Array.isArray(chunks)}`);
    console.log(`   Length: ${chunks.length}`);
    console.log(`   First chunk:`, chunks[0]);

    // ✅ Ensure chunks have required fields
    const validatedChunks = chunks.map((chunk, index) => {
      if (
        !chunk.iv ||
        !chunk.gcmAuthTag ||
        typeof chunk.encryptedSize !== "number"
      ) {
        console.error(
          `❌ [Bridge] Chunk ${index} missing required fields:`,
          chunk
        );
        throw new Error(
          `Chunk ${index} missing required fields (iv, gcmAuthTag, or encryptedSize)`
        );
      }
      return chunk;
    });

    console.log(`✅ [Bridge] Validated ${validatedChunks.length} chunks`);

    const listenerId = `decrypt_stream_${Date.now()}`;
    if (onProgress) {
      this.progressListeners.set(listenerId, onProgress);
    }

    try {
      const resultPath =
        await KapyEncryption.decryptFileStreamingFromUrlWithSymmetricKey(
          s3Url,
          validatedChunks,
          masterAuthTag,
          symmetricKey,
          outputPath
        );

      return resultPath;
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  static async encryptAndUploadWithSymmetricKey(
    fileUri: string,
    fileName: string,
    conversationId: string,
    symmetricKey: string,
    authToken: string,
    onProgress?: ProgressCallback
  ): Promise<StreamingUploadResult> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }

    const listenerId = `upload_${Date.now()}`;
    if (onProgress) {
      this.progressListeners.set(listenerId, onProgress);
    }

    try {
      const result =
        await KapyEncryption.encryptAndUploadFileStreamingWithSymmetricKey(
          fileUri,
          fileName,
          conversationId,
          symmetricKey,
          authToken
        );

      return result as StreamingUploadResult;
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }
}

// =============================================
// NATIVE CACHE BRIDGE - FIXED VERSION
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
  is_edited: number; // ✅ Changed to number for proper Kotlin compatibility
  created_at: number;
  updated_at: number;
  rich_media_json?: string;
}

export class NativeCacheBridge {
  /**
   * ✅ Save messages to cache - FIXED with proper type conversion
   */
  static async saveMessages(messages: CachedMessage[]): Promise<void> {
    if (Platform.OS !== "android") {
      console.warn("⚠️ [NativeBridge] Not on Android, skipping save");
      return;
    }
    
    if (!KapyCache) {
      console.error("❌ [NativeBridge] KapyCache module not found!");
      throw new Error("KapyCache module not available");
    }

    console.log(`📲 [NativeBridge] saveMessages called with ${messages.length} messages`);

    try {
      // ✅ Normalize messages for Kotlin
      const normalized = messages.map(msg => ({
        _id: msg._id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id || "",
        sender_name: msg.sender_name || "Unknown",
        sender_avatar: msg.sender_avatar || "",
        content: msg.content || "",
        type: msg.type || "text",
        attachments_json: msg.attachments_json || "[]",
        reactions_json: msg.reactions_json || "[]",
        read_by_json: msg.read_by_json || "[]",
        reply_to_json: msg.reply_to_json || "",
        metadata_json: msg.metadata_json || "",
        is_edited: msg.is_edited ? 1 : 0, // ✅ Ensure integer
        created_at: Math.floor(msg.created_at), // ✅ Ensure integer
        updated_at: Math.floor(msg.updated_at), // ✅ Ensure integer
        rich_media_json: msg.rich_media_json || "",
      }));

      console.log(`✅ [NativeBridge] Normalized ${normalized.length} messages`);
      console.log(`📦 [NativeBridge] First message:`, {
        _id: normalized[0]._id,
        conversation_id: normalized[0].conversation_id,
        type: normalized[0].type,
        has_content: !!normalized[0].content,
        has_attachments: normalized[0].attachments_json !== "[]",
      });

      // ✅ Call native module
      await KapyCache.saveMessages(normalized);
      
      console.log(`✅ [NativeBridge] Native saveMessages completed successfully`);
      
    } catch (error) {
      console.error("❌ [NativeBridge] saveMessages error:", error);
      if (error instanceof Error) {
        console.error("  Error name:", error.name);
        console.error("  Error message:", error.message);
        console.error("  Error stack:", error.stack);
      }
      throw error;
    }
  }

  /**
   * ✅ Get messages from cache - FIXED with enhanced logging
   */
  static async getMessages(
    conversationId: string,
    limit: number,
    beforeTimestamp?: number
  ): Promise<CachedMessage[]> {
    if (Platform.OS !== "android") {
      console.warn("⚠️ [NativeBridge] Not on Android, returning empty array");
      return [];
    }
    
    if (!KapyCache) {
      console.error("❌ [NativeBridge] KapyCache module not found!");
      return [];
    }

    console.log(`📲 [NativeBridge] getMessages called:`, {
      conversationId,
      limit,
      beforeTimestamp,
    });

    try {
      // ✅ Call native module
      const result = await KapyCache.getMessages(
        conversationId,
        limit,
        beforeTimestamp
      );

      console.log(`✅ [NativeBridge] Native getMessages returned: ${result?.length || 0} messages`);

      // ✅ Handle empty or invalid result
      if (!result) {
        console.warn("⚠️ [NativeBridge] Result is null/undefined");
        return [];
      }

      if (!Array.isArray(result)) {
        console.error("❌ [NativeBridge] Result is not an array:", typeof result);
        return [];
      }

      if (result.length === 0) {
        console.log("📭 [NativeBridge] No messages found in cache");
        return [];
      }

      // ✅ Log first message for debugging
      const first = result[0];
      console.log(`📦 [NativeBridge] First cached message:`, {
        _id: first._id,
        conversation_id: first.conversation_id,
        type: first.type,
        has_content: !!first.content,
        attachments: first.attachments_json ? JSON.parse(first.attachments_json).length : 0,
      });

      return result as CachedMessage[];
      
    } catch (error) {
      console.error("❌ [NativeBridge] getMessages error:", error);
      if (error instanceof Error) {
        console.error("  Error name:", error.name);
        console.error("  Error message:", error.message);
      }
      return [];
    }
  }

  /**
   * ✅ Update attachment URI in cache
   */
  static async updateAttachmentUri(
    messageId: string,
    attachmentId: string,
    decryptedUri: string
  ): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    
    if (!KapyCache) {
      console.error("❌ [NativeBridge] KapyCache module not found!");
      return false;
    }

    try {
      const result = await KapyCache.updateAttachmentUri(
        messageId,
        attachmentId,
        decryptedUri
      );
      
      return result === true;
      
    } catch (error) {
      console.error("❌ [NativeBridge] updateAttachmentUri error:", error);
      return false;
    }
  }

  /**
   * ✅ Clear conversation cache
   */
  static async clearConversation(conversationId: string): Promise<void> {
    if (Platform.OS !== "android") return;
    
    if (!KapyCache) {
      console.error("❌ [NativeBridge] KapyCache module not found!");
      return;
    }

    try {
      await KapyCache.clearConversation(conversationId);
      console.log(`✅ [NativeBridge] Cleared conversation: ${conversationId}`);
    } catch (error) {
      console.error("❌ [NativeBridge] clearConversation error:", error);
      throw error;
    }
  }

  /**
 * ✅ Get conversation metadata from SQLite
 */
static async getConversationMeta(conversationId: string): Promise<{
  conversation_id: string;
  last_sync_time: number;
  total_cached: number;
  last_message_id?: string;
} | null> {
  if (Platform.OS !== "android") return null;
  
  if (!KapyCache) {
    console.error("❌ [NativeBridge] KapyCache module not found!");
    return null;
  }

  try {
    const result = await KapyCache.getConversationMeta(conversationId);
    return result;
  } catch (error) {
    console.error("❌ [NativeBridge] getConversationMeta error:", error);
    return null;
  }
}

/**
 * ✅ Update conversation metadata in SQLite
 */
static async updateConversationMeta(
  conversationId: string,
  lastSyncTime: number,
  totalCached: number,
  lastMessageId?: string
): Promise<void> {
  if (Platform.OS !== "android") return;
  
  if (!KapyCache) {
    console.error("❌ [NativeBridge] KapyCache module not found!");
    return;
  }

  try {
    await KapyCache.updateConversationMeta(
      conversationId,
      lastSyncTime,
      totalCached,
      lastMessageId || null
    );
  } catch (error) {
    console.error("❌ [NativeBridge] updateConversationMeta error:", error);
    throw error;
  }
}

  /**
   * ✅ Clear all cache
   */
  static async clearAll(): Promise<void> {
    if (Platform.OS !== "android") return;
    
    if (!KapyCache) {
      console.error("❌ [NativeBridge] KapyCache module not found!");
      return;
    }

    try {
      await KapyCache.clearAll();
      console.log(`✅ [NativeBridge] Cleared all cache`);
    } catch (error) {
      console.error("❌ [NativeBridge] clearAll error:", error);
      throw error;
    }
  }

  /**
   * ✅ Check if native cache is available
   */
  static isAvailable(): boolean {
    const available = Platform.OS === "android" && !!KapyCache;
    console.log("🔍 [NativeBridge] Cache available:", available);
    console.log("🔍 [NativeBridge] Platform:", Platform.OS);
    console.log("🔍 [NativeBridge] KapyCache module:", !!KapyCache);
    return available;
  }
}

// Auto-initialize
NativeEncryptionBridge.initialize();