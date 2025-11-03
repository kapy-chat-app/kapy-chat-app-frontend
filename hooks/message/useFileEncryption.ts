// hooks/message/useFileEncryption.ts - NEW FILE
import { useCallback } from 'react';
import { useEncryption } from './useEncryption';
import { simpleEncryptionService } from '@/lib/encryption/EncryptionService';
import { useAuth } from '@clerk/clerk-expo';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken } = useAuth();

  /**
   * ✅ Encrypt file trước khi upload
   */
  const encryptFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      recipientUserId: string
    ): Promise<{
      encryptedBase64: string;
      metadata: {
        iv: string;
        auth_tag: string;
        original_size: number;
        encrypted_size: number;
      };
    }> => {
      if (!isInitialized) {
        throw new Error('E2EE not initialized');
      }

      try {
        console.log('🔒 Encrypting file:', fileName);

        // Get recipient's key
        const token = await getToken();
        if (!token) {
          throw new Error('Authentication token not available');
        }

        const response = await fetch(`${API_BASE_URL}/api/keys/${recipientUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        const recipientKey = result.data.publicKey;

        // Encrypt file
        const { encryptedBase64, metadata } = await simpleEncryptionService.encryptFile(
          recipientKey,
          fileUri,
          fileName
        );

        console.log('✅ File encrypted successfully');

        return {
          encryptedBase64,
          metadata: {
            iv: metadata.iv,
            auth_tag: metadata.auth_tag,
            original_size: metadata.original_size,
            encrypted_size: metadata.encrypted_size,
          },
        };
      } catch (error) {
        console.error('❌ File encryption failed:', error);
        throw error;
      }
    },
    [isInitialized, getToken]
  );

  /**
   * ✅ Decrypt file sau khi download
   */
  const decryptFile = useCallback(
    async (
      encryptedBase64: string,
      iv: string,
      authTag: string,
      senderUserId: string
    ): Promise<string> {
      if (!isInitialized) {
        throw new Error('E2EE not initialized');
      }

      try {
        console.log('🔓 Decrypting file from:', senderUserId);

        const token = await getToken();
        if (!token) {
          throw new Error('Authentication token not available');
        }

        // Decrypt
        const decryptedBuffer = await simpleEncryptionService.decryptFile(
          encryptedBase64,
          iv,
          authTag,
          senderUserId,
          API_BASE_URL,
          token
        );

        // Save to cache
        const fileName = `decrypted_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const localUri = `${FileSystem.cacheDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(
          localUri,
          decryptedBuffer.toString('base64'),
          { encoding: FileSystem.EncodingType.Base64 }
        );

        console.log('✅ File decrypted and saved:', localUri);
        return localUri;
      } catch (error) {
        console.error('❌ File decryption failed:', error);
        throw error;
      }
    },
    [isInitialized, getToken]
  );

  return {
    encryptFile,
    decryptFile,
    isReady: isInitialized,
  };
};