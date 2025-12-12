// hooks/message/useFileEncryption.ts - UPDATED WITH UnifiedEncryptionService
import { UnifiedEncryptionService } from "@/lib/encryption/UnifiedEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useMemo } from "react";
import { useEncryption } from "./useEncryption";
import * as FileSystem from "expo-file-system/legacy";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const useFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken } = useAuth();

  // Helper: Get MIME type from file name
  const getMimeType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      mp4: "video/mp4",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  };

  /**
   * ✅ UPDATED: Encrypt file using UnifiedEncryptionService
   */
  const encryptFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      recipientUserId?: string
    ): Promise<{
      encryptedBase64: string;
      metadata: {
        iv: string;
        authTag: string;
        original_size: number;
        encrypted_size: number;
        file_name: string;
        file_type: string;
      };
    }> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        console.log("🔒 Encrypting file:", fileName);

        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        // Get recipient's public key
        let recipientKey: string | undefined;
        if (recipientUserId) {
          const keyResponse = await fetch(
            `${API_BASE_URL}/api/keys/${recipientUserId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          const keyResult = await keyResponse.json();
          if (!keyResult.success) {
            throw new Error("Failed to get recipient key");
          }
          recipientKey = keyResult.data.publicKey;
        }

        // ✅ CRITICAL: Use UnifiedEncryptionService.encryptFile
        // Automatically uses native (Android) or JS (iOS)
        const result = await UnifiedEncryptionService.encryptFile(
          fileUri,
          fileName,
          recipientKey || '', // Pass recipient key for shared secret
          undefined // No progress callback for small files
        );

        console.log("✅ File encrypted successfully:", {
          fileName,
          originalSize: result.metadata.original_size,
          encryptedSize: result.metadata.encrypted_size,
        });

        return {
          encryptedBase64: result.encryptedBase64,
          metadata: {
            iv: result.metadata.iv,
            authTag: result.metadata.authTag,
            original_size: result.metadata.original_size,
            encrypted_size: result.metadata.encrypted_size,
            file_name: fileName,
            file_type: result.metadata.file_type,
          },
        };
      } catch (error) {
        console.error("❌ File encryption failed:", error);
        throw error;
      }
    },
    [isInitialized, getToken]
  );

  /**
   * ✅ UPDATED: Decrypt file using UnifiedEncryptionService
   */
  const decryptFile = useCallback(
    async (
      encryptedBase64: string,
      iv: string,
      authTag: string,
      senderUserId: string
    ): Promise<Buffer> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        console.log("🔓 Decrypting file from sender:", senderUserId);

        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        // Get sender's public key
        const keyResponse = await fetch(
          `${API_BASE_URL}/api/keys/${senderUserId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const keyResult = await keyResponse.json();
        if (!keyResult.success) {
          throw new Error("Failed to get sender key");
        }

        const senderKey = keyResult.data.publicKey;

        // ✅ CRITICAL: Use UnifiedEncryptionService.decryptFile
        const outputPath = `${FileSystem.cacheDirectory}temp_decrypt_${Date.now()}.bin`;
        
        await UnifiedEncryptionService.decryptFile(
          encryptedBase64,
          iv,
          authTag,
          senderKey,
          outputPath
        );

        // Read decrypted file as buffer
        const base64Data = await FileSystem.readAsStringAsync(outputPath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Clean up temp file
        await FileSystem.deleteAsync(outputPath, { idempotent: true });

        const buffer = Buffer.from(base64Data, 'base64');
        console.log("✅ File decrypted successfully:", { size: buffer.length });

        return buffer;
      } catch (error) {
        console.error("❌ File decryption failed:", error);
        throw error;
      }
    },
    [isInitialized, getToken]
  );

  return {
    encryptFile,
    decryptFile,
    isInitialized,
    isReady: isInitialized,
  };
};