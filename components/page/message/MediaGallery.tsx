// components/page/message/MediaGallery.tsx
import { useConversationMedia } from '@/hooks/message/useMessageInfo';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
    Modal,
    ScrollView,
} from 'react-native';
import { Video, ResizeMode, Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MediaGalleryProps {
  conversationId: string;
  type: 'image' | 'video' | 'file' | 'audio';
  onMediaPress?: (item: any, index: number) => void;
}

export default function MediaGallery({
  conversationId,
  type,
  onMediaPress,
}: MediaGalleryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { media, loading, hasMore, loadMedia, loadMore, refresh } =
    useConversationMedia(conversationId);

  // Modal states
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    refresh(type);
  }, [type]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const playAudio = async (item: any) => {
    const attachment = item.attachments[0];
    
    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: attachment.url },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 100,
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const onSliderValueChange = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
    }
  };

  const handleMediaPress = (item: any, index: number) => {
    if (type === 'image') {
      setCurrentIndex(index);
      setShowMediaModal(true);
    } else if (type === 'video') {
      setCurrentIndex(index);
      setShowMediaModal(true);
    } else if (type === 'audio') {
      setCurrentIndex(index);
      setShowMediaModal(true);
      playAudio(item);
    } else if (type === 'file') {
      // You can implement file download/open here
      onMediaPress?.(item, index);
    }
  };

  const handleCloseModal = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
    setShowMediaModal(false);
  };

  const renderMediaItem = ({ item, index }: { item: any; index: number }) => {
    const attachment = item.attachments[0];
    if (!attachment) return null;

    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handleMediaPress(item, index)}
      >
        {type === 'image' && (
          <Image
            source={{ uri: attachment.url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        )}
        {type === 'video' && (
          <View style={styles.videoContainer}>
            <Image
              source={{ uri: attachment.url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
            <View style={styles.playIconContainer}>
              <Ionicons name="play-circle" size={40} color="white" />
            </View>
          </View>
        )}
        {(type === 'file' || type === 'audio') && (
          <View style={[styles.fileContainer, isDark && styles.fileContainerDark]}>
            <Ionicons
              name={type === 'audio' ? 'musical-notes' : 'document'}
              size={32}
              color={isDark ? '#60A5FA' : '#3B82F6'}
            />
            <Text
              style={[styles.fileName, isDark && styles.fileNameDark]}
              numberOfLines={2}
            >
              {attachment.file_name}
            </Text>
            <Text style={[styles.fileSize, isDark && styles.fileSizeDark]}>
              {formatFileSize(attachment.file_size)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderImageModal = () => {
    return (
      <Modal
        visible={showMediaModal && type === 'image'}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={handleCloseModal}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentIndex(index);
            }}
            contentOffset={{ x: currentIndex * SCREEN_WIDTH, y: 0 }}
          >
            {media.map((item: any, index: number) => (
              <View key={item._id || index} style={styles.modalImageContainer}>
                <Image
                  source={{ uri: item.attachments[0].url }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {media.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {currentIndex + 1} / {media.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  const renderVideoModal = () => {
    const currentItem = media[currentIndex];
    if (!currentItem) return null;

    return (
      <Modal
        visible={showMediaModal && type === 'video'}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={handleCloseModal}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          <View style={styles.videoModalContainer}>
            <Video
              source={{ uri: currentItem.attachments[0].url }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
            />
          </View>

          {media.length > 1 && (
            <View style={styles.videoNavigation}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => {
                  if (currentIndex > 0) {
                    setCurrentIndex(currentIndex - 1);
                  }
                }}
                disabled={currentIndex === 0}
              >
                <Ionicons 
                  name="chevron-back" 
                  size={32} 
                  color={currentIndex === 0 ? '#666' : 'white'} 
                />
              </TouchableOpacity>

              <Text style={styles.imageCounterText}>
                {currentIndex + 1} / {media.length}
              </Text>

              <TouchableOpacity
                style={styles.navButton}
                onPress={() => {
                  if (currentIndex < media.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                  }
                }}
                disabled={currentIndex === media.length - 1}
              >
                <Ionicons 
                  name="chevron-forward" 
                  size={32} 
                  color={currentIndex === media.length - 1 ? '#666' : 'white'} 
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  const renderAudioModal = () => {
    const currentItem = media[currentIndex];
    if (!currentItem) return null;
    const attachment = currentItem.attachments[0];

    return (
      <Modal
        visible={showMediaModal && type === 'audio'}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={handleCloseModal}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          <View style={styles.audioModalContent}>
            <View style={styles.audioIcon}>
              <Ionicons name="musical-notes" size={80} color="#f97316" />
            </View>

            <Text style={styles.audioFileName}>{attachment.file_name}</Text>
            <Text style={styles.audioFileSize}>{formatFileSize(attachment.file_size)}</Text>

            <View style={styles.audioPlayerContainer}>
              <TouchableOpacity
                onPress={() => playAudio(currentItem)}
                style={styles.audioPlayButton}
              >
                <Ionicons 
                  name={isPlaying ? 'pause' : 'play'} 
                  size={32} 
                  color="white"
                />
              </TouchableOpacity>

              <View style={styles.audioProgressContainer}>
                <Text style={styles.audioTimeText}>{formatTime(position)}</Text>
                
                <Slider
                  style={styles.audioSlider}
                  minimumValue={0}
                  maximumValue={duration || 1}
                  value={position}
                  onSlidingComplete={onSliderValueChange}
                  minimumTrackTintColor="#f97316"
                  maximumTrackTintColor="#666"
                  thumbTintColor="#f97316"
                />

                <Text style={styles.audioTimeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            {media.length > 1 && (
              <View style={styles.audioNavigation}>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={async () => {
                    if (currentIndex > 0) {
                      if (sound) {
                        await sound.unloadAsync();
                        setSound(null);
                        setIsPlaying(false);
                      }
                      setCurrentIndex(currentIndex - 1);
                    }
                  }}
                  disabled={currentIndex === 0}
                >
                  <Ionicons 
                    name="play-skip-back" 
                    size={32} 
                    color={currentIndex === 0 ? '#666' : 'white'} 
                  />
                </TouchableOpacity>

                <Text style={styles.imageCounterText}>
                  {currentIndex + 1} / {media.length}
                </Text>

                <TouchableOpacity
                  style={styles.navButton}
                  onPress={async () => {
                    if (currentIndex < media.length - 1) {
                      if (sound) {
                        await sound.unloadAsync();
                        setSound(null);
                        setIsPlaying(false);
                      }
                      setCurrentIndex(currentIndex + 1);
                    }
                  }}
                  disabled={currentIndex === media.length - 1}
                >
                  <Ionicons 
                    name="play-skip-forward" 
                    size={32} 
                    color={currentIndex === media.length - 1 ? '#666' : 'white'} 
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={isDark ? '#60A5FA' : '#3B82F6'} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading && media.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name={getEmptyIcon(type)}
          size={64}
          color={isDark ? '#4B5563' : '#D1D5DB'}
        />
        <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
          Không có {getMediaTypeName(type)} nào
        </Text>
      </View>
    );
  };

  return (
    <>
      <FlatList
        data={media}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item._id}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={() => hasMore && loadMore(type)}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {renderImageModal()}
      {renderVideoModal()}
      {renderAudioModal()}
    </>
  );
}

function getMediaTypeName(type: string): string {
  switch (type) {
    case 'image':
      return 'ảnh';
    case 'video':
      return 'video';
    case 'file':
      return 'tệp';
    case 'audio':
      return 'âm thanh';
    default:
      return 'media';
  }
}

function getEmptyIcon(type: string): any {
  switch (type) {
    case 'image':
      return 'images-outline';
    case 'video':
      return 'videocam-outline';
    case 'file':
      return 'document-outline';
    case 'audio':
      return 'musical-notes-outline';
    default:
      return 'folder-outline';
  }
}

const styles = StyleSheet.create({
  gridContainer: {
    padding: 12,
    flexGrow: 1,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  fileContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fileContainerDark: {
    backgroundColor: '#1F2937',
  },
  fileName: {
    fontSize: 11,
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  fileNameDark: {
    color: '#F9FAFB',
  },
  fileSize: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  fileSizeDark: {
    color: '#9CA3AF',
  },
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptyTextDark: {
    color: '#6B7280',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Video modal styles
  videoModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  videoNavigation: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH * 0.6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
  navButton: {
    padding: 8,
  },
  // Audio modal styles
  audioModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  audioIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  audioFileName: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  audioFileSize: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 40,
  },
  audioPlayerContainer: {
    width: '100%',
    alignItems: 'center',
  },
  audioPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  audioProgressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioSlider: {
    flex: 1,
    height: 40,
  },
  audioTimeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    width: 45,
  },
  audioNavigation: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH * 0.6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
});