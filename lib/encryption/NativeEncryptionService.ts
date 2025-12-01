// lib/encryption/NativeEncryptionService.ts - FINAL VERSION
// ✅ Backward compatible with old messages
// ✅ Support backup password for cross-device restore
// High-performance encryption using react-native-quick-crypto

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

export interface KeyBackupData {
  encryptedMasterKey: string;
  salt: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  createdAt: string;
}

// =============================================
// CONSTANTS
// =============================================

const ENCRYPTION_KEY_STORE = "e2ee_master_key";
const KEY_VERSION = 1;

// =============================================
// NATIVE ENCRYPTION SERVICE
// =============================================

export class NativeEncryptionService {
  private keyCache: Map<string, Buffer> = new Map();
  private readonly KEY_VERSION = KEY_VERSION;

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveKeyFromPassword(
    password: string, 
    salt: Buffer, 
    iterations: number = 100000
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      QuickCrypto.pbkdf2(
        password,
        salt,
        iterations,
        32,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey as Buffer);
        }
      );
    });
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
      mkv: "video/x-matroska", webm: "video/webm", m4v: "video/x-m4v",
      "3gp": "video/3gpp", mp3: "audio/mpeg", wav: "audio/wav",
      m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg",
      flac: "audio/flac", jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", gif: "image/gif", webp: "image/webp",
      svg: "image/svg+xml", heic: "image/heic", pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain", zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar", gz: "application/gzip",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  /**
   * ✅ BACKWARD COMPATIBLE: Get my encryption key (SAME AS OLD VERSION)
   * This ensures old messages can still be decrypted
   */
  private async getMyEncryptionKey(): Promise<Buffer> {
    const cached = this.keyCache.get('my_key');
    if (cached) return cached;

    const keyBase64 = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
    if (!keyBase64) {
      throw new Error("Encryption key not found. Please initialize E2EE first.");
    }

    // ✅ CRITICAL: Keep the SAME derivation as old version
    // Hash the BASE64 STRING (not the decoded bytes)
    const hash = QuickCrypto.createHash('sha256');
    hash.update(keyBase64); // Hash base64 string directly
    const derivedKey = hash.digest() as Buffer;

    this.keyCache.set('my_key', derivedKey);
    
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

    const keyHash = QuickCrypto.createHash('sha256').update(derivedKey).digest('hex');
    console.log("🔑 Sender derived key SHA256:", keyHash);

    return derivedKey;
  }

  /**
   * Initialize keys with optional password for server backup
   */
  async initializeKeys(backupPassword?: string): Promise<{ 
    publicKey: string;
    backupData?: KeyBackupData;
  }> {
    try {
      let existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      
      if (existingKey) {
        console.log("✅ Using existing master key");
        
        // If password provided, create backup data for existing key
        if (backupPassword) {
          // The existingKey IS the master key (as base64 string)
          const masterKeyBytes = Buffer.from(existingKey, 'base64');
          const backupData = await this.createKeyBackup(masterKeyBytes, backupPassword);
          return { 
            publicKey: existingKey,
            backupData 
          };
        }
        
        return { publicKey: existingKey };
      }

      // Generate new master key
      const masterKey = QuickCrypto.randomBytes(32) as Buffer;
      const masterKeyBase64 = masterKey.toString('base64');

      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, masterKeyBase64);
      
      console.log("✅ New master key generated");
      
      // Create backup data if password provided
      let backupData: KeyBackupData | undefined;
      if (backupPassword) {
        backupData = await this.createKeyBackup(masterKey, backupPassword);
        console.log("✅ Key backup created");
      }

      return { 
        publicKey: masterKeyBase64,
        backupData 
      };
    } catch (error) {
      console.error("❌ Failed to initialize keys:", error);
      throw error;
    }
  }

  /**
   * Create encrypted backup of master key
   */
  async createKeyBackup(
    masterKey: Buffer, 
    password: string
  ): Promise<KeyBackupData> {
    const salt = QuickCrypto.randomBytes(16) as Buffer;
    const derivedKey = await this.deriveKeyFromPassword(password, salt);
    
    const iv = QuickCrypto.randomBytes(12) as Buffer;
    const cipher = QuickCrypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(masterKey) as Buffer,
      cipher.final() as Buffer
    ]);
    
    const authTag = cipher.getAuthTag() as Buffer;

    return {
      encryptedMasterKey: encrypted.toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.KEY_VERSION,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Restore master key from backup
   */
  async restoreFromBackup(
    backupData: KeyBackupData,
    password: string
  ): Promise<void> {
    try {
      console.log("🔄 Restoring master key from backup...");

      const salt = Buffer.from(backupData.salt, 'base64');
      const derivedKey = await this.deriveKeyFromPassword(password, salt);
      
      const iv = Buffer.from(backupData.iv, 'base64');
      const authTag = Buffer.from(backupData.authTag, 'base64');
      const encryptedMasterKey = Buffer.from(backupData.encryptedMasterKey, 'base64');
      
      const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
      decipher.setAuthTag(authTag);
      
      const masterKey = Buffer.concat([
        decipher.update(encryptedMasterKey) as Buffer,
        decipher.final() as Buffer
      ]);

      const masterKeyBase64 = masterKey.toString('base64');
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, masterKeyBase64);
      
      this.keyCache.clear();
      
      console.log("✅ Master key restored successfully");
    } catch (error) {
      console.error("❌ Failed to restore from backup:", error);
      throw new Error("Invalid password or corrupted backup data");
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
   * Get public key
   */
  async getPublicKey(): Promise<string> {
    const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
    if (!key) {
      throw new Error("Master key not found");
    }
    return key;
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
   * Encrypt file using AES-256-GCM
   */
  async encryptFile(
    fileUri: string,
    fileName: string,
    onProgress?: ProgressCallback
  ): Promise<NativeEncryptionResult> {
    try {
      console.log("🔒 Native encrypting:", fileName);

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error("File not found: " + fileUri);
      }

      const fileSize = (fileInfo as any).size || 0;
      const fileType = this.getMimeType(fileName);

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

      onProgress?.({
        phase: 'encrypting',
        percentage: 30,
        bytesProcessed: fileSize * 0.3,
        totalBytes: fileSize,
      });

      const key = await this.getMyEncryptionKey();
      const iv = QuickCrypto.randomBytes(12) as Buffer;

      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([
        cipher.update(fileBuffer) as Buffer,
        cipher.final() as Buffer
      ]);
      const authTag = cipher.getAuthTag() as Buffer;

      onProgress?.({
        phase: 'finalizing',
        percentage: 100,
        bytesProcessed: fileSize,
        totalBytes: fileSize,
      });

      console.log("✅ Native encryption complete");

      return {
        encryptedBase64: encrypted.toString('base64'),
        metadata: {
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          original_size: fileSize,
          encrypted_size: encrypted.length,
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
   * Decrypt file using AES-256-GCM
   */
  async decryptFile(
    encryptedBase64: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string
  ): Promise<Buffer> {
    try {
      console.log("🔓 Native decrypting...");

      const key = this.deriveSenderKey(senderKeyBase64);
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

      const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer) as Buffer,
        decipher.final() as Buffer
      ]);

      console.log("✅ Native decryption complete");
      return decrypted;
    } catch (error) {
      console.error("❌ Native decryption failed:", error);
      throw error;
    }
  }

  /**
   * Encrypt text message using AES-256-GCM
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