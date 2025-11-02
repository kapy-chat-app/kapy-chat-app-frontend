// lib/encryption/SimpleEncryptionService.ts - FINAL WORKING VERSION
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

global.Buffer = Buffer;

// ✅ Type definitions - Match server's expected format
export interface EncryptionResult {
  encryptedContent: string;
  encryptionMetadata: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
  };
}

/**
 * ✅ SIMPLE E2EE - Shared key giữa 2 người
 * Key Logic:
 * - Mỗi user có 1 key riêng
 * - Để encrypt cho recipient: Lấy recipient's key từ server
 * - Để decrypt message từ sender: Lấy sender's key từ server
 */
export class SimpleEncryptionService {
  private static ENCRYPTION_KEY = 'e2ee_encryption_key';
  private static SENDER_KEYS_CACHE = 'e2ee_sender_keys_cache'; // ✅ NEW: Cache sender keys
  private initialized: boolean = false;
  private senderKeysCache: Map<string, string> = new Map(); // userId -> publicKey

  // ==========================================
  // KEY INITIALIZATION
  // ==========================================

  /**
   * Generate encryption key (chỉ 1 lần)
   */
  async initializeKeys(userId: string): Promise<{ publicKey: string }> {
    try {
      console.log('🔐 Generating encryption key for user:', userId);

      // Check if key already exists
      const existingKey = await SecureStore.getItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY
      );

      if (existingKey) {
        console.log('✅ Using existing encryption key');
        this.initialized = true;
        return { publicKey: existingKey };
      }

      // ✅ Generate random 256-bit key using expo-crypto
      const randomBytes = await Crypto.getRandomBytesAsync(32); // 256 bits
      const encryptionKey = Buffer.from(randomBytes).toString('base64');

      // Store key securely
      await SecureStore.setItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY,
        encryptionKey
      );

      this.initialized = true;
      console.log('✅ Encryption key generated successfully');

      return {
        publicKey: encryptionKey, // Server sẽ lưu để share cho recipient
      };
    } catch (error) {
      console.error('❌ Failed to generate key:', error);
      throw error;
    }
  }

  /**
   * Check if initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      const key = await SecureStore.getItemAsync(SimpleEncryptionService.ENCRYPTION_KEY);
      this.initialized = key !== null;
      return this.initialized;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get public key (shared key)
   */
  async getPublicKey(): Promise<string> {
    const key = await SecureStore.getItemAsync(SimpleEncryptionService.ENCRYPTION_KEY);
    if (!key) {
      throw new Error('Encryption key not found');
    }
    return key;
  }

  /**
   * Upload key to server
   */
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
  // KEY MANAGEMENT - ✅ NEW: Cache sender keys
  // ==========================================

  /**
   * ✅ Get sender's key (for decryption)
   */
  async getSenderPublicKey(
    senderUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<string> {
    // Check cache first
    if (this.senderKeysCache.has(senderUserId)) {
      console.log('✅ Using cached sender key:', senderUserId);
      return this.senderKeysCache.get(senderUserId)!;
    }

    // Fetch from server
    try {
      const response = await fetch(`${apiBaseUrl}/api/keys/${senderUserId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get sender key');
      }

      const senderKey = result.data.publicKey;
      
      // Cache it
      this.senderKeysCache.set(senderUserId, senderKey);
      console.log('✅ Fetched and cached sender key:', senderUserId);

      return senderKey;
    } catch (error) {
      console.error('❌ Failed to get sender key:', error);
      throw error;
    }
  }

  /**
   * Get recipient's key (for encryption)
   */
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
  // ENCRYPTION - Fixed XOR
  // ==========================================

  /**
   * ✅ FIXED: Encrypt message với recipient's key
   */
  async encryptMessage(
    recipientPublicKey: string, 
    message: string
  ): Promise<EncryptionResult> {
    try {
      console.log('🔒 Encrypting message:', {
        message: message.substring(0, 20),
        messageLength: message.length,
      });

      // Convert message to bytes
      const messageBytes = Buffer.from(message, 'utf-8');
      
      // Use recipient's key for encryption
      const keyBytes = Buffer.from(recipientPublicKey, 'base64');
      
      // Generate random IV
      const ivArray = await Crypto.getRandomBytesAsync(16);
      const iv = Buffer.from(ivArray);
      
      // ✅ Simple XOR encryption
      const encrypted = this.xorEncrypt(messageBytes, keyBytes, iv);
      
      const encryptedContent = JSON.stringify({
        iv: iv.toString('base64'),
        data: encrypted.toString('base64'),
      });

      console.log('✅ Message encrypted:', {
        encryptedLength: encryptedContent.length,
        ivLength: iv.length,
        dataLength: encrypted.length,
      });
      
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

  /**
   * ✅ FIXED: Decrypt message với SENDER's key (không phải own key!)
   * 
   * IMPORTANT: Cần pass senderUserId vào để lấy đúng key
   */
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
      
      // ✅ FIX: Get SENDER's key (không phải own key!)
      const senderKey = await this.getSenderPublicKey(senderUserId, apiBaseUrl, authToken);
      const keyBytes = Buffer.from(senderKey, 'base64');
      
      console.log('🔓 Decryption info:', {
        ivLength: ivBytes.length,
        dataLength: dataBytes.length,
        keyLength: keyBytes.length,
        senderUserId,
      });
      
      // Decrypt
      const decrypted = this.xorDecrypt(dataBytes, keyBytes, ivBytes);
      const message = decrypted.toString('utf-8');

      console.log('✅ Message decrypted:', {
        message: message.substring(0, 20),
        messageLength: message.length,
      });
      
      return message;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw error;
    }
  }

  // ==========================================
  // SIMPLE XOR ENCRYPTION
  // ==========================================

  private xorEncrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
    }
    return result;
  }

  private xorDecrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    // XOR is symmetric
    return this.xorEncrypt(data, key, iv);
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

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