// components/page/message/MessageMediaGallery.tsx
// ✅ FIXED: Pass onLongPress to media components for action menu

import React from 'react';
import { View } from 'react-native';
import { ImageGallery } from './media/ImageGallery';
import { VideoPlayer } from './media/VideoPlayer';
import { AudioPlayer } from './media/AudioPlayer';
import { FileAttachment } from './media/FileAttachment';

interface MessageMediaGalleryProps {
  message: any;
  isOwnMessage: boolean;
  isSending: boolean;
  isDark: boolean;
  onLongPress?: () => void; // ✅ NEW: Receive onLongPress from MessageItem
}

export const MessageMediaGallery: React.FC<MessageMediaGalleryProps> = ({
  message,
  isOwnMessage,
  isSending,
  isDark,
  onLongPress, // ✅ NEW
}) => {
  // ✅ Better file type detection including file extensions
  const imageAttachments = message.attachments?.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    return fileType.startsWith('image/') || 
           fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
  }) || [];
  
  const videoAttachments = message.attachments?.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    
    return fileType.startsWith('video/') || 
           fileName.match(/\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/);
  }) || [];
  
  const audioAttachments = message.attachments?.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    return fileType.startsWith('audio/') || 
           fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
  }) || [];
  
  // ✅ Files are ONLY non-media files
  const fileAttachments = message.attachments?.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    
    const isImage = fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
    const isVideo = fileType.startsWith('video/') || fileName.match(/\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/);
    const isAudio = fileType.startsWith('audio/') || fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
    
    return !isImage && !isVideo && !isAudio;
  }) || [];

  return (
    <View>
      {/* Images */}
      {imageAttachments.length > 0 && (
        <ImageGallery 
          images={imageAttachments}
          localUris={message.localUri}
          isSending={isSending}
          onLongPress={onLongPress} // ✅ PASS onLongPress to ImageGallery
        />
      )}

      {/* Videos */}
      {videoAttachments.length > 0 && (
        <View className={imageAttachments.length > 0 ? "mt-1" : ""}>
          <VideoPlayer 
            videos={videoAttachments}
            localUris={message.localUri}
            isSending={isSending}
            onLongPress={onLongPress} // ✅ TODO: Add to VideoPlayer too
          />
        </View>
      )}

      {/* Audio */}
      {audioAttachments.length > 0 && (
        <View className={(imageAttachments.length > 0 || videoAttachments.length > 0) ? "mt-1" : ""}>
          <AudioPlayer 
            audios={audioAttachments}
            isOwnMessage={isOwnMessage}
            isSending={isSending}
            isDark={isDark}
            onLongPress={onLongPress} // ✅ TODO: Add to AudioPlayer too
          />
        </View>
      )}

      {/* Files - Only non-media files */}
      {fileAttachments.length > 0 && (
        <View className={(imageAttachments.length > 0 || videoAttachments.length > 0 || audioAttachments.length > 0) ? "mt-1" : ""}>
          <FileAttachment 
            files={fileAttachments}
            isOwnMessage={isOwnMessage}
            isSending={isSending}
            isDark={isDark}
            onLongPress={onLongPress} // ✅ TODO: Add to FileAttachment too
          />
        </View>
      )}
    </View>
  );
};