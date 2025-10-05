// components/page/message/media/ImageGallery.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageGalleryProps {
  images: any[];
  localUris?: string[];
  isSending: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, localUris, isSending }) => {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const getImageSource = (attachment: any, index: number) => {
    if (isSending && localUris && localUris.length > index) {
      return { uri: localUris[index] };
    }
    return { uri: attachment.url };
  };

  if (images.length === 1) {
    return (
      <>
        <TouchableOpacity
          onPress={() => {
            if (!isSending) {
              setCurrentImageIndex(0);
              setFullScreenImage(images[0].url);
            }
          }}
          disabled={isSending}
        >
          <Image 
            source={getImageSource(images[0], 0)}
            className="w-[250px] h-[250px] rounded-2xl"
            resizeMode="cover"
          />
          {isSending && (
            <View className="absolute inset-0 bg-black/30 items-center justify-center rounded-2xl">
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
        </TouchableOpacity>

        <Modal visible={fullScreenImage !== null} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
          <View className="flex-1 bg-black justify-center">
            <TouchableOpacity className="absolute top-12 right-5 z-10 w-11 h-11 rounded-full bg-black/50 items-center justify-center" onPress={() => setFullScreenImage(null)}>
              <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>
            <Image source={{ uri: fullScreenImage || '' }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <View className="w-[250px] flex-row flex-wrap">
        {images.slice(0, 4).map((att: any, index: number) => (
          <TouchableOpacity
            key={att._id || index}
            onPress={() => {
              if (!isSending) {
                setCurrentImageIndex(index);
                setFullScreenImage(att.url);
              }
            }}
            disabled={isSending}
            className={`m-0.5 overflow-hidden ${
              images.length === 2 ? 'w-[123px] h-[248px]' :
              images.length === 3 && index === 0 ? 'w-[250px] h-[123px]' :
              'w-[123px] h-[123px]'
            }`}
          >
            <Image source={getImageSource(att, index)} className="w-full h-full" resizeMode="cover" />
            {isSending && index === 0 && (
              <View className="absolute inset-0 bg-black/30 items-center justify-center">
                <ActivityIndicator size="small" color="white" />
              </View>
            )}
            {index === 3 && images.length > 4 && (
              <View className="absolute inset-0 bg-black/50 items-center justify-center">
                <Text className="text-white text-2xl font-bold">+{images.length - 4}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={fullScreenImage !== null} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View className="flex-1 bg-black justify-center">
          <TouchableOpacity className="absolute top-12 right-5 z-10 w-11 h-11 rounded-full bg-black/50 items-center justify-center" onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            contentOffset={{ x: currentImageIndex * SCREEN_WIDTH, y: 0 }}
          >
            {images.map((att: any, index: number) => (
              <View key={att._id || index} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} className="justify-center items-center">
                <Image source={{ uri: att.url }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          {images.length > 1 && (
            <View className="absolute bottom-12 self-center bg-black/70 px-4 py-2 rounded-full">
              <Text className="text-white text-sm font-semibold">{currentImageIndex + 1} / {images.length}</Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};