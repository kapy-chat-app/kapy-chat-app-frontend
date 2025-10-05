// components/page/message/media/FileAttachment.tsx
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FileAttachmentProps {
  files: any[];
  isOwnMessage: boolean;
  isSending: boolean;
  isDark: boolean;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ files, isOwnMessage, isSending, isDark }) => {
  const getFileIcon = (fileType: string) => {
    if (!fileType) return 'document-outline';
    if (fileType.includes('pdf')) return 'document-text';
    if (fileType.includes('word')) return 'document';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'grid';
    return 'document-outline';
  };

  return (
    <View className="py-1">
      {files.map((att: any, index: number) => (
        <View key={att._id || index} className={`flex-row items-center px-3 py-3 min-h-[72px] w-[280px] ${isSending && 'opacity-60'}`}>
          <View className={`w-12 h-12 rounded-lg items-center justify-center mr-3 ${isOwnMessage ? 'bg-white/20' : 'bg-orange-100'}`}>
            {isSending ? (
              <ActivityIndicator size="small" color={isOwnMessage ? 'white' : '#f97316'} />
            ) : (
              <Ionicons name={getFileIcon(att.file_type)} size={32} color={isOwnMessage ? 'white' : '#f97316'} />
            )}
          </View>

          <View className="flex-1 mr-2">
            <Text className={`text-[15px] font-medium mb-1 ${isOwnMessage ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}`} numberOfLines={2}>
              {att.file_name}
            </Text>
            <Text className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
              {isSending ? 'Đang tải lên...' : `${(att.file_size / 1024).toFixed(1)} KB • ${att.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}`}
            </Text>
          </View>

          {!isSending && (
            <TouchableOpacity className="p-1">
              <Ionicons name="download-outline" size={24} color={isOwnMessage ? 'white' : '#666'} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};