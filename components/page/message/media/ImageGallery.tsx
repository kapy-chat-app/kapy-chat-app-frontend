// components/page/message/media/ImageGallery.tsx
// ✅ UPDATED: Support optimistic messages with local URIs (decryptedUri priority)

import React, { useState } from 'react';
import { 
  ActivityIndicator, 
  Dimensions, 
  Image, 
  Modal, 
  ScrollView, 
  Text, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GALLERY_WIDTH = 260;

interface ImageGalleryProps {
  images: any[];
  isSending: boolean;
  onLongPress?: () => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  isSending,
  onLongPress,
}) => {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoadErrors, setImageLoadErrors] = useState<{ [key: string]: boolean }>({});

  /**
   * ✅ PRIORITY: decryptedUri (local OR decrypted) > url
   * For optimistic messages: decryptedUri = local file://
   * For encrypted messages: decryptedUri = decrypted file://
   * For regular messages: url = server URL
   */
  const getImageUri = (attachment: any): string | null => {
    console.log('🖼️ [IMAGE] getImageUri:', {
      id: attachment._id,
      hasDecryptedUri: !!attachment.decryptedUri,
      hasUrl: !!attachment.url,
      decryptedUriType: attachment.decryptedUri?.substring(0, 10),
    });
    
    // Priority 1: decryptedUri (for both optimistic and decrypted)
    if (attachment.decryptedUri) return attachment.decryptedUri;
    
    // Priority 2: url (for non-encrypted server files)
    if (attachment.url) return attachment.url;
    
    return null;
  };

  const handleImageError = (key: string) => {
    console.error('❌ [IMAGE] Load error:', key);
    setImageLoadErrors(prev => ({ ...prev, [key]: true }));
  };

  const handleImageLoad = (key: string) => {
    console.log('✅ [IMAGE] Loaded:', key);
    setImageLoadErrors(prev => ({ ...prev, [key]: false }));
  };

  const itemCount = images.length;

  if (itemCount === 0) return null;

  // Single image - clean rounded display
  if (itemCount === 1) {
    const attachment = images[0];
    const imageUri = getImageUri(attachment);
    const key = attachment._id;
    const hasError = imageLoadErrors[key];

    if (!imageUri) {
      return (
        <View 
          style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.75 }}
          className="rounded-xl bg-gray-100 items-center justify-center"
        >
          <ActivityIndicator size="small" color="#f97316" />
          <Text className="text-gray-400 text-xs mt-2">
            {isSending ? 'Sending...' : 'Loading...'}
          </Text>
        </View>
      );
    }

    return (
      <>
        <TouchableOpacity
          onPress={() => !hasError && setFullScreenImage(imageUri)}
          onLongPress={onLongPress}
          delayLongPress={300}
          disabled={hasError}
          activeOpacity={0.95}
        >
          <View 
            style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.75 }}
            className="rounded-xl overflow-hidden bg-gray-100"
          >
            <Image 
              source={{ uri: imageUri }}
              className="w-full h-full"
              resizeMode="cover"
              onLoad={() => handleImageLoad(key)}
              onError={() => handleImageError(key)}
            />
            {isSending && (
              <View className="absolute inset-0 bg-black/20 items-center justify-center">
                <View className="bg-black/60 rounded-full p-2">
                  <ActivityIndicator size="small" color="white" />
                </View>
              </View>
            )}
            {hasError && (
              <View className="absolute inset-0 bg-gray-100 items-center justify-center">
                <Ionicons name="image-outline" size={32} color="#d1d5db" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <Modal 
          visible={fullScreenImage !== null} 
          transparent 
          animationType="fade" 
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View className="flex-1 bg-black justify-center">
            <TouchableOpacity 
              className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center" 
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Image 
              source={{ uri: fullScreenImage || '' }} 
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} 
              resizeMode="contain" 
            />
          </View>
        </Modal>
      </>
    );
  }

  // Two images - side by side
  if (itemCount === 2) {
    return (
      <>
        <View style={{ width: GALLERY_WIDTH }} className="flex-row rounded-xl overflow-hidden">
          {[0, 1].map((index) => {
            const attachment = images[index];
            const imageUri = getImageUri(attachment);
            const key = attachment._id;
            const hasError = imageLoadErrors[key];

            return (
              <TouchableOpacity
                key={key}
                onPress={() => imageUri && !hasError && (setCurrentImageIndex(index), setFullScreenImage(imageUri))}
                onLongPress={onLongPress}
                delayLongPress={300}
                disabled={hasError || !imageUri}
                activeOpacity={0.95}
                style={{ width: (GALLERY_WIDTH - 2) / 2, height: GALLERY_WIDTH * 0.75 }}
                className={`bg-gray-100 ${index === 0 ? 'mr-0.5' : 'ml-0.5'}`}
              >
                {imageUri ? (
                  <>
                    <Image 
                      source={{ uri: imageUri }} 
                      className="w-full h-full" 
                      resizeMode="cover"
                      onLoad={() => handleImageLoad(key)}
                      onError={() => handleImageError(key)}
                    />
                    {isSending && index === 0 && (
                      <View className="absolute inset-0 bg-black/20 items-center justify-center">
                        <View className="bg-black/60 rounded-full p-2">
                          <ActivityIndicator size="small" color="white" />
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" color="#f97316" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Modal 
          visible={fullScreenImage !== null} 
          transparent 
          animationType="fade" 
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View className="flex-1 bg-black justify-center">
            <TouchableOpacity 
              className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center" 
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={24} color="white" />
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
              {[0, 1].map((index) => {
                const uri = getImageUri(images[index]);
                return (
                  <View 
                    key={index} 
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} 
                    className="justify-center items-center"
                  >
                    {uri && <Image source={{ uri }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />}
                  </View>
                );
              })}
            </ScrollView>
            <View className="absolute bottom-12 self-center bg-black/60 px-3 py-1.5 rounded-full">
              <Text className="text-white text-xs">{currentImageIndex + 1} / 2</Text>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // Three images - 1 large + 2 small
  if (itemCount === 3) {
    return (
      <>
        <TouchableOpacity
          onLongPress={onLongPress}
          delayLongPress={300}
          activeOpacity={1}
        >
          <View style={{ width: GALLERY_WIDTH }} className="rounded-xl overflow-hidden">
            {/* Top large image */}
            <TouchableOpacity
              onPress={() => {
                const uri = getImageUri(images[0]);
                if (uri) { setCurrentImageIndex(0); setFullScreenImage(uri); }
              }}
              activeOpacity={0.95}
              style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.5 }}
              className="bg-gray-100 mb-0.5"
            >
              {getImageUri(images[0]) ? (
                <Image 
                  source={{ uri: getImageUri(images[0])! }} 
                  className="w-full h-full" 
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="small" color="#f97316" />
                </View>
              )}
              {isSending && (
                <View className="absolute inset-0 bg-black/20 items-center justify-center">
                  <View className="bg-black/60 rounded-full p-2">
                    <ActivityIndicator size="small" color="white" />
                  </View>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Bottom two images */}
            <View className="flex-row">
              {[1, 2].map((index) => {
                const imageUri = getImageUri(images[index]);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => imageUri && (setCurrentImageIndex(index), setFullScreenImage(imageUri))}
                    activeOpacity={0.95}
                    style={{ width: (GALLERY_WIDTH - 2) / 2, height: GALLERY_WIDTH * 0.35 }}
                    className={`bg-gray-100 ${index === 1 ? 'mr-0.5' : 'ml-0.5'}`}
                  >
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="small" color="#f97316" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>

        <Modal 
          visible={fullScreenImage !== null} 
          transparent 
          animationType="fade" 
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View className="flex-1 bg-black justify-center">
            <TouchableOpacity 
              className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center" 
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={24} color="white" />
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
              {[0, 1, 2].map((index) => {
                const uri = getImageUri(images[index]);
                return (
                  <View 
                    key={index} 
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} 
                    className="justify-center items-center"
                  >
                    {uri && <Image source={{ uri }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />}
                  </View>
                );
              })}
            </ScrollView>
            <View className="absolute bottom-12 self-center bg-black/60 px-3 py-1.5 rounded-full">
              <Text className="text-white text-xs">{currentImageIndex + 1} / 3</Text>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // Four or more images - 2x2 grid
  return (
    <>
      <TouchableOpacity
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={1}
      >
        <View style={{ width: GALLERY_WIDTH }} className="flex-row flex-wrap rounded-xl overflow-hidden">
          {[0, 1, 2, 3].map((index) => {
            const attachment = images[index] || {};
            const imageUri = getImageUri(attachment);
            const key = attachment._id || `image-${index}`;
            const isTopLeft = index === 0;
            const isTopRight = index === 1;
            const isBottomLeft = index === 2;
            const isBottomRight = index === 3;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => imageUri && (setCurrentImageIndex(index), setFullScreenImage(imageUri))}
                activeOpacity={0.95}
                style={{ 
                  width: (GALLERY_WIDTH - 2) / 2, 
                  height: (GALLERY_WIDTH - 2) / 2,
                  marginRight: isTopLeft || isBottomLeft ? 1 : 0,
                  marginLeft: isTopRight || isBottomRight ? 1 : 0,
                  marginBottom: isTopLeft || isTopRight ? 1 : 0,
                  marginTop: isBottomLeft || isBottomRight ? 1 : 0,
                }}
                className="bg-gray-100"
              >
                {imageUri ? (
                  <>
                    <Image 
                      source={{ uri: imageUri }} 
                      className="w-full h-full" 
                      resizeMode="cover"
                      onLoad={() => handleImageLoad(key)}
                      onError={() => handleImageError(key)}
                    />
                    {isSending && index === 0 && (
                      <View className="absolute inset-0 bg-black/20 items-center justify-center">
                        <View className="bg-black/60 rounded-full p-2">
                          <ActivityIndicator size="small" color="white" />
                        </View>
                      </View>
                    )}
                    {/* Show +N overlay on last image */}
                    {index === 3 && itemCount > 4 && (
                      <View className="absolute inset-0 bg-black/50 items-center justify-center">
                        <Text className="text-white text-xl font-semibold">+{itemCount - 4}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" color="#f97316" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>

      <Modal 
        visible={fullScreenImage !== null} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View className="flex-1 bg-black justify-center">
          <TouchableOpacity 
            className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center" 
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={24} color="white" />
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
            {Array.from({ length: itemCount }).map((_, index) => {
              const uri = getImageUri(images[index]);
              return (
                <View 
                  key={index} 
                  style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} 
                  className="justify-center items-center"
                >
                  {uri ? (
                    <Image source={{ uri }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />
                  ) : (
                    <ActivityIndicator size="large" color="#f97316" />
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View className="absolute bottom-12 self-center bg-black/60 px-3 py-1.5 rounded-full">
            <Text className="text-white text-xs">{currentImageIndex + 1} / {itemCount}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
};