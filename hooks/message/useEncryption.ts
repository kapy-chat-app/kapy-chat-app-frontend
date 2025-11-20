// hooks/message/useEncryption.ts - NATIVE CRYPTO VERSION
import { nativeEncryptionService } from "@/lib/encryption/NativeEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// Match server's expected format
export interface EncryptionResult {
  encryptedContent: string;
  encryptionMetadata: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
    iv?: string;
    authTag?: string;
  };
}

export const useEncryption = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken, userId } = useAuth();

  // Auto-initialize on mount
  useEffect(() => {
    if (userId) {
      initializeEncryption();
    }
  }, [userId]);

  const initializeEncryption = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Initialize native encryption keys
      const keys = await nativeEncryptionService.initializeKeys();

      const token = await getToken();
      if (!token) throw new Error("Authentication token not available");

      // Upload key to server
      console.log("📤 Uploading key to server...");
      const response = await fetch(`${API_BASE_URL}/api/keys/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publicKey: keys.publicKey }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to upload key");
      }

      setIsInitialized(true);
      console.log("✅ E2EE initialized with Native Crypto");
    } catch (err: any) {
      console.error("❌ E2EE initialization failed:", err);
      setError(err.message);
      setIsInitialized(false);
    } finally {
      setLoading(false);
    }
  }, [userId, getToken]);

  // Encrypt message - uses own key (sender's key)
  const encryptMessage = useCallback(
    async (recipientUserId: string, message: string): Promise<EncryptionResult> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        // Encrypt using native crypto
        const result = await nativeEncryptionService.encryptMessage(message);

        console.log('✅ Native encryption result:', {
          hasEncryptedContent: !!result.encryptedContent,
          hasIv: !!result.encryptionMetadata.iv,
          hasAuthTag: !!result.encryptionMetadata.authTag,
        });

        return {
          encryptedContent: result.encryptedContent,
          encryptionMetadata: {
            type: "WhisperMessage",
            iv: result.encryptionMetadata.iv,
            authTag: result.encryptionMetadata.authTag,
          },
        };
      } catch (err: any) {
        console.error("❌ Native encryption failed:", err);
        throw err;
      }
    },
    [isInitialized]
  );

  // Decrypt message - uses sender's key
  const decryptMessage = useCallback(
    async (senderId: string, encryptedContent: string): Promise<string> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        // Parse encrypted content to get iv and authTag
        let iv: string;
        let authTag: string;
        let data: string;

        try {
          const parsed = JSON.parse(encryptedContent);
          iv = parsed.iv;
          authTag = parsed.authTag || parsed.data; // Support both formats
          data = parsed.data || parsed.encryptedContent;
          
          // If old format (XOR encryption), data contains the encrypted content
          if (!parsed.authTag && parsed.data) {
            // This is old CryptoJS format, need to handle differently
            console.log("⚠️ Detected old encryption format, attempting compatibility decrypt");
            
            // Get sender's public key
            const response = await fetch(`${API_BASE_URL}/api/keys/${senderId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || "Failed to get sender key");
            }
            
            // For old format, we need to use the old decryption method
            // This maintains backward compatibility
            const { simpleEncryptionService } = await import("@/lib/encryption/EncryptionService");
            return await simpleEncryptionService.decryptMessage(
              encryptedContent,
              senderId,
              API_BASE_URL,
              token
            );
          }
        } catch (parseError) {
          console.error("❌ Failed to parse encrypted content:", parseError);
          throw new Error("Invalid encrypted content format");
        }

        // Get sender's public key from server
        console.log("🔄 Fetching sender key for decryption:", senderId);
        const response = await fetch(`${API_BASE_URL}/api/keys/${senderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to get sender key");
        }

        const senderKeyBase64 = result.data.publicKey;

        // Decrypt using native crypto
        const decrypted = await nativeEncryptionService.decryptMessage(
          data,
          iv,
          authTag,
          senderKeyBase64
        );

        console.log("✅ Native decryption successful");
        return decrypted;
      } catch (err: any) {
        console.error("❌ Native decryption failed:", err);
        throw err;
      }
    },
    [isInitialized, getToken]
  );

  const clearEncryption = useCallback(async () => {
    await nativeEncryptionService.clearKeys();
    nativeEncryptionService.clearCache();
    setIsInitialized(false);
  }, []);

  return {
    isInitialized,
    initializeEncryption,
    encryptMessage,
    decryptMessage,
    clearEncryption,
    loading,
    error,
  };
};