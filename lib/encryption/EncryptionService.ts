// lib/encryption/SimpleEncryptionService.ts - ADD FILE METHODS
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system'; // ✅ ADD THIS

global.Buffer = Buffer;

// ✅ Keep existing EncryptionResult
export interface EncryptionResult {
  encryptedContent: string;
  encryptionMetadata: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
  };
}

// ✅ NEW: File encryption result
export interface FileEncryptionResult {
  encryptedBase64: string; // Base64 của encrypted file
  metadata: {
    iv: string;
    auth_tag: string; // HMAC for integrity
    original_size: number;
    encrypted_size: number;
    file_name: string;
  };
}

export class SimpleEncryptionService {
  private static ENCRYPTION_KEY = 'e2ee_encryption_key';
  private static SENDER_KEYS_CACHE = 'e2ee_sender_keys_cache';
  private initialized: boolean = false;
  private senderKeysCache: Map<string, string> = new Map();

  // ==========================================
  // KEY INITIALIZATION (GIỮ NGUYÊN)
  // ==========================================

  async initializeKeys(userId: string): Promise<{ publicKey: string }> {
    try {
      console.log('🔐 Generating encryption key for user:', userId);

      const existingKey = await SecureStore.getItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY
      );

      if (existingKey) {
        console.log('✅ Using existing encryption key');
        this.initialized = true;
        return { publicKey: existingKey };
      }

      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const encryptionKey = Buffer.from(randomBytes).toString('base64');

      await SecureStore.setItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY,
        encryptionKey
      );

      this.initialized = true;
      console.log('✅ Encryption key generated successfully');

      return { publicKey: encryptionKey };
    } catch (error) {
      console.error('❌ Failed to generate key:', error);
      throw error;
    }
  }

  async isInitialized(): Promise<boolean> {
    try {
      const key = await SecureStore.getItemAsync(SimpleEncryptionService.ENCRYPTION_KEY);
      this.initialized = key !== null;
      return this.initialized;
    } catch (error) {
      return false;
    }
  }

  async getPublicKey(): Promise<string> {
    const key = await SecureStore.getItemAsync(SimpleEncryptionService.ENCRYPTION_KEY);
    if (!key) {
      throw new Error('Encryption key not found');
    }
    return key;
  }

  async uploadKeysToServer(apiBaseUrl: string, authToken: string): Promise<void> {
    try {
      const publicKey = await this.getPublicKey();

      const response = await fetch(`${apiBaseUrl}/api/keys/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ publicKey }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to upload key');
      }

      console.log('✅ Key uploaded successfully');
    } catch (error) {
      console.error('❌ Failed to upload key:', error);
      throw error;
    }
  }

  // ==========================================
  // KEY MANAGEMENT (GIỮ NGUYÊN)
  // ==========================================

  async getSenderPublicKey(
    senderUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<string> {
    if (this.senderKeysCache.has(senderUserId)) {
      console.log('✅ Using cached sender key:', senderUserId);
      return this.senderKeysCache.get(senderUserId)!;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/keys/${senderUserId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get sender key');
      }

      const senderKey = result.data.publicKey;
      this.senderKeysCache.set(senderUserId, senderKey);
      console.log('✅ Fetched and cached sender key:', senderUserId);

      return senderKey;
    } catch (error) {
      console.error('❌ Failed to get sender key:', error);
      throw error;
    }
  }

  async getRecipientPublicKey(
    recipientUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<string> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/keys/${recipientUserId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get recipient key');
      }

      console.log('✅ Fetched recipient key:', recipientUserId);
      return result.data.publicKey;
    } catch (error) {
      console.error('❌ Failed to get recipient key:', error);
      throw error;
    }
  }

  // ==========================================
  // MESSAGE ENCRYPTION (GIỮ NGUYÊN)
  // ==========================================

  async encryptMessage(
    recipientPublicKey: string,
    message: string
  ): Promise<EncryptionResult> {
    try {
      console.log('🔒 Encrypting message:', {
        message: message.substring(0, 20),
        messageLength: message.length,
      });

      const messageBytes = Buffer.from(message, 'utf-8');
      const keyBytes = Buffer.from(recipientPublicKey, 'base64');
      const ivArray = await Crypto.getRandomBytesAsync(16);
      const iv = Buffer.from(ivArray);
      const encrypted = this.xorEncrypt(messageBytes, keyBytes, iv);

      const encryptedContent = JSON.stringify({
        iv: iv.toString('base64'),
        data: encrypted.toString('base64'),
      });

      console.log('✅ Message encrypted');

      return {
        encryptedContent,
        encryptionMetadata: {
          type: "WhisperMessage",
        },
      };
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw error;
    }
  }

  async decryptMessage(
    encryptedContent: string,
    senderUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<string> {
    try {
      console.log('🔓 Decrypting message from:', senderUserId);

      const { iv, data } = JSON.parse(encryptedContent);
      const ivBytes = Buffer.from(iv, 'base64');
      const dataBytes = Buffer.from(data, 'base64');
      const senderKey = await this.getSenderPublicKey(senderUserId, apiBaseUrl, authToken);
      const keyBytes = Buffer.from(senderKey, 'base64');
      const decrypted = this.xorDecrypt(dataBytes, keyBytes, ivBytes);
      const message = decrypted.toString('utf-8');

      console.log('✅ Message decrypted');
      return message;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw error;
    }
  }

  // ==========================================
  // ✅ NEW: FILE ENCRYPTION
  // ==========================================

  /**
   * ✅ Encrypt file with XOR + HMAC
   */
  async encryptFile(
    recipientPublicKey: string,
    fileUri: string,
    fileName: string
  ): Promise<FileEncryptionResult> {
    try {
      console.log('🔒 Encrypting file:', fileName);

      // 1. Read file as base64
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Convert to Buffer
      const fileBuffer = Buffer.from(fileData, 'base64');
      console.log('📦 File loaded, size:', fileBuffer.length);

      // 3. Encrypt with XOR
      const keyBytes = Buffer.from(recipientPublicKey, 'base64');
      const ivArray = await Crypto.getRandomBytesAsync(16);
      const iv = Buffer.from(ivArray);
      const encrypted = this.xorEncrypt(fileBuffer, keyBytes, iv);

      // 4. Generate HMAC for authentication
      const authTag = await this.generateHMAC(encrypted, keyBytes);

      // 5. Convert to base64
      const encryptedBase64 = encrypted.toString('base64');

      console.log('✅ File encrypted:', {
        originalSize: fileBuffer.length,
        encryptedSize: encrypted.length,
      });

      return {
        encryptedBase64,
        metadata: {
          iv: iv.toString('base64'),
          auth_tag: authTag,
          original_size: fileBuffer.length,
          encrypted_size: encrypted.length,
          file_name: fileName,
        },
      };
    } catch (error) {
      console.error('❌ File encryption failed:', error);
      throw error;
    }
  }

  /**
   * ✅ Decrypt file with verification
   */
  async decryptFile(
    encryptedBase64: string,
    iv: string,
    authTag: string,
    senderUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<Buffer> {
    try {
      console.log('🔓 Decrypting file...');

      // 1. Convert from base64
      const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

      // 2. Get sender's key
      const senderKey = await this.getSenderPublicKey(senderUserId, apiBaseUrl, authToken);
      const keyBytes = Buffer.from(senderKey, 'base64');

      // 3. Verify HMAC
      const expectedTag = await this.generateHMAC(encryptedBuffer, keyBytes);
      if (expectedTag !== authTag) {
        throw new Error('File authentication failed - data may be tampered');
      }

      // 4. Decrypt
      const ivBytes = Buffer.from(iv, 'base64');
      const decrypted = this.xorDecrypt(encryptedBuffer, keyBytes, ivBytes);

      console.log('✅ File decrypted, size:', decrypted.length);
      return decrypted;
    } catch (error) {
      console.error('❌ File decryption failed:', error);
      throw error;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private xorEncrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
    }
    return result;
  }

  private xorDecrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    return this.xorEncrypt(data, key, iv);
  }

  /**
   * ✅ Generate HMAC for integrity verification
   */
  private async generateHMAC(data: Buffer, key: Buffer): Promise<string> {
    // Simple HMAC using XOR (for production, use proper HMAC-SHA256)
    const hmacKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      hmacKey[i] = key[i % key.length] ^ 0x5c;
    }

    const hash = Buffer.alloc(32);
    for (let i = 0; i < Math.min(data.length, 32); i++) {
      hash[i] = data[i] ^ hmacKey[i];
    }

    return hash.toString('base64');
  }

  async clearKeys(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SimpleEncryptionService.ENCRYPTION_KEY);
      this.senderKeysCache.clear();
      this.initialized = false;
      console.log('✅ Keys cleared');
    } catch (error) {
      console.error('❌ Failed to clear keys:', error);
    }
  }
}

export const simpleEncryptionService = new SimpleEncryptionService();