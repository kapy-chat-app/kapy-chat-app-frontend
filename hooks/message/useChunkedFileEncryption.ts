// hooks/message/useChunkedFileEncryption.ts - NATIVE CRYPTO VERSION
import { useCallback, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import {
  nativeEncryptionService,
  EncryptionProgress,
  NativeEncryptionResult,
} from "@/lib/encryption/NativeEncryptionService";
import { useEncryption } from "./useEncryption";

export interface FileEncryptionOptions {
  onProgress?: (progress: EncryptionProgress) => void;
}

export interface EncryptedFileResult {
  encryptedBase64: string;
  metadata: {
    iv: string;
    authTag: string;
    original_size: number;
    encrypted_size: number;
    file_name: string;
    file_type: string;
  };
  isLargeFile: boolean;
  originalFileName: string;
  originalFileType: string;
  localUri: string;
}

export { EncryptionProgress };

export const useChunkedFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken } = useAuth();
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [progress, setProgress] = useState<EncryptionProgress | null>(null);

  /**
   * Encrypt a file using native crypto - always high performance
   */
  const encryptFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      recipientUserId?: string,
      options?: FileEncryptionOptions
    ): Promise<EncryptedFileResult> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      setIsEncrypting(true);
      setProgress(null);

      try {
        const fileSize = await nativeEncryptionService.getFileSize(fileUri);

        console.log(`📦 Native encrypting file: ${fileName}`);
        console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Use native encryption with progress tracking
        const progressHandler = (p: EncryptionProgress) => {
          setProgress(p);
          options?.onProgress?.(p);
        };

        const result = await nativeEncryptionService.encryptFile(
          fileUri,
          fileName,
          progressHandler
        );

        console.log("✅ Native file encryption complete");

        return {
          encryptedBase64: result.encryptedBase64,
          metadata: result.metadata,
          isLargeFile: fileSize > 5 * 1024 * 1024, // 5MB threshold
          originalFileName: fileName,
          originalFileType: result.metadata.file_type,
          localUri: fileUri,
        };
      } catch (error) {
        console.error("❌ Native file encryption failed:", error);
        throw error;
      } finally {
        setIsEncrypting(false);
      }
    },
    [isInitialized]
  );

  /**
   * Encrypt multiple files with overall progress tracking
   */
  const encryptFiles = useCallback(
    async (
      files: Array<{ uri: string; name: string; mimeType?: string }>,
      recipientUserId?: string,
      onOverallProgress?: (current: number, total: number, fileName: string) => void
    ): Promise<EncryptedFileResult[]> => {
      const results: EncryptedFileResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onOverallProgress?.(i + 1, files.length, file.name);

        const result = await encryptFile(
          file.uri,
          file.name,
          recipientUserId
        );

        results.push(result);
      }

      return results;
    },
    [encryptFile]
  );

  /**
   * Reset progress state
   */
  const resetProgress = useCallback(() => {
    setProgress(null);
    setIsEncrypting(false);
  }, []);

  return {
    encryptFile,
    encryptFiles,
    resetProgress,
    isEncrypting,
    progress,
    isReady: isInitialized,
  };
};