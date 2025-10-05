// components/page/message/media/VideoPlayer.tsx
import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface VideoPlayerProps {
  videos: any[];
  localUris?: string[];
  isSending: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videos, localUris, isSending }) => {
  return (
    <View>
      {videos.map((att: any, index: number) => (
        <View key={att._id || index} className="mb-0">
          {isSending ? (
            <View className="w-[250px] h-[200px] rounded-2xl bg-gray-800 items-center justify-center">
              {localUris && localUris[index] ? (
                <>
                  <Image source={{ uri: localUris[index] }} className="absolute w-full h-full rounded-2xl" resizeMode="cover" />
                  <View className="absolute inset-0 bg-black/30 items-center justify-center rounded-2xl">
                    <ActivityIndicator size="large" color="white" />
                    <Text className="text-white mt-2 text-sm">Đang tải lên...</Text>
                  </View>
                </>
              ) : (
                <>
                  <ActivityIndicator size="large" color="#f97316" />
                  <Text className="text-white mt-2 text-sm">Đang tải lên...</Text>
                </>
              )}
            </View>
          ) : (
            <Video
              source={{ uri: att.url }}
              className="w-[250px] h-[200px] rounded-2xl"
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
            />
          )}
        </View>
      ))}
    </View>
  );
};