import React, { useEffect } from 'react';
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
}

export const MessageMediaGallery: React.FC<MessageMediaGalleryProps> = ({
  message,
  isOwnMessage,
  isSending,
  isDark,
}) => {
  // ✅ CRITICAL: Debug log attachments
  useEffect(() => {
    if (message.attachments && message.attachments.length > 0) {
      console.log('📊 [MessageMediaGallery] Received attachments:', {
        messageId: message._id,
        attachmentCount: message.attachments.length,
        isSending,
        hasLocalUris: !!message.localUri,
        localUriCount: message.localUri?.length || 0,
        attachments: message.attachments.map((att: any, index: number) => ({
          index,
          fileName: att.file_name,
          fileType: att.file_type,
          hasDecryptedUri: !!att.decryptedUri,
          hasUrl: !!att.url,
          isEncrypted: att.is_encrypted,
          decryptionError: att.decryption_error,
          decryptedUriPreview: att.decryptedUri 
            ? `${att.decryptedUri.substring(0, 50)}...` 
            : 'NO DECRYPTED URI',
          urlPreview: att.url 
            ? `${att.url.substring(0, 50)}...` 
            : 'NO URL',
        })),
      });
    }
  }, [message.attachments, message._id, message.localUri, isSending]);

  const imageAttachments = message.attachments?.filter((att: any) => 
    att.file_type?.startsWith('image/')
  ) || [];
  
  const videoAttachments = message.attachments?.filter((att: any) => 
    att.file_type?.startsWith('video/')
  ) || [];
  
  const audioAttachments = message.attachments?.filter((att: any) => 
    att.file_type?.startsWith('audio/')
  ) || [];
  
  const fileAttachments = message.attachments?.filter((att: any) => 
    !att.file_type?.startsWith('image/') && 
    !att.file_type?.startsWith('video/') && 
    !att.file_type?.startsWith('audio/')
  ) || [];

  // ✅ Log filtered results
  useEffect(() => {
    console.log('🔍 [MessageMediaGallery] Filtered attachments:', {
      messageId: message._id,
      images: imageAttachments.length,
      videos: videoAttachments.length,
      audios: audioAttachments.length,
      files: fileAttachments.length,
    });
  }, [imageAttachments, videoAttachments, audioAttachments, fileAttachments, message._id]);

  return (
    <View>
      {imageAttachments.length > 0 && (
        <>
          {console.log('🖼️ [MessageMediaGallery] Rendering ImageGallery with', imageAttachments.length, 'images')}
          <ImageGallery 
            images={imageAttachments}
            localUris={message.localUri}
            isSending={isSending}
          />
        </>
      )}

      {videoAttachments.length > 0 && (
        <VideoPlayer 
          videos={videoAttachments}
          localUris={message.localUri}
          isSending={isSending}
        />
      )}

      {audioAttachments.length > 0 && (
        <AudioPlayer 
          audios={audioAttachments}
          isOwnMessage={isOwnMessage}
          isSending={isSending}
          isDark={isDark}
        />
      )}

      {fileAttachments.length > 0 && (
        <FileAttachment 
          files={fileAttachments}
          isOwnMessage={isOwnMessage}
          isSending={isSending}
          isDark={isDark}
        />
      )}
    </View>
  );
};