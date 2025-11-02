// hooks/message/useEncryption.ts - FIXED VERSION
import { simpleEncryptionService } from "@/lib/encryption/EncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// ✅ Match server's expected format
export interface EncryptionResult {
  encryptedContent: string;
  encryptionMetadata: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
  };
}

export const useEncryption = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken, userId } = useAuth();

  // ✅ Auto-initialize on mount
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

      // Check if already initialized locally
      const alreadyInitialized = await simpleEncryptionService.isInitialized();
      if (alreadyInitialized) {
        console.log("✅ E2EE already initialized locally");
        setIsInitialized(true);
        setLoading(false);
        return;
      }

      console.log("🔐 Initializing E2EE for first time...");
      const keys = await simpleEncryptionService.initializeKeys(userId);

      const token = await getToken();
      if (!token) throw new Error("Authentication token not available");

      await simpleEncryptionService.uploadKeysToServer(API_BASE_URL, token);

      setIsInitialized(true);
      console.log("✅ E2EE initialized successfully");
    } catch (err: any) {
      console.error("❌ E2EE initialization failed:", err);
      setError(err.message);
      setIsInitialized(false);
    } finally {
      setLoading(false);
    }
  }, [userId, getToken]);

  // ✅ Encrypt với recipient's key
  const encryptMessage = useCallback(
    async (recipientUserId: string, message: string): Promise<EncryptionResult> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available");
      }

      // Get recipient's public key from server
      const recipientPublicKey = await simpleEncryptionService.getRecipientPublicKey(
        recipientUserId,
        API_BASE_URL,
        token
      );

      // Encrypt message
      const result = await simpleEncryptionService.encryptMessage(
        recipientPublicKey,
        message
      );

      console.log('✅ Encryption result:', {
        hasEncryptedContent: !!result.encryptedContent,
        metadataType: result.encryptionMetadata.type,
      });

      return result;
    },
    [isInitialized, getToken]
  );

  // ✅ FIXED: Decrypt với SENDER's key
  const decryptMessage = useCallback(
    async (senderId: string, encryptedContent: string): Promise<string> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available");
      }
      
      // ✅ FIX: Pass senderUserId để lấy đúng key
      return await simpleEncryptionService.decryptMessage(
        encryptedContent,
        senderId, // ✅ IMPORTANT: sender's userId
        API_BASE_URL,
        token
      );
    },
    [isInitialized, getToken]
  );

  const clearEncryption = useCallback(async () => {
    await simpleEncryptionService.clearKeys();
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