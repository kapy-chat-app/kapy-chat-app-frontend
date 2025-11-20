// components/page/message/media/FileAttachment.tsx
// Redesigned with cleaner compact list style

import React from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const GALLERY_WIDTH = 260;

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
  const getFileUri = (attachment: any): string | null => {
    if (attachment.decryptedUri) return attachment.decryptedUri;
    if (attachment.url) return attachment.url;
    return null;
  };

  const getFileIcon = (fileType: string): string => {
    if (!fileType) return 'document-outline';
    if (fileType.includes('pdf')) return 'document-text-outline';
    if (fileType.includes('word')) return 'document-outline';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'grid-outline';
    if (fileType.includes('zip') || fileType.includes('rar')) return 'archive-outline';
    return 'document-outline';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (attachment: any) => {
    const fileUri = getFileUri(attachment);
    
    if (!fileUri) {
      Alert.alert('Error', 'File not available');
      return;
    }

    try {
      const fileName = attachment.file_name;
      const localUri = `${FileSystem.documentDirectory}${fileName}`;

      if (fileUri.startsWith('data:')) {
        const base64Data = fileUri.split(',')[1];
        await FileSystem.writeAsStringAsync(localUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.downloadAsync(fileUri, localUri);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: attachment.file_type,
          dialogTitle: `Share ${fileName}`,
        });
      } else {
        Alert.alert('Success', `File saved to:\n${localUri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download file');
    }
  };

  return (
    <View>
      {files.map((att: any, index: number) => {
        const fileUri = getFileUri(att);
        const hasError = att.decryption_error;

        return (
          <TouchableOpacity 
            key={att._id || index}
            onPress={() => fileUri && !hasError && handleDownload(att)}
            disabled={isSending || !fileUri || hasError}
            activeOpacity={0.7}
            style={{ width: GALLERY_WIDTH }}
            className={`flex-row items-center p-3 ${index > 0 ? 'mt-1' : ''} ${
              (isSending || !fileUri) && 'opacity-60'
            }`}
          >
            {/* File icon */}
            <View 
              className={`w-10 h-10 rounded-lg items-center justify-center ${
                isOwnMessage 
                  ? 'bg-white/20' 
                  : hasError 
                  ? 'bg-red-100' 
                  : 'bg-orange-100'
              }`}
            >
              {isSending || !fileUri ? (
                <ActivityIndicator size="small" color={isOwnMessage ? 'white' : '#f97316'} />
              ) : hasError ? (
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              ) : (
                <Ionicons 
                  name={getFileIcon(att.file_type)} 
                  size={20} 
                  color={isOwnMessage ? 'white' : '#f97316'} 
                />
              )}
            </View>

            {/* File info */}
            <View className="flex-1 ml-3 mr-2">
              <Text 
                className={`text-sm font-medium ${
                  isOwnMessage 
                    ? 'text-white' 
                    : isDark 
                    ? 'text-white' 
                    : 'text-gray-900'
                }`} 
                numberOfLines={1}
              >
                {att.file_name}
              </Text>
              <Text className={`text-xs mt-0.5 ${
                isOwnMessage ? 'text-white/60' : 'text-gray-400'
              }`}>
                {isSending 
                  ? 'Sending...' 
                  : !fileUri 
                  ? 'Loading...'
                  : hasError
                  ? 'Failed'
                  : formatFileSize(att.file_size)
                }
              </Text>
            </View>

            {/* Download icon */}
            {!isSending && fileUri && !hasError && (
              <Ionicons 
                name="download-outline" 
                size={18} 
                color={isOwnMessage ? 'rgba(255,255,255,0.7)' : '#9ca3af'} 
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};