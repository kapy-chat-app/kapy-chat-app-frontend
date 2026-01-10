// components/page/message/MessageMediaGallery.tsx
// ✅ UPDATED: Support optimistic messages with local URIs
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
  onLongPress?: () => void;
}

export const MessageMediaGallery: React.FC<MessageMediaGalleryProps> = ({
  message,
  isOwnMessage,
  isSending,
  isDark,
  onLongPress,
}) => {
  // ✅ CRITICAL: Validate attachments exist and is array
  if (!message?.attachments || !Array.isArray(message.attachments)) {
    console.warn("⚠️ [GALLERY] Invalid attachments:", message?.attachments);
    return null;
  }

  // ✅ Filter out invalid attachments
  const safeAttachments = message.attachments.filter((att: any) => {
    if (!att || typeof att !== 'object') {
      console.warn("⚠️ [GALLERY] Invalid attachment object:", att);
      return false;
    }
    
    if (!att._id) {
      console.warn("⚠️ [GALLERY] Attachment missing _id:", att);
      return false;
    }

    // ✅ NEW: Check if has valid URI for rendering (including optimistic local URIs)
    // For optimistic messages: decryptedUri contains local file://
    // For encrypted messages: decryptedUri contains decrypted file://
    // For regular messages: url contains server URL
    const hasValidUri = att.decryptedUri 
      ? Boolean(att.decryptedUri && typeof att.decryptedUri === 'string')
      : Boolean(att.url && typeof att.url === 'string');

    if (!hasValidUri) {
      console.warn(`⚠️ [GALLERY] Attachment ${att._id} has no valid URI:`, {
        hasDecryptedUri: !!att.decryptedUri,
        hasUrl: !!att.url,
        isSending: message.status === 'sending',
        isEncrypted: att.is_encrypted,
      });
    }

    return hasValidUri;
  });

  // ✅ If no valid attachments after filtering, return null
  if (safeAttachments.length === 0) {
    console.warn("⚠️ [GALLERY] No valid attachments to render");
    return null;
  }

  console.log(`📎 [GALLERY] Rendering ${safeAttachments.length} attachments`, {
    messageId: message._id,
    isSending: message.status === 'sending',
    hasLocalUris: safeAttachments.some(att => att.decryptedUri?.startsWith('file://')),
  });

  // ✅ Better file type detection including file extensions
  const imageAttachments = safeAttachments.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    return fileType.startsWith('image/') || 
           fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
  });
  
  const videoAttachments = safeAttachments.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    
    return fileType.startsWith('video/') || 
           fileName.match(/\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/);
  });
  
  const audioAttachments = safeAttachments.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    return fileType.startsWith('audio/') || 
           fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
  });
  
  // ✅ Files are ONLY non-media files
  const fileAttachments = safeAttachments.filter((att: any) => {
    const fileType = att.file_type?.toLowerCase() || '';
    const fileName = att.file_name?.toLowerCase() || '';
    
    const isImage = fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
    const isVideo = fileType.startsWith('video/') || fileName.match(/\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv)$/);
    const isAudio = fileType.startsWith('audio/') || fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/);
    
    return !isImage && !isVideo && !isAudio;
  });

  return (
    <View>
      {/* Images */}
      {imageAttachments.length > 0 && (
        <ImageGallery 
          images={imageAttachments}
          isSending={isSending}
          onLongPress={onLongPress}
        />
      )}

      {/* Videos */}
      {videoAttachments.length > 0 && (
        <View className={imageAttachments.length > 0 ? "mt-1" : ""}>
          <VideoPlayer 
            videos={videoAttachments}
            isSending={isSending}
            onLongPress={onLongPress}
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
            onLongPress={onLongPress}
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
            onLongPress={onLongPress}
          />
        </View>
      )}
    </View>
  );
};