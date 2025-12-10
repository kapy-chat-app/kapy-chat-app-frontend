// hooks/message/useEncryption.ts - Double Encryption
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { UnifiedEncryptionService } from "@/lib/encryption/UnifiedEncryptionService";
import { useEncryptionContext } from "@/components/page/message/EncryptionInitProvider";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const useEncryption = () => {
  const { isReady: globalReady, loading: globalLoading, error: globalError } = useEncryptionContext();
  const [isInitialized, setIsInitialized] = useState(globalReady);
  const { getToken, userId } = useAuth();

  const keyCache = new Map<string, string>();

  useEffect(() => {
    setIsInitialized(globalReady);
  }, [globalReady]);

  const encryptMessage = useCallback(
    async (recipientUserId: string, message: string) => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      const token = await getToken();
      
      const [recipientKeyRes, myKeyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/keys/${recipientUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/keys/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [recipientKeyData, myKeyData] = await Promise.all([
        recipientKeyRes.json(),
        myKeyRes.json(),
      ]);

      if (!recipientKeyData.success || !myKeyData.success) {
        throw new Error("Failed to get encryption keys");
      }

      const [forRecipient, forSelf] = await Promise.all([
        UnifiedEncryptionService.encryptMessage(message, recipientKeyData.data.publicKey),
        UnifiedEncryptionService.encryptMessage(message, myKeyData.data.publicKey),
      ]);

      return {
        encryptedContent: JSON.stringify({
          recipient_encrypted: JSON.parse(forRecipient.encryptedContent),
          sender_encrypted: JSON.parse(forSelf.encryptedContent),
        }),
        encryptionMetadata: {
          type: "PreKeyWhisperMessage",
        },
      };
    },
    [isInitialized, getToken, userId]
  );

  const decryptMessage = useCallback(
    async (senderId: string, encryptedContent: string) => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        const parsed = JSON.parse(encryptedContent);

        let dataToDecrypt;
        if (senderId === userId) {
          dataToDecrypt = parsed.sender_encrypted;
        } else {
          dataToDecrypt = parsed.recipient_encrypted;
        }

        if (!dataToDecrypt || !dataToDecrypt.iv || !dataToDecrypt.authTag || !dataToDecrypt.data) {
          throw new Error("Invalid encrypted content structure");
        }

        let myKey = keyCache.get(userId!);
        
        if (!myKey) {
          const token = await getToken();
          const myKeyResponse = await fetch(`${API_BASE_URL}/api/keys/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const myKeyResult = await myKeyResponse.json();
          if (!myKeyResult.success) {
            throw new Error("Failed to get your decryption key");
          }

          myKey = myKeyResult.data.publicKey;
          keyCache.set(userId!, myKey);
        }

        const decrypted = await UnifiedEncryptionService.decryptMessage(
          dataToDecrypt.data,
          dataToDecrypt.iv,
          dataToDecrypt.authTag,
          myKey
        );

        return decrypted;
      } catch (error: any) {
        console.error("❌ [DECRYPT] Failed:", error.message);
        return "[🔒 Decryption failed]";
      }
    },
    [isInitialized, getToken, userId]
  );

  return {
    isInitialized,
    encryptMessage,
    decryptMessage,
    loading: globalLoading,
    error: globalError,
  };
};