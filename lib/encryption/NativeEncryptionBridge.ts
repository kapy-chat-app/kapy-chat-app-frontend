// lib/encryption/NativeEncryptionBridge.ts
// ✅ CACHE-FIRST VERSION - Enhanced với helper methods

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

const eventEmitter = new NativeEventEmitter(KapyEncryption);

// =============================================
// NATIVE ENCRYPTION BRIDGE
// =============================================

export class NativeEncryptionBridge {
  private static progressListeners: Map<string, ProgressCallback> = new Map();
  private static subscriptions: any[] = [];

  static initialize(): void {
    const subscription = eventEmitter.addListener(
      "KapyEncryptionProgress",
      (progress: EncryptionProgress) => {
        this.progressListeners.forEach((callback) => {
          callback(progress);
        });
      }
    );

    this.subscriptions.push(subscription);
    console.log("✅ NativeEncryptionBridge initialized");
  }

  static cleanup(): void {
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
    this.progressListeners.clear();
  }

  static async generateKey(): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }
    return await KapyEncryption.generateKey();
  }

  static async deriveKey(keyBase64: string): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }
    return await KapyEncryption.deriveKey(keyBase64);
  }

  static async clearKeyCache(): Promise<void> {
    if (Platform.OS !== "android") return;
    await KapyEncryption.clearKeyCache();
  }

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

  static async encryptFileStreaming(
    fileUri: string,
    fileName: string,
    keyBase64: string,
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
      const result = await KapyEncryption.encryptFileStreaming(
        fileUri,
        fileName,
        keyBase64
      );

      return result as EncryptedFileResult;
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

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
      this.progressListeners.delete(listenerId);
    }
  }

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

  static isAvailable(): boolean {
    const available = Platform.OS === "android" && !!KapyEncryption;
    return available;
  }

  static getPerformanceMultiplier(): number {
    return this.isAvailable() ? 7 : 1;
  }

  static async generateSymmetricKey(): Promise<string> {
    if (Platform.OS !== "android") {
      throw new Error("Native encryption only available on Android");
    }
    return await KapyEncryption.generateSymmetricKey();
  }

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

    if (!chunks || !Array.isArray(chunks)) {
      console.error("❌ [Bridge] chunks is null or not array:", chunks);
      throw new Error("chunks parameter is null or not an array");
    }

    if (chunks.length === 0) {
      console.error("❌ [Bridge] chunks array is empty");
      throw new Error("chunks array is empty");
    }

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
// NATIVE CACHE BRIDGE
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
  is_edited: number;
  created_at: number;
  updated_at: number;
  rich_media_json?: string;
}

export class NativeCacheBridge {
  /**
   * ✅ NEW: Check if messages exist (fast check)
   */
  static async hasMessages(conversationId: string): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      return false;
    }

    try {
      const result = await KapyCache.hasMessages(conversationId);
      return result === true;
    } catch (error) {
      console.error("❌ [Bridge] hasMessages error:", error);
      return false;
    }
  }

  /**
   * ✅ NEW: Get message count
   */
  static async getMessageCount(conversationId: string): Promise<number> {
    if (Platform.OS !== "android") return 0;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      return 0;
    }

    try {
      const count = await KapyCache.getMessageCount(conversationId);
      return count || 0;
    } catch (error) {
      console.error("❌ [Bridge] getMessageCount error:", error);
      return 0;
    }
  }

  /**
   * ✅ Get messages với pagination support
   */
  static async getMessages(
    conversationId: string,
    limit: number,
    beforeTimestamp?: number
  ): Promise<CachedMessage[]> {
    if (Platform.OS !== "android") {
      return [];
    }
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      return [];
    }

    try {
      const result = await KapyCache.getMessages(
        conversationId,
        limit,
        beforeTimestamp || null
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result as CachedMessage[];
      
    } catch (error) {
      console.error("❌ [Bridge] getMessages error:", error);
      return [];
    }
  }

  /**
   * ✅ Save messages returns count
   */
  static async saveMessages(messages: CachedMessage[]): Promise<number> {
    if (Platform.OS !== "android") {
      return 0;
    }
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      throw new Error("KapyCache module not available");
    }

    try {
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
        is_edited: msg.is_edited ? 1 : 0,
        created_at: Math.floor(msg.created_at),
        updated_at: Math.floor(msg.updated_at),
        rich_media_json: msg.rich_media_json || "",
      }));

      const savedCount = await KapyCache.saveMessages(normalized);
      
      return savedCount || 0;
      
    } catch (error) {
      console.error("❌ [Bridge] saveMessages error:", error);
      throw error;
    }
  }

  static async updateAttachmentUri(
    messageId: string,
    attachmentId: string,
    decryptedUri: string
  ): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
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
      console.error("❌ [Bridge] updateAttachmentUri error:", error);
      return false;
    }
  }

  static async clearConversation(conversationId: string): Promise<void> {
    if (Platform.OS !== "android") return;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      return;
    }

    try {
      await KapyCache.clearConversation(conversationId);
    } catch (error) {
      console.error("❌ [Bridge] clearConversation error:", error);
      throw error;
    }
  }

  static async getConversationMeta(conversationId: string): Promise<{
    conversation_id: string;
    last_sync_time: number;
    total_cached: number;
    last_message_id?: string;
  } | null> {
    if (Platform.OS !== "android") return null;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      return null;
    }

    try {
      const result = await KapyCache.getConversationMeta(conversationId);
      return result;
    } catch (error) {
      console.error("❌ [Bridge] getConversationMeta error:", error);
      return null;
    }
  }

  static async updateConversationMeta(
    conversationId: string,
    lastSyncTime: number,
    totalCached: number,
    lastMessageId?: string
  ): Promise<void> {
    if (Platform.OS !== "android") return;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
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
      console.error("❌ [Bridge] updateConversationMeta error:", error);
      throw error;
    }
  }

  static async clearAll(): Promise<void> {
    if (Platform.OS !== "android") return;
    
    if (!KapyCache) {
      console.error("❌ [Bridge] KapyCache module not found!");
      return;
    }

    try {
      await KapyCache.clearAll();
    } catch (error) {
      console.error("❌ [Bridge] clearAll error:", error);
      throw error;
    }
  }

  static isAvailable(): boolean {
    const available = Platform.OS === "android" && !!KapyCache;
    return available;
  }
}

NativeEncryptionBridge.initialize();