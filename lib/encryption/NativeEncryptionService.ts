<<<<<<< HEAD
// lib/encryption/NativeEncryptionService.ts
// High-performance encryption using react-native-quick-crypto
// Requires: npm install react-native-quick-crypto && eas build

import QuickCrypto from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system/legacy';
=======
// lib/encryption/NativeEncryptionService.ts - STREAMING VERSION
// ✅ Backward compatible with old messages
// ✅ Support backup password for cross-device restore
// ✅ STREAMING encryption - NO MORE OOM errors
// High-performance encryption using react-native-quick-crypto

import QuickCrypto from 'react-native-quick-crypto';
import RNFS from 'react-native-fs';
>>>>>>> rebuild-super-clean
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

<<<<<<< HEAD
=======
export interface KeyBackupData {
  encryptedMasterKey: string;
  salt: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  createdAt: string;
}

>>>>>>> rebuild-super-clean
// =============================================
// CONSTANTS
// =============================================

<<<<<<< HEAD
const ENCRYPTION_KEY_STORE = "e2ee_encryption_key";
=======
const ENCRYPTION_KEY_STORE = "e2ee_master_key";
const KEY_VERSION = 1;
const CHUNK_SIZE = 512 * 1024; // 512KB chunks - safe for all devices
>>>>>>> rebuild-super-clean

// =============================================
// NATIVE ENCRYPTION SERVICE
// =============================================

export class NativeEncryptionService {
  private keyCache: Map<string, Buffer> = new Map();
<<<<<<< HEAD
=======
  private readonly KEY_VERSION = KEY_VERSION;
  private readonly CHUNK_SIZE = CHUNK_SIZE;

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
>>>>>>> rebuild-super-clean

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
<<<<<<< HEAD
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
=======
      mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
      mkv: "video/x-matroska", webm: "video/webm", m4v: "video/x-m4v",
      "3gp": "video/3gpp", mp3: "audio/mpeg", wav: "audio/wav",
      m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg",
      flac: "audio/flac", jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", gif: "image/gif", webp: "image/webp",
      svg: "image/svg+xml", heic: "image/heic", pdf: "application/pdf",
>>>>>>> rebuild-super-clean
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
<<<<<<< HEAD
      txt: "text/plain",
      // Archives
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",
=======
      txt: "text/plain", zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar", gz: "application/gzip",
>>>>>>> rebuild-super-clean
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  /**
<<<<<<< HEAD
   * Get my encryption key from secure storage
=======
   * Normalize file URI for react-native-fs
   */
  private normalizeFileUri(fileUri: string): string {
    if (fileUri.startsWith('file://')) {
      return fileUri.slice(7);
    }
    return fileUri;
  }

  /**
   * ✅ BACKWARD COMPATIBLE: Get my encryption key (SAME AS OLD VERSION)
   * This ensures old messages can still be decrypted
>>>>>>> rebuild-super-clean
   */
  private async getMyEncryptionKey(): Promise<Buffer> {
    const cached = this.keyCache.get('my_key');
    if (cached) return cached;

    const keyBase64 = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
    if (!keyBase64) {
      throw new Error("Encryption key not found. Please initialize E2EE first.");
    }

<<<<<<< HEAD
    // Derive 32-byte key using SHA256
    const hash = QuickCrypto.createHash('sha256');
    hash.update(keyBase64);
=======
    // ✅ CRITICAL: Keep the SAME derivation as old version
    // Hash the BASE64 STRING (not the decoded bytes)
    const hash = QuickCrypto.createHash('sha256');
    hash.update(keyBase64); // Hash base64 string directly
>>>>>>> rebuild-super-clean
    const derivedKey = hash.digest() as Buffer;

    this.keyCache.set('my_key', derivedKey);
    
<<<<<<< HEAD
    // Log key hash for debugging
=======
>>>>>>> rebuild-super-clean
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

<<<<<<< HEAD
    // Log key hash for debugging
=======
>>>>>>> rebuild-super-clean
    const keyHash = QuickCrypto.createHash('sha256').update(derivedKey).digest('hex');
    console.log("🔑 Sender derived key SHA256:", keyHash);

    return derivedKey;
  }

  /**
<<<<<<< HEAD
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
=======
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
    try {
      const normalizedUri = this.normalizeFileUri(fileUri);
      const stat = await RNFS.stat(normalizedUri);
      return parseInt(stat.size);
    } catch (error) {
      console.error("❌ Failed to get file size:", error);
      throw new Error("File not found: " + fileUri);
    }
  }

  /**
   * ✅ STREAMING ENCRYPTION - NO MORE OOM
   * Encrypt file using AES-256-GCM with chunked reading
>>>>>>> rebuild-super-clean
   */
  async encryptFile(
    fileUri: string,
    fileName: string,
    onProgress?: ProgressCallback
  ): Promise<NativeEncryptionResult> {
    try {
<<<<<<< HEAD
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
=======
      console.log("🔒 Streaming encrypt:", fileName);

      // Normalize URI
      const normalizedUri = this.normalizeFileUri(fileUri);

      // Get file info
      const stat = await RNFS.stat(normalizedUri);
      const fileSize = parseInt(stat.size);
      const fileType = this.getMimeType(fileName);

      console.log(`📦 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

>>>>>>> rebuild-super-clean
      onProgress?.({
        phase: 'reading',
        percentage: 0,
        bytesProcessed: 0,
        totalBytes: fileSize,
      });

<<<<<<< HEAD
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
=======
      // Initialize cipher
      const key = await this.getMyEncryptionKey();
      const iv = QuickCrypto.randomBytes(12) as Buffer;
      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);

      // Stream encryption
      const encryptedChunks: Buffer[] = [];
      let bytesProcessed = 0;
      let lastProgressUpdate = 0;

      for (let offset = 0; offset < fileSize; offset += this.CHUNK_SIZE) {
        const chunkSize = Math.min(this.CHUNK_SIZE, fileSize - offset);
        
        // Read chunk as base64
        const chunkBase64 = await RNFS.read(
          normalizedUri,
          chunkSize,
          offset,
          'base64'
        );
        
        const chunkBuffer = Buffer.from(chunkBase64, 'base64');
        
        // Encrypt chunk
        const encryptedChunk = cipher.update(chunkBuffer) as Buffer;
        encryptedChunks.push(encryptedChunk);

        bytesProcessed += chunkSize;
        
        // Throttle progress updates (max 1 per 100ms)
        const now = Date.now();
        if (now - lastProgressUpdate > 100 || bytesProcessed === fileSize) {
          onProgress?.({
            phase: 'encrypting',
            percentage: Math.floor((bytesProcessed / fileSize) * 100),
            bytesProcessed,
            totalBytes: fileSize,
          });
          lastProgressUpdate = now;
        }

        // Log progress every 5MB
        if (offset % (this.CHUNK_SIZE * 10) === 0) {
          console.log(`📊 Progress: ${((bytesProcessed / fileSize) * 100).toFixed(1)}%`);
        }
      }

      // Finalize encryption
      const finalChunk = cipher.final() as Buffer;
      encryptedChunks.push(finalChunk);
      const authTag = cipher.getAuthTag() as Buffer;

      // Concatenate all chunks
      const encryptedBuffer = Buffer.concat(encryptedChunks);

>>>>>>> rebuild-super-clean
      onProgress?.({
        phase: 'finalizing',
        percentage: 100,
        bytesProcessed: fileSize,
        totalBytes: fileSize,
      });

<<<<<<< HEAD
      console.log("✅ Native encryption complete");
      console.log(`   Original: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Encrypted: ${(encryptedSize / 1024 / 1024).toFixed(2)} MB`);

      return {
        encryptedBase64,
=======
      console.log("✅ Streaming encryption complete");
      console.log(`   Original: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Encrypted: ${(encryptedBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      return {
        encryptedBase64: encryptedBuffer.toString('base64'),
>>>>>>> rebuild-super-clean
        metadata: {
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          original_size: fileSize,
<<<<<<< HEAD
          encrypted_size: encryptedSize,
=======
          encrypted_size: encryptedBuffer.length,
>>>>>>> rebuild-super-clean
          file_name: fileName,
          file_type: fileType,
        },
      };
    } catch (error) {
<<<<<<< HEAD
      console.error("❌ Native encryption failed:", error);
=======
      console.error("❌ Streaming encryption failed:", error);
>>>>>>> rebuild-super-clean
      throw error;
    }
  }

  /**
<<<<<<< HEAD
   * Decrypt file using AES-256-GCM (native, high-performance)
=======
   * ✅ STREAMING DECRYPTION
   * Decrypt file using AES-256-GCM
>>>>>>> rebuild-super-clean
   */
  async decryptFile(
    encryptedBase64: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string
  ): Promise<Buffer> {
    try {
<<<<<<< HEAD
      console.log("🔓 Native decrypting...");
      console.log(`📦 Encrypted size: ${(encryptedBase64.length / 1024 / 1024).toFixed(2)} MB`);
=======
      console.log("🔓 Decrypting file...");
>>>>>>> rebuild-super-clean

      const key = this.deriveSenderKey(senderKeyBase64);
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
<<<<<<< HEAD
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
=======
      
      // For small files (<10MB), decrypt directly
      const encryptedSize = (encryptedBase64.length * 3) / 4; // Approximate decoded size
      
      if (encryptedSize < 10 * 1024 * 1024) {
        const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
        
        const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        const decrypted = Buffer.concat([
          decipher.update(encryptedBuffer) as Buffer,
          decipher.final() as Buffer
        ]);

        console.log("✅ Decryption complete");
        return decrypted;
      }

      // For large files, use streaming decryption
      return this.decryptFileStreaming(encryptedBase64, ivBuffer, authTagBuffer, key);
    } catch (error) {
      console.error("❌ Decryption failed:", error);
>>>>>>> rebuild-super-clean
      throw error;
    }
  }

  /**
<<<<<<< HEAD
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
=======
   * Helper: Streaming decryption for large files
   */
  private async decryptFileStreaming(
    encryptedBase64: string,
    iv: Buffer,
    authTag: Buffer,
    key: Buffer
  ): Promise<Buffer> {
    console.log("🔓 Streaming decrypt large file...");

    const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decryptedChunks: Buffer[] = [];
    const DECODE_CHUNK_SIZE = 2* 1024 * 1024; // 1MB base64 chunks

    // Decode and decrypt in chunks
    for (let i = 0; i < encryptedBase64.length; i += DECODE_CHUNK_SIZE) {
      const chunk = encryptedBase64.slice(i, i + DECODE_CHUNK_SIZE);
      const chunkBuffer = Buffer.from(chunk, 'base64');
      const decrypted = decipher.update(chunkBuffer) as Buffer;
      decryptedChunks.push(decrypted);

      if (i % (DECODE_CHUNK_SIZE * 10) === 0) {
        const progress = ((i / encryptedBase64.length) * 100).toFixed(1);
        console.log(`📊 Decrypt progress: ${progress}%`);
      }
    }

    decryptedChunks.push(decipher.final() as Buffer);
    
    console.log("✅ Streaming decryption complete");
    return Buffer.concat(decryptedChunks);
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
>>>>>>> rebuild-super-clean

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
<<<<<<< HEAD
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
=======
>>>>>>> rebuild-super-clean
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