// lib/encryption/NativeEncryptionService.ts
// High-performance encryption using react-native-quick-crypto
// Requires: npm install react-native-quick-crypto && eas build

import QuickCrypto from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

// =============================================
// TYPES & INTERFACES
// =============================================

export interface NativeEncryptionResult {
  encryptedBase64: string;
  metadata: {
    iv: string;
    authTag: string;
    original_size: number;
    encrypted_size: number;
    file_name: string;
    file_type: string;
  };
}

export interface EncryptionProgress {
  phase: 'reading' | 'encrypting' | 'finalizing';
  percentage: number;
  bytesProcessed: number;
  totalBytes: number;
}

export type ProgressCallback = (progress: EncryptionProgress) => void;

// =============================================
// CONSTANTS
// =============================================

const ENCRYPTION_KEY_STORE = "e2ee_encryption_key";

// =============================================
// NATIVE ENCRYPTION SERVICE
// =============================================

export class NativeEncryptionService {
  private keyCache: Map<string, Buffer> = new Map();

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      // Video
      mp4: "video/mp4",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      webm: "video/webm",
      m4v: "video/x-m4v",
      "3gp": "video/3gpp",
      // Audio
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      aac: "audio/aac",
      ogg: "audio/ogg",
      flac: "audio/flac",
      // Images
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      heic: "image/heic",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      // Archives
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  /**
   * Get my encryption key from secure storage
   */
  private async getMyEncryptionKey(): Promise<Buffer> {
    const cached = this.keyCache.get('my_key');
    if (cached) return cached;

    const keyBase64 = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
    if (!keyBase64) {
      throw new Error("Encryption key not found. Please initialize E2EE first.");
    }

    // Derive 32-byte key using SHA256
    const hash = QuickCrypto.createHash('sha256');
    hash.update(keyBase64);
    const derivedKey = hash.digest() as Buffer;

    this.keyCache.set('my_key', derivedKey);
    
    // Log key hash for debugging
    const keyHash = QuickCrypto.createHash('sha256').update(derivedKey).digest('hex');
    console.log("🔑 My derived key SHA256:", keyHash);

    return derivedKey;
  }

  /**
   * Derive key from sender's public key
   */
  private deriveSenderKey(senderKeyBase64: string): Buffer {
    const hash = QuickCrypto.createHash('sha256');
    hash.update(senderKeyBase64);
    const derivedKey = hash.digest() as Buffer;

    // Log key hash for debugging
    const keyHash = QuickCrypto.createHash('sha256').update(derivedKey).digest('hex');
    console.log("🔑 Sender derived key SHA256:", keyHash);

    return derivedKey;
  }

  /**
   * Get file size
   */
  async getFileSize(fileUri: string): Promise<number> {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File not found: " + fileUri);
    }
    return (fileInfo as any).size || 0;
  }

  /**
   * Encrypt file using AES-256-GCM (native, high-performance)
   */
  async encryptFile(
    fileUri: string,
    fileName: string,
    onProgress?: ProgressCallback
  ): Promise<NativeEncryptionResult> {
    try {
      console.log("🔒 Native encrypting:", fileName);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error("File not found: " + fileUri);
      }

      const fileSize = (fileInfo as any).size || 0;
      const fileType = this.getMimeType(fileName);

      console.log(`📦 File: ${fileName}`);
      console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Type: ${fileType}`);

      // Phase 1: Reading
      onProgress?.({
        phase: 'reading',
        percentage: 0,
        bytesProcessed: 0,
        totalBytes: fileSize,
      });

      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileBuffer = Buffer.from(fileBase64, 'base64');

      console.log("✅ File read complete");

      // Phase 2: Encrypting
      onProgress?.({
        phase: 'encrypting',
        percentage: 30,
        bytesProcessed: fileSize * 0.3,
        totalBytes: fileSize,
      });

      const key = await this.getMyEncryptionKey();
      const iv = QuickCrypto.randomBytes(12) as Buffer; // 12 bytes for GCM

      console.log("🔐 Starting AES-256-GCM encryption...");

      // Encrypt using AES-256-GCM
      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([
        cipher.update(fileBuffer) as Buffer,
        cipher.final() as Buffer
      ]);
      const authTag = cipher.getAuthTag() as Buffer;

      onProgress?.({
        phase: 'encrypting',
        percentage: 90,
        bytesProcessed: fileSize * 0.9,
        totalBytes: fileSize,
      });

      const encryptedBase64 = encrypted.toString('base64');
      const encryptedSize = encrypted.length;

      // Phase 3: Finalizing
      onProgress?.({
        phase: 'finalizing',
        percentage: 100,
        bytesProcessed: fileSize,
        totalBytes: fileSize,
      });

      console.log("✅ Native encryption complete");
      console.log(`   Original: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Encrypted: ${(encryptedSize / 1024 / 1024).toFixed(2)} MB`);

      return {
        encryptedBase64,
        metadata: {
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          original_size: fileSize,
          encrypted_size: encryptedSize,
          file_name: fileName,
          file_type: fileType,
        },
      };
    } catch (error) {
      console.error("❌ Native encryption failed:", error);
      throw error;
    }
  }

  /**
   * Decrypt file using AES-256-GCM (native, high-performance)
   */
  async decryptFile(
    encryptedBase64: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string
  ): Promise<Buffer> {
    try {
      console.log("🔓 Native decrypting...");
      console.log(`📦 Encrypted size: ${(encryptedBase64.length / 1024 / 1024).toFixed(2)} MB`);

      const key = this.deriveSenderKey(senderKeyBase64);
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

      console.log("🔐 Starting AES-256-GCM decryption...");

      // Decrypt using AES-256-GCM
      const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer) as Buffer,
        decipher.final() as Buffer
      ]);

      console.log("✅ Native decryption complete");
      console.log(`   Decrypted size: ${(decrypted.length / 1024 / 1024).toFixed(2)} MB`);

      return decrypted;
    } catch (error) {
      console.error("❌ Native decryption failed:", error);
      throw error;
    }
  }

  /**
   * Encrypt text message using AES-256-GCM
   */
  /**
 * Encrypt text message using AES-256-GCM
 * Output format compatible with existing backend
 */
async encryptMessage(message: string): Promise<{
  encryptedContent: string;
  encryptionMetadata: {
    iv: string;
    authTag: string;
  };
}> {
  try {
    const key = await this.getMyEncryptionKey();
    const iv = QuickCrypto.randomBytes(12) as Buffer;
    const messageBuffer = Buffer.from(message, 'utf-8');

    const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(messageBuffer) as Buffer,
      cipher.final() as Buffer
    ]);
    const authTag = cipher.getAuthTag() as Buffer;

    // Format compatible with both old and new decryption
    const encryptedContent = JSON.stringify({
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted.toString('base64'),
    });

    return {
      encryptedContent,
      encryptionMetadata: {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      },
    };
  } catch (error) {
    console.error("❌ Message encryption failed:", error);
    throw error;
  }
}

  /**
   * Decrypt text message using AES-256-GCM
   */
  async decryptMessage(
    encryptedContent: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string
  ): Promise<string> {
    try {
      const key = this.deriveSenderKey(senderKeyBase64);
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      const encryptedBuffer = Buffer.from(encryptedContent, 'base64');

      const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer) as Buffer,
        decipher.final() as Buffer
      ]);

      return decrypted.toString('utf-8');
    } catch (error) {
      console.error("❌ Message decryption failed:", error);
      throw error;
    }
  }

  /**
   * Initialize keys (generate if not exists)
   */
  async initializeKeys(): Promise<{ publicKey: string }> {
    try {
      const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      
      if (existingKey) {
        console.log("✅ Using existing encryption key");
        return { publicKey: existingKey };
      }

      // Generate new random key
      const randomBytes = QuickCrypto.randomBytes(32) as Buffer;
      const encryptionKey = randomBytes.toString('base64');

      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, encryptionKey);

      console.log("✅ New encryption key generated");
      return { publicKey: encryptionKey };
    } catch (error) {
      console.error("❌ Failed to initialize keys:", error);
      throw error;
    }
  }

  /**
   * Check if keys are initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      return key !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get public key (for sharing with others)
   */
  async getPublicKey(): Promise<string> {
    const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
    if (!key) {
      throw new Error("Encryption key not found");
    }
    return key;
  }

  /**
   * Clear key cache
   */
  clearCache(): void {
    this.keyCache.clear();
    console.log("✅ Key cache cleared");
  }

  /**
   * Clear all keys (logout)
   */
  async clearKeys(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORE);
      this.keyCache.clear();
      console.log("✅ All keys cleared");
    } catch (error) {
      console.error("❌ Failed to clear keys:", error);
    }
  }
}

// Export singleton instance
export const nativeEncryptionService = new NativeEncryptionService();