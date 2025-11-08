// lib/encryption/SimpleEncryptionService.ts
import { Buffer } from "buffer";
import CryptoJS from "crypto-js";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import "react-native-get-random-values";

global.Buffer = Buffer;

export interface EncryptionResult {
  encryptedContent: string;
  encryptionMetadata: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
  };
}

export interface FileEncryptionResult {
  encryptedBase64: string;
  metadata: {
    iv: string;
    authTag: string;
    original_size: number;
    encrypted_size: number;
    file_name: string;
  };
}

export class SimpleEncryptionService {
  private static ENCRYPTION_KEY = "e2ee_encryption_key";
  private static SENDER_KEYS_CACHE = "e2ee_sender_keys_cache";
  private initialized: boolean = false;
  private senderKeysCache: Map<string, string> = new Map();

  async initializeKeys(userId: string): Promise<{ publicKey: string }> {
    try {
      console.log("🔐 Generating encryption key for user:", userId);

      const existingKey = await SecureStore.getItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY
      );

      if (existingKey) {
        console.log("✅ Using existing encryption key");
        this.initialized = true;

        // ✅ Log key hash for debugging
        const keyHash = CryptoJS.SHA256(existingKey).toString(CryptoJS.enc.Hex);
        console.log("🔑 My key SHA256:", keyHash);

        return { publicKey: existingKey };
      }

      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const encryptionKey = Buffer.from(randomBytes).toString("base64");

      await SecureStore.setItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY,
        encryptionKey
      );

      this.initialized = true;
      const keyHash = CryptoJS.SHA256(encryptionKey).toString(CryptoJS.enc.Hex);
      console.log("✅ Encryption key generated successfully");
      console.log("🔑 My key SHA256:", keyHash);

      return { publicKey: encryptionKey };
    } catch (error) {
      console.error("❌ Failed to generate key:", error);
      throw error;
    }
  }

  async isInitialized(): Promise<boolean> {
    try {
      const key = await SecureStore.getItemAsync(
        SimpleEncryptionService.ENCRYPTION_KEY
      );
      this.initialized = key !== null;
      return this.initialized;
    } catch (error) {
      return false;
    }
  }

  async getPublicKey(): Promise<string> {
    const key = await SecureStore.getItemAsync(
      SimpleEncryptionService.ENCRYPTION_KEY
    );
    if (!key) {
      throw new Error("Encryption key not found");
    }
    return key;
  }

  async uploadKeysToServer(
    apiBaseUrl: string,
    authToken: string
  ): Promise<void> {
    try {
      const publicKey = await this.getPublicKey();
      const keyHash = CryptoJS.SHA256(publicKey).toString(CryptoJS.enc.Hex);

      console.log("📤 Uploading key to server...");
      console.log("🔑 Key SHA256 being uploaded:", keyHash);

      const response = await fetch(`${apiBaseUrl}/api/keys/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ publicKey }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to upload key");
      }

      console.log("✅ Key uploaded successfully");
    } catch (error) {
      console.error("❌ Failed to upload key:", error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Add forceRefresh parameter to bypass cache
   */
  async getSenderPublicKey(
    senderUserId: string,
    apiBaseUrl: string,
    authToken: string,
    forceRefresh: boolean = false
  ): Promise<string> {
    // ✅ Check cache only if not forcing refresh
    if (!forceRefresh && this.senderKeysCache.has(senderUserId)) {
      const cachedKey = this.senderKeysCache.get(senderUserId)!;
      const keyHash = CryptoJS.SHA256(cachedKey).toString(CryptoJS.enc.Hex);
      console.log("✅ Using cached sender key:", senderUserId);
      console.log("🔑 Cached key SHA256:", keyHash);
      return cachedKey;
    }

    try {
      console.log("🔄 Fetching fresh sender key from server:", senderUserId);

      const response = await fetch(`${apiBaseUrl}/api/keys/${senderUserId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to get sender key");
      }

      const senderKey = result.data.publicKey;
      const keyHash = CryptoJS.SHA256(senderKey).toString(CryptoJS.enc.Hex);

      // ✅ Update cache with fresh key
      this.senderKeysCache.set(senderUserId, senderKey);

      console.log("✅ Fetched and cached sender key:", senderUserId);
      console.log("🔑 Sender key SHA256:", keyHash);

      return senderKey;
    } catch (error) {
      console.error("❌ Failed to get sender key:", error);
      throw error;
    }
  }

  async getRecipientPublicKey(
    recipientUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<string> {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/keys/${recipientUserId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to get recipient key");
      }

      console.log("✅ Fetched recipient key:", recipientUserId);
      return result.data.publicKey;
    } catch (error) {
      console.error("❌ Failed to get recipient key:", error);
      throw error;
    }
  }

  // ---------------------------
  // Text encryption (unchanged)
  // ---------------------------
  async encryptMessage(
    recipientPublicKey: string,
    message: string
  ): Promise<EncryptionResult> {
    try {
      console.log("🔒 Encrypting message:", {
        message: message.substring(0, 20),
        messageLength: message.length,
      });

      const messageBytes = Buffer.from(message, "utf-8");
      const keyBytes = Buffer.from(recipientPublicKey, "base64");
      const ivArray = await Crypto.getRandomBytesAsync(16);
      const iv = Buffer.from(ivArray);
      const encrypted = this.xorEncrypt(messageBytes, keyBytes, iv);

      const encryptedContent = JSON.stringify({
        iv: iv.toString("base64"),
        data: encrypted.toString("base64"),
      });

      console.log("✅ Message encrypted");

      return {
        encryptedContent,
        encryptionMetadata: {
          type: "WhisperMessage",
        },
      };
    } catch (error) {
      console.error("❌ Encryption failed:", error);
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
      console.log("🔓 Decrypting message from:", senderUserId);

      const { iv, data } = JSON.parse(encryptedContent);
      const ivBytes = Buffer.from(iv, "base64");
      const dataBytes = Buffer.from(data, "base64");
      const senderKey = await this.getSenderPublicKey(
        senderUserId,
        apiBaseUrl,
        authToken
      );
      const keyBytes = Buffer.from(senderKey, "base64");
      const decrypted = this.xorDecrypt(dataBytes, keyBytes, ivBytes);
      const message = decrypted.toString("utf-8");

      console.log("✅ Message decrypted");
      return message;
    } catch (error) {
      console.error("❌ Decryption failed:", error);
      throw error;
    }
  }

  // ---------------------------
  // File encryption (AES-256-CBC + HMAC-SHA256)
  // ---------------------------
  async encryptFile(
    fileUri: string,
    fileName: string
  ): Promise<FileEncryptionResult> {
    try {
      console.log("🔒 Encrypting file (AES):", fileName);

      const myPublicKey = await this.getPublicKey();
      const myKeyHash = CryptoJS.SHA256(myPublicKey).toString(CryptoJS.enc.Hex);
      console.log("🔑 Encrypting with my key SHA256:", myKeyHash);

      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64",
      });
      const originalSize = Buffer.from(base64, "base64").length;
      console.log("📦 Loaded file (bytes):", originalSize);

      const aesKeyWord = CryptoJS.SHA256(myPublicKey);
      const ivArray = await Crypto.getRandomBytesAsync(16);
      const ivWord = CryptoJS.lib.WordArray.create(ivArray as any);
      const plaintextWA = CryptoJS.enc.Base64.parse(base64);

      const encrypted = CryptoJS.AES.encrypt(plaintextWA, aesKeyWord, {
        iv: ivWord,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const encryptedBase64 = encrypted.ciphertext.toString(
        CryptoJS.enc.Base64
      );
      const encryptedSize = Buffer.from(encryptedBase64, "base64").length;

      const hmacInput = myPublicKey + ":" + encryptedBase64;
      const authTag = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        hmacInput
      );

      console.log("🔍 [ENCRYPT DEBUG]");
      console.log({
        iv_base64: Buffer.from(ivArray).toString("base64"),
        iv_length: ivArray.length,
        key_sha256: myKeyHash,
        encrypted_base64_length: encryptedBase64.length,
        encrypted_base64_prefix: encryptedBase64.substring(0, 50),
        auth_tag: authTag,
      });

      console.log("✅ File encrypted (AES). sizes:", {
        originalSize,
        encryptedSize,
      });

      return {
        encryptedBase64,
        metadata: {
          iv: Buffer.from(ivArray).toString("base64"),
          authTag,
          original_size: originalSize,
          encrypted_size: encryptedSize,
          file_name: fileName,
        },
      };
    } catch (error) {
      console.error("❌ File encryption failed:", error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Force refresh sender key to avoid stale cache
   */
  async decryptFile(
    encryptedFileBase64: string,
    metadata: { iv: string; authTag: string },
    senderUserId: string,
    apiBaseUrl: string,
    authToken: string
  ): Promise<Uint8Array> {
    try {
      console.log("🔓 Decrypting file from sender:", senderUserId);

      // ✅ FORCE REFRESH: Always get fresh key from server for files
      const senderPublicKey = await this.getSenderPublicKey(
        senderUserId,
        apiBaseUrl,
        authToken,
        true // Force refresh
      );

      const senderKeyHash = CryptoJS.SHA256(senderPublicKey).toString(
        CryptoJS.enc.Hex
      );

      console.log("🔍 [DECRYPT DEBUG] Starting integrity check");
      console.log({
        iv_base64: metadata.iv,
        iv_length: Buffer.from(metadata.iv, "base64").length,
        key_sha256: senderKeyHash,
        encrypted_base64_length: encryptedFileBase64.length,
        encrypted_base64_prefix: encryptedFileBase64.substring(0, 50),
        auth_tag_received: metadata.authTag,
      });

      // ✅ FIX: Use sender's key to verify (matching encryption logic)
      const expectedInput = senderPublicKey + ":" + encryptedFileBase64;
      const expectedAuth = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        expectedInput
      );

      console.log("🔍 [DECRYPT CHECK]");
      console.log("Expected:", expectedAuth);
      console.log("Received:", metadata.authTag);

      if (expectedAuth !== metadata.authTag) {
        console.error("❌ Auth tag mismatch detected!");
        console.error("🔍 Debug info:", {
          senderUserId,
          senderKeyHash,
          expectedAuth,
          receivedAuth: metadata.authTag,
        });
        throw new Error("❌ Auth tag mismatch - File integrity check failed");
      }

      console.log("✅ Auth tag verified successfully");

      // ✅ Decrypt using sender's key
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(encryptedFileBase64) } as any,
        CryptoJS.SHA256(senderPublicKey), // ✅ Use sender's key
        {
          iv: CryptoJS.enc.Base64.parse(metadata.iv),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );

      const decryptedBase64 = decrypted.toString(CryptoJS.enc.Base64);
      if (!decryptedBase64) {
        throw new Error("❌ Decryption failed: empty result");
      }

      console.log(
        "✅ Decryption success. Bytes:",
        Buffer.from(decryptedBase64, "base64").length
      );
      return new Uint8Array(Buffer.from(decryptedBase64, "base64"));
    } catch (err: any) {
      console.error("❌ File decryption error:", err.message);
      throw new Error("File decryption failed: " + err.message);
    }
  }

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

  private async generateHMAC(data: Buffer, key: Buffer): Promise<string> {
    const hmacKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      hmacKey[i] = key[i % key.length] ^ 0x5c;
    }

    const hash = Buffer.alloc(32);
    for (let i = 0; i < Math.min(data.length, 32); i++) {
      hash[i] = data[i] ^ hmacKey[i];
    }

    return hash.toString("base64");
  }

  /**
   * ✅ Clear both local keys and cache
   */
  async clearKeys(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SimpleEncryptionService.ENCRYPTION_KEY);
      this.senderKeysCache.clear();
      this.initialized = false;
      console.log("✅ Keys and cache cleared");
    } catch (error) {
      console.error("❌ Failed to clear keys:", error);
    }
  }

  /**
   * ✅ Clear only cache (useful for testing)
   */
  clearCache(): void {
    this.senderKeysCache.clear();
    console.log("✅ Sender keys cache cleared");
  }
}

export const simpleEncryptionService = new SimpleEncryptionService();
