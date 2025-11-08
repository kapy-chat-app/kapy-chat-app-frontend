// components/page/message/media/FileAttachment.tsx
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy'; // ✅ Use legacy import
import * as Sharing from 'expo-sharing';

interface FileAttachmentProps {
  files: any[];
  isOwnMessage: boolean;
  isSending: boolean;
  isDark: boolean;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ 
  files, 
  isOwnMessage, 
  isSending, 
  isDark 
}) => {
  // ✅ Debug logging
  useEffect(() => {
    console.log('📄 [FileAttachment] Rendering with:', {
      fileCount: files.length,
      isSending,
      files: files.map((f, idx) => ({
        index: idx,
        fileName: f.file_name,
        fileType: f.file_type,
        hasDecryptedUri: !!f.decryptedUri,
        hasUrl: !!f.url,
        decryptionError: f.decryption_error,
      })),
    });
  }, [files, isSending]);

  // ✅ FIXED: Get file URI with priority
  const getFileUri = (attachment: any): string | null => {
    // 1st priority: decryptedUri
    if (attachment.decryptedUri) {
      console.log(`✅ [FileAttachment] Using decryptedUri for ${attachment.file_name}`);
      return attachment.decryptedUri;
    }

    // 2nd priority: server URL
    if (attachment.url) {
      console.warn(`⚠️ [FileAttachment] Using server URL for ${attachment.file_name}`);
      return attachment.url;
    }

    console.error(`❌ [FileAttachment] No valid URI for ${attachment.file_name}`);
    return null;
  };

  const getFileIcon = (fileType: string) => {
    if (!fileType) return 'document-outline';
    if (fileType.includes('pdf')) return 'document-text';
    if (fileType.includes('word')) return 'document';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'grid';
    return 'document-outline';
  };

  const handleDownload = async (attachment: any) => {
    const fileUri = getFileUri(attachment);
    
    if (!fileUri) {
      Alert.alert('Error', 'File not available');
      return;
    }

    try {
      console.log('📥 [FileAttachment] Downloading file:', attachment.file_name);

      const fileName = attachment.file_name;
      const localUri = `${FileSystem.documentDirectory}${fileName}`;

      // For data URIs (decrypted files), save directly
      if (fileUri.startsWith('data:')) {
        const base64Data = fileUri.split(',')[1];

        // Convert base64 to file
        await FileSystem.writeAsStringAsync(localUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('✅ [FileAttachment] File saved to:', localUri);
      } else {
        // For server URLs, download first
        const downloadResult = await FileSystem.downloadAsync(fileUri, localUri);
        console.log('✅ [FileAttachment] File downloaded to:', downloadResult.uri);
      }

      // Share or save the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: attachment.file_type,
          dialogTitle: `Share ${fileName}`,
        });
        console.log('✅ [FileAttachment] File shared successfully');
      } else {
        Alert.alert(
          'Success', 
          `File saved to:\n${localUri}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ [FileAttachment] Download error:', error);
      Alert.alert('Error', 'Failed to download file. Please try again.');
    }
  };

  return (
    <View className="py-1">
      {files.map((att: any, index: number) => {
        const fileUri = getFileUri(att);
        const hasError = att.decryption_error;

        return (
          <View 
            key={att._id || index} 
            className={`flex-row items-center px-3 py-3 min-h-[72px] w-[280px] ${
              (isSending || !fileUri) && 'opacity-60'
            }`}
          >
            <View 
              className={`w-12 h-12 rounded-lg items-center justify-center mr-3 ${
                isOwnMessage 
                  ? 'bg-white/20' 
                  : hasError 
                  ? 'bg-red-100' 
                  : 'bg-orange-100'
              }`}
            >
              {isSending || !fileUri ? (
                <ActivityIndicator 
                  size="small" 
                  color={isOwnMessage ? 'white' : '#f97316'} 
                />
              ) : hasError ? (
                <Ionicons name="alert-circle" size={32} color="#ef4444" />
              ) : (
                <Ionicons 
                  name={getFileIcon(att.file_type)} 
                  size={32} 
                  color={isOwnMessage ? 'white' : '#f97316'} 
                />
              )}
            </View>

            <View className="flex-1 mr-2">
              <Text 
                className={`text-[15px] font-medium mb-1 ${
                  isOwnMessage 
                    ? 'text-white' 
                    : isDark 
                    ? 'text-white' 
                    : 'text-gray-900'
                }`} 
                numberOfLines={2}
              >
                {att.file_name}
              </Text>
              <Text className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
                {isSending 
                  ? 'Uploading...' 
                  : !fileUri 
                  ? 'Decrypting...'
                  : hasError
                  ? 'Decryption failed'
                  : `${(att.file_size / 1024).toFixed(1)} KB • ${
                      att.file_type?.split('/')[1]?.toUpperCase() || 'FILE'
                    }`
                }
              </Text>
            </View>

            {!isSending && fileUri && !hasError && (
              <TouchableOpacity 
                className="p-1"
                onPress={() => handleDownload(att)}
              >
                <Ionicons 
                  name="download-outline" 
                  size={24} 
                  color={isOwnMessage ? 'white' : '#666'} 
                />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};