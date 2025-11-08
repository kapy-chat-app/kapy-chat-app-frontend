// components/page/message/media/ImageGallery.tsx
import React, { useState, useEffect } from 'react';
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

interface ImageGalleryProps {
  images: any[];
  localUris?: string[];
  isSending: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  localUris, 
  isSending 
}) => {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoadErrors, setImageLoadErrors] = useState<{ [key: string]: boolean }>({});

  // ✅ CRITICAL: Debug log to verify decryptedUri
  useEffect(() => {
    console.log('🖼️ [ImageGallery] Rendering with:', {
      imageCount: images.length,
      isSending,
      hasLocalUris: !!localUris,
      localUriCount: localUris?.length || 0,
      images: images.map((img, idx) => ({
        index: idx,
        fileName: img.file_name,
        hasDecryptedUri: !!img.decryptedUri,
        hasUrl: !!img.url,
        decryptedUriPreview: img.decryptedUri 
          ? `${img.decryptedUri.substring(0, 60)}...` 
          : 'NONE',
        urlPreview: img.url 
          ? `${img.url.substring(0, 60)}...` 
          : 'NONE',
      })),
    });
  }, [images, localUris, isSending]);

  // ✅ FIXED: Priority order - decryptedUri > localUri > url
  const getImageUri = (attachment: any, index: number): string | null => {
    // 1st priority: decryptedUri (from successful decryption)
    if (attachment.decryptedUri) {
      console.log(`✅ [ImageGallery] Using decryptedUri for ${attachment.file_name}`);
      return attachment.decryptedUri;
    }

    // 2nd priority: localUri (while sending, before uploaded)
    if (isSending && localUris && localUris.length > index) {
      console.log(`⏳ [ImageGallery] Using localUri for ${attachment.file_name}`);
      return localUris[index];
    }

    // 3rd priority: server URL (fallback, should not happen for encrypted files)
    if (attachment.url) {
      console.warn(`⚠️ [ImageGallery] Using server URL for ${attachment.file_name} (not decrypted?)`);
      return attachment.url;
    }

    console.error(`❌ [ImageGallery] No valid URI for ${attachment.file_name}`);
    return null;
  };

  const getImageSource = (attachment: any, index: number) => {
    const uri = getImageUri(attachment, index);
    return uri ? { uri } : null;
  };

  const handleImageError = (attachmentId: string, error: any) => {
    console.error(`❌ [ImageGallery] Image load error for ${attachmentId}:`, error);
    setImageLoadErrors(prev => ({ ...prev, [attachmentId]: true }));
  };

  const handleImageLoad = (attachmentId: string) => {
    console.log(`✅ [ImageGallery] Image loaded successfully: ${attachmentId}`);
    setImageLoadErrors(prev => ({ ...prev, [attachmentId]: false }));
  };

  // ✅ Render single image
  if (images.length === 1) {
    const imageSource = getImageSource(images[0], 0);
    const imageUri = getImageUri(images[0], 0);
    const hasError = imageLoadErrors[images[0]._id];

    if (!imageSource || !imageUri) {
      return (
        <View className="w-[250px] h-[250px] rounded-2xl bg-gray-200 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-gray-500 text-xs mt-2">Decrypting...</Text>
        </View>
      );
    }

    return (
      <>
        <TouchableOpacity
          onPress={() => {
            if (!isSending && !hasError) {
              setCurrentImageIndex(0);
              setFullScreenImage(imageUri);
            }
          }}
          disabled={isSending || hasError}
        >
          <View className="w-[250px] h-[250px] rounded-2xl overflow-hidden bg-gray-200">
            <Image 
              source={imageSource}
              className="w-full h-full"
              resizeMode="cover"
              onLoad={() => handleImageLoad(images[0]._id)}
              onError={(e) => handleImageError(images[0]._id, e.nativeEvent.error)}
            />
            {isSending && (
              <View className="absolute inset-0 bg-black/30 items-center justify-center">
                <ActivityIndicator size="large" color="white" />
              </View>
            )}
            {hasError && (
              <View className="absolute inset-0 bg-red-100 items-center justify-center">
                <Ionicons name="alert-circle" size={40} color="#ef4444" />
                <Text className="text-red-500 text-xs mt-2">Load failed</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Full screen modal */}
        <Modal 
          visible={fullScreenImage !== null} 
          transparent 
          animationType="fade" 
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View className="flex-1 bg-black justify-center">
            <TouchableOpacity 
              className="absolute top-12 right-5 z-10 w-11 h-11 rounded-full bg-black/50 items-center justify-center" 
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={32} color="white" />
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

  // ✅ Render multiple images (grid)
  return (
    <>
      <View className="w-[250px] flex-row flex-wrap">
        {images.slice(0, 4).map((att: any, index: number) => {
          const imageSource = getImageSource(att, index);
          const imageUri = getImageUri(att, index);
          const hasError = imageLoadErrors[att._id];

          return (
            <TouchableOpacity
              key={att._id || index}
              onPress={() => {
                if (!isSending && !hasError && imageUri) {
                  setCurrentImageIndex(index);
                  setFullScreenImage(imageUri);
                }
              }}
              disabled={isSending || hasError || !imageUri}
              className={`m-0.5 overflow-hidden bg-gray-200 ${
                images.length === 2 ? 'w-[123px] h-[248px]' :
                images.length === 3 && index === 0 ? 'w-[250px] h-[123px]' :
                'w-[123px] h-[123px]'
              }`}
            >
              {imageSource ? (
                <>
                  <Image 
                    source={imageSource} 
                    className="w-full h-full" 
                    resizeMode="cover"
                    onLoad={() => handleImageLoad(att._id)}
                    onError={(e) => handleImageError(att._id, e.nativeEvent.error)}
                  />
                  {isSending && index === 0 && (
                    <View className="absolute inset-0 bg-black/30 items-center justify-center">
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  )}
                  {hasError && (
                    <View className="absolute inset-0 bg-red-100 items-center justify-center">
                      <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    </View>
                  )}
                </>
              ) : (
                <View className="absolute inset-0 items-center justify-center">
                  <ActivityIndicator size="small" color="#f97316" />
                </View>
              )}
              {index === 3 && images.length > 4 && (
                <View className="absolute inset-0 bg-black/50 items-center justify-center">
                  <Text className="text-white text-2xl font-bold">
                    +{images.length - 4}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Full screen modal with gallery */}
      <Modal 
        visible={fullScreenImage !== null} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View className="flex-1 bg-black justify-center">
          <TouchableOpacity 
            className="absolute top-12 right-5 z-10 w-11 h-11 rounded-full bg-black/50 items-center justify-center" 
            onPress={() => setFullScreenImage(null)}
          >
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
            {images.map((att: any, index: number) => {
              const uri = getImageUri(att, index);
              return (
                <View 
                  key={att._id || index} 
                  style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} 
                  className="justify-center items-center"
                >
                  {uri ? (
                    <Image 
                      source={{ uri }} 
                      style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} 
                      resizeMode="contain" 
                    />
                  ) : (
                    <ActivityIndicator size="large" color="#f97316" />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {images.length > 1 && (
            <View className="absolute bottom-12 self-center bg-black/70 px-4 py-2 rounded-full">
              <Text className="text-white text-sm font-semibold">
                {currentImageIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};
