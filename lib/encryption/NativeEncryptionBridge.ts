// lib/encryption/NativeEncryptionBridge.ts
// ✅ FIXED VERSION - Complete bridge with all encryption methods

import { NativeEventEmitter, NativeModules, Platform } from "react-native";

const { KapyEncryption, KapyCache } = NativeModules;

if (!KapyEncryption && Platform.OS === "android") {
  console.error("❌ KapyEncryption native module not found!");
}

// =============================================
// TYPES
// =============================================

export interface EncryptionProgress {
  phase: "encrypting" | "decrypting" | "reading" | "finalizing" | "streaming-decrypt" | "uploading";
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

const eventEmitter = KapyEncryption ? new NativeEventEmitter(KapyEncryption) : null;

// =============================================
// NATIVE ENCRYPTION BRIDGE
// =============================================

export class NativeEncryptionBridge {
  private static progressListeners: Map<string, ProgressCallback> = new Map();
  private static subscriptions: any[] = [];
  private static initialized = false;

  static initialize(): void {
    if (this.initialized || !eventEmitter) return;

    try {
      const subscription = eventEmitter.addListener(
        "KapyEncryptionProgress",
        (progress: EncryptionProgress) => {
          this.progressListeners.forEach((callback) => {
            try { callback(progress); } catch (e) { }
          });
        }
      );
      this.subscriptions.push(subscription);
      this.initialized = true;
      console.log("✅ NativeEncryptionBridge initialized");
    } catch (e) {
      console.warn("⚠️ NativeEncryptionBridge initialization failed:", e);
    }
  }

  static cleanup(): void {
    this.subscriptions.forEach((sub) => { try { sub.remove(); } catch (e) { } });
    this.subscriptions = [];
    this.progressListeners.clear();
    this.initialized = false;
  }

  static isAvailable(): boolean {
    return Platform.OS === "android" && !!KapyEncryption;
  }

  static getPerformanceMultiplier(): number {
    return this.isAvailable() ? 7 : 1;
  }

  // KEY MANAGEMENT
  static async generateKey(): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    return await KapyEncryption.generateKey();
  }

  static async deriveKey(keyBase64: string): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    return await KapyEncryption.deriveKey(keyBase64);
  }

  static async clearKeyCache(): Promise<void> {
    if (!this.isAvailable()) return;
    await KapyEncryption.clearKeyCache();
  }

  // SYMMETRIC KEY MANAGEMENT
  static async generateSymmetricKey(): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    return await KapyEncryption.generateSymmetricKey();
  }

  static async encryptSymmetricKey(symmetricKey: string, recipientMasterKey: string): Promise<EncryptedSymmetricKey> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    const result = await KapyEncryption.encryptSymmetricKey(symmetricKey, recipientMasterKey);
    return {
      encryptedSymmetricKey: result.encryptedSymmetricKey,
      keyIv: result.keyIv,
      keyAuthTag: result.keyAuthTag,
    };
  }

  static async decryptSymmetricKey(encryptedKey: string, keyIv: string, keyAuthTag: string, myMasterKey: string): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    return await KapyEncryption.decryptSymmetricKey(encryptedKey, keyIv, keyAuthTag, myMasterKey);
  }

  // MESSAGE ENCRYPTION
  static async encryptMessage(message: string, keyBase64: string): Promise<EncryptedMessageResult> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    const result = await KapyEncryption.encryptMessage(message, keyBase64);
    return { encryptedContent: result.encryptedContent, iv: result.iv, authTag: result.authTag };
  }

  static async decryptMessage(encryptedBase64: string, ivBase64: string, authTagBase64: string, senderKeyBase64: string): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    return await KapyEncryption.decryptMessage(encryptedBase64, ivBase64, authTagBase64, senderKeyBase64);
  }

  // FILE ENCRYPTION
  static async encryptFileWithSymmetricKey(fileUri: string, fileName: string, symmetricKey: string, onProgress?: ProgressCallback): Promise<EncryptedFileResult> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    const listenerId = `encrypt_${Date.now()}`;
    if (onProgress) this.progressListeners.set(listenerId, onProgress);
    try {
      return await KapyEncryption.encryptFileStreamingWithSymmetricKey(fileUri, fileName, symmetricKey);
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  static async encryptFileStreaming(fileUri: string, fileName: string, keyBase64: string, onProgress?: ProgressCallback): Promise<EncryptedFileResult> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    const listenerId = `encrypt_${Date.now()}`;
    if (onProgress) this.progressListeners.set(listenerId, onProgress);
    try {
      return await KapyEncryption.encryptFileStreaming(fileUri, fileName, keyBase64);
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  // FILE DECRYPTION
  static async decryptFileWithSymmetricKey(s3Url: string, chunks: ChunkInfo[], masterAuthTag: string, symmetricKey: string, outputPath: string, onProgress?: ProgressCallback): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      throw new Error("chunks parameter is invalid");
    }
    const validatedChunks = chunks.map((chunk, index) => {
      if (!chunk.iv || !chunk.gcmAuthTag || typeof chunk.encryptedSize !== "number") {
        throw new Error(`Chunk ${index} missing required fields`);
      }
      return chunk;
    });
    const listenerId = `decrypt_stream_${Date.now()}`;
    if (onProgress) this.progressListeners.set(listenerId, onProgress);
    try {
      return await KapyEncryption.decryptFileStreamingFromUrlWithSymmetricKey(s3Url, validatedChunks, masterAuthTag, symmetricKey, outputPath);
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  static async decryptFileDirect(encryptedBase64: string, iv: string, authTag: string, senderKeyBase64: string, outputPath: string): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    return await KapyEncryption.decryptFileDirect(encryptedBase64, iv, authTag, senderKeyBase64, outputPath);
  }

  static async decryptFileStreaming(encryptedBase64: string, chunks: ChunkInfo[], masterAuthTag: string, senderKeyBase64: string, outputPath: string, onProgress?: ProgressCallback): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    const listenerId = `decrypt_${Date.now()}`;
    if (onProgress) this.progressListeners.set(listenerId, onProgress);
    try {
      return await KapyEncryption.decryptFileStreaming(encryptedBase64, chunks, masterAuthTag, senderKeyBase64, outputPath);
    } finally {
      this.progressListeners.delete(listenerId);
    }
  }

  static async decryptFileStreamingFromUrl(s3Url: string, chunks: ChunkInfo[], masterAuthTag: string, senderKeyBase64: string, outputPath: string, onProgress?: ProgressCallback): Promise<string> {
    if (!this.isAvailable()) throw new Error("Native encryption only available on Android");
    const listenerId = `decrypt_stream_${Date.now()}`;
    if (onProgress) this.progressListeners.set(listenerId, onProgress);
    try {
      return await KapyEncryption.decryptFileStreamingFromUrl(s3Url, chunks, masterAuthTag, senderKeyBase64, outputPath);
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
  static async hasMessages(conversationId: string): Promise<boolean> {
    if (Platform.OS !== "android" || !KapyCache) return false;
    try {
      return await KapyCache.hasMessages(conversationId) === true;
    } catch { return false; }
  }

  static async getMessageCount(conversationId: string): Promise<number> {
    if (Platform.OS !== "android" || !KapyCache) return 0;
    try {
      return (await KapyCache.getMessageCount(conversationId)) || 0;
    } catch { return 0; }
  }

  static async getMessages(conversationId: string, limit: number, beforeTimestamp?: number): Promise<CachedMessage[]> {
    if (Platform.OS !== "android" || !KapyCache) return [];
    try {
      const result = await KapyCache.getMessages(conversationId, limit, beforeTimestamp || null);
      return result && Array.isArray(result) ? result : [];
    } catch { return []; }
  }

  static async saveMessages(messages: CachedMessage[]): Promise<number> {
    if (Platform.OS !== "android" || !KapyCache) return 0;
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
      return (await KapyCache.saveMessages(normalized)) || 0;
    } catch (e) { throw e; }
  }

  static async updateAttachmentUri(messageId: string, attachmentId: string, decryptedUri: string): Promise<boolean> {
    if (Platform.OS !== "android" || !KapyCache) return false;
    try {
      return await KapyCache.updateAttachmentUri(messageId, attachmentId, decryptedUri) === true;
    } catch { return false; }
  }

  static async clearConversation(conversationId: string): Promise<void> {
    if (Platform.OS !== "android" || !KapyCache) return;
    await KapyCache.clearConversation(conversationId);
  }

  static async getConversationMeta(conversationId: string): Promise<{ conversation_id: string; last_sync_time: number; total_cached: number; last_message_id?: string; } | null> {
    if (Platform.OS !== "android" || !KapyCache) return null;
    try {
      return await KapyCache.getConversationMeta(conversationId);
    } catch { return null; }
  }

  static async updateConversationMeta(conversationId: string, lastSyncTime: number, totalCached: number, lastMessageId?: string): Promise<void> {
    if (Platform.OS !== "android" || !KapyCache) return;
    await KapyCache.updateConversationMeta(conversationId, lastSyncTime, totalCached, lastMessageId || null);
  }

  static async clearAll(): Promise<void> {
    if (Platform.OS !== "android" || !KapyCache) return;
    await KapyCache.clearAll();
  }

  static isAvailable(): boolean {
    return Platform.OS === "android" && !!KapyCache;
  }
}

// Initialize on load
NativeEncryptionBridge.initialize();