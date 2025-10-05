// components/page/message/MessageMediaGallery.tsx
import React, { useEffect, useState } from 'react';
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

  return (
    <View>
      {imageAttachments.length > 0 && (
        <ImageGallery 
          images={imageAttachments}
          localUris={message.localUri}
          isSending={isSending}
        />
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