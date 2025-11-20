// components/page/message/MessageMediaGallery.tsx
// Redesigned with unified gallery style for cleaner appearance

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
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

  const totalAttachments = message.attachments?.length || 0;
  const hasMultipleTypes = [
    imageAttachments.length > 0,
    videoAttachments.length > 0,
    audioAttachments.length > 0,
    fileAttachments.length > 0
  ].filter(Boolean).length > 1;

  return (
    <View className="overflow-hidden">
      {/* Images - Full width gallery */}
      {imageAttachments.length > 0 && (
        <View className={hasMultipleTypes ? 'mb-1' : ''}>
          <ImageGallery 
            images={imageAttachments}
            localUris={message.localUri}
            isSending={isSending}
          />
        </View>
      )}

      {/* Videos - Stacked below images */}
      {videoAttachments.length > 0 && (
        <View className={hasMultipleTypes ? 'mb-1' : ''}>
          <VideoPlayer 
            videos={videoAttachments}
            localUris={message.localUri}
            isSending={isSending}
          />
        </View>
      )}

      {/* Audio - Compact inline player */}
      {audioAttachments.length > 0 && (
        <View className={hasMultipleTypes ? 'mb-1' : ''}>
          <AudioPlayer 
            audios={audioAttachments}
            isOwnMessage={isOwnMessage}
            isSending={isSending}
            isDark={isDark}
          />
        </View>
      )}

      {/* Files - Clean list */}
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