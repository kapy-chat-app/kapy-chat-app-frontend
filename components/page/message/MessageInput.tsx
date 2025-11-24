// components/page/message/MessageInput.tsx - OPTIMIZED SEND SPEED
/* eslint-disable import/namespace */
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useChunkedFileEncryption } from "@/hooks/message/useChunkedFileEncryption";
import { EncryptionProgress } from "@/lib/encryption/ChunkedEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { GiphyPicker } from "./GiphyPicker";
import type { RichMediaDTO } from "@/hooks/message/useGiphy";
import { useOnDeviceAI } from "@/hooks/ai/useOnDeviceAI";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AttachmentPreview {
  id: string;
  uri: string;
  type: "image" | "video" | "audio" | "file";
  name: string;
  mimeType?: string;
  size?: number;
}

interface MessageInputProps {
  conversationId?: string;
  recipientId?: string;
  onSendMessage: (data: FormData | any) => void;
  replyTo?: any;
  onCancelReply?: () => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

// ============================================
// DEBOUNCE HELPER
// ============================================
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  recipientId,
  onSendMessage,
  replyTo,
  onCancelReply,
  onTyping,
  disabled = false,
}) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  
  // Encryption progress state
  const [encryptionProgress, setEncryptionProgress] = useState<EncryptionProgress | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  
  // Emotion analysis state
  const [emotionAnalysis, setEmotionAnalysis] = useState<any>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  
  const { actualTheme } = useTheme();
  const { t, language } = useLanguage();
  const isDark = actualTheme === "dark";
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const isSendingRef = useRef(false);

  const { 
    encryptFile, 
    isReady: encryptionReady,
    resetProgress 
  } = useChunkedFileEncryption();
  
  const { getToken } = useAuth();

  // AI Hook
  const {
    isReady: aiReady,
    loading: aiLoading,
    analyzeTextMessage,
    checkImageToxicity,
  } = useOnDeviceAI();

  // ============================================
  // ✅ Analyze text while typing - INCREASED DEBOUNCE
  // ============================================
  const analyzeWhileTyping = useCallback(
    debounce(async (text: string) => {
      if (!aiReady || text.trim().length < 10) {
        setEmotionAnalysis(null);
        return;
      }

      try {
        console.log('🔍 Analyzing text while typing...');
        const analysis = await analyzeTextMessage(text);
        setEmotionAnalysis(analysis);

        // Show warning only if VERY toxic
        if (analysis.isToxic && analysis.toxicityScore > 80) {
          Alert.alert(
            '⚠️ ' + t('message.ai.toxicWarning'),
            t('message.ai.toxicMessage'),
            [{ text: t('ok') }]
          );
        }
      } catch (error) {
        console.error('❌ Analysis error:', error);
      }
    }, 3000), // ✅ Increased from 1500ms to 3000ms
    [aiReady, analyzeTextMessage, t]
  );

  // ============================================
  // Handle typing
  // ============================================
  const handleTyping = (text: string) => {
    setMessage(text);

    if (!onTyping) return;

    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTyping(false);
      }
    }, 2000);

    // Analyze while typing (debounced)
    analyzeWhileTyping(text);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && onTyping) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  // ============================================
  // Check images for toxicity
  // ============================================
  const checkImagesBeforeSend = async (attachments: AttachmentPreview[]): Promise<boolean> => {
    const images = attachments.filter(att => att.type === 'image');
    
    if (images.length === 0 || !aiReady) return true;

    try {
      console.log(`🖼️ Checking ${images.length} images for toxicity...`);
      setAnalyzingImage(true);

      for (const img of images) {
        const response = await fetch(img.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            const base64String = base64data.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const toxicityCheck = await checkImageToxicity(base64, img.mimeType || 'image/jpeg');

        if (toxicityCheck.isToxic) {
          Alert.alert(
            '⚠️ ' + t('message.ai.imageToxicTitle'),
            t('message.ai.imageToxicMessage', {
              categories: toxicityCheck.categories.join(', ')
            }),
            [{ text: t('ok') }]
          );
          setAnalyzingImage(false);
          return false;
        }
      }

      console.log('✅ All images are safe');
      setAnalyzingImage(false);
      return true;
    } catch (error) {
      console.error('❌ Image check error:', error);
      setAnalyzingImage(false);
      return true;
    }
  };

  // ============================================
  // GIF/STICKER HANDLER
  // ============================================
  const handleGiphySelect = async (richMedia: RichMediaDTO, type: "gif" | "sticker") => {
    console.log(`✨ Selected ${type}:`, richMedia.title);

    const messageContent = message.trim();
    const currentReplyTo = replyTo?._id;

    setMessage("");
    if (onCancelReply) {
      onCancelReply();
    }

    try {
      const messageData = {
        content: messageContent || undefined,
        type: type,
        richMedia: richMedia,
        replyTo: currentReplyTo,
      };

      onSendMessage(messageData);
      console.log(`✅ ${type} message sent`);
    } catch (error: any) {
      console.error(`❌ Failed to send ${type}:`, error);
      Alert.alert(t('error'), error.message || `Failed to send ${type}`);
    }
  };

  // ============================================
  // ✅ OPTIMIZED: Handle send WITHOUT blocking analysis
  // ============================================
  const handleSend = async () => {
    if (!message.trim() && attachments.length === 0) return;
    
    if (isSendingRef.current || uploadingFiles || analyzingImage) {
      console.log("⏭️ Already processing, skipping...");
      return;
    }

    if (isTypingRef.current && onTyping) {
      isTypingRef.current = false;
      onTyping(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const messageContent = message.trim();
    const currentAttachments = [...attachments];
    const currentReplyTo = replyTo?._id;

    // ✅ Check images for toxicity (still important)
    const imagesAreSafe = await checkImagesBeforeSend(currentAttachments);
    if (!imagesAreSafe) {
      return;
    }

    // ✅ OPTIMIZED: Quick toxicity check only (no full ONNX analysis)
    if (messageContent && aiReady) {
      // Use rule-based check (instant, no ONNX)
      const quickCheck = await (async () => {
        try {
          const analysis = await analyzeTextMessage(messageContent);
          return analysis;
        } catch {
          return { isToxic: false, toxicityScore: 0 };
        }
      })();
      
      // Block only if EXTREMELY toxic (>85%)
      if (quickCheck.isToxic && quickCheck.toxicityScore > 85) {
        Alert.alert(
          '🚫 ' + t('message.ai.cannotSend'),
          t('message.ai.extremelyToxic'),
          [{ text: t('ok') }]
        );
        return;
      }
      
      // Warn but allow send if toxic 70-85%
      if (quickCheck.isToxic && quickCheck.toxicityScore > 70) {
        const shouldSend = await new Promise<boolean>(resolve => {
          Alert.alert(
            '⚠️ ' + t('message.ai.toxicWarning'),
            t('message.ai.toxicConfirm'),
            [
              { text: t('cancel'), onPress: () => resolve(false), style: 'cancel' },
              { text: t('message.ai.sendAnyway'), onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });

        if (!shouldSend) return;
      }
    }

    // ✅ Clear UI IMMEDIATELY (don't wait for analysis)
    setMessage("");
    setAttachments([]);
    setEmotionAnalysis(null);
    if (onCancelReply) {
      onCancelReply();
    }

    // ✅ Send message WITHOUT waiting for full emotion analysis
    try {
      isSendingRef.current = true;
      const shouldEncryptFiles = encryptionReady && recipientId && currentAttachments.length > 0;

      if (shouldEncryptFiles) {
        console.log('🔒 Encrypting files before sending...');
        setUploadingFiles(true);
        setTotalFiles(currentAttachments.length);
        setEncryptionProgress(null);

        const encryptedFiles: any[] = [];
        const localUris: string[] = [];

        for (let i = 0; i < currentAttachments.length; i++) {
          const att = currentAttachments[i];
          setCurrentFileIndex(i + 1);
          
          try {
            console.log(`🔒 Encrypting file ${i + 1}/${currentAttachments.length}: ${att.name}`);

            const result = await encryptFile(
              att.uri,
              att.name,
              recipientId,
              {
                onProgress: (progress) => {
                  setEncryptionProgress(progress);
                },
              }
            );

            encryptedFiles.push({
              encryptedBase64: result.encryptedBase64,
              originalFileName: att.name,
              originalFileType: att.mimeType || result.metadata.file_type,
              encryptionMetadata: {
                iv: result.metadata.iv,
                authTag: result.metadata.authTag,
                original_size: result.metadata.original_size,
                encrypted_size: result.metadata.encrypted_size,
              },
            });

            localUris.push(att.uri);
            console.log('✅ File encrypted:', att.name, result.isLargeFile ? '(large file)' : '(small file)');
          } catch (error: any) {
            console.error('❌ Failed to encrypt file:', att.name, error);
            setUploadingFiles(false);
            setEncryptionProgress(null);
            isSendingRef.current = false;
            
            Alert.alert(
              t('error'), 
              `Cannot encrypt ${att.name}: ${error.message || 'Unknown error'}`
            );
            return;
          }
        }

        setUploadingFiles(false);
        setEncryptionProgress(null);
        resetProgress();

        if (messageContent || encryptedFiles.length > 0) {
          const messageData = {
            content: messageContent || undefined,
            type: 'file' as const,
            encryptedFiles: encryptedFiles,
            localUris: localUris,
            replyTo: currentReplyTo,
          };

          onSendMessage(messageData);
        }

        isSendingRef.current = false;

        // ✅ Background emotion analysis AFTER send
        if (messageContent && aiReady && conversationId) {
          saveEmotionInBackground(messageContent, conversationId);
        }

        return;
      }

      // Fallback: Non-encrypted file handling
      const mediaFiles = currentAttachments.filter((att) =>
        ["image", "video", "audio"].includes(att.type)
      );
      const documentFiles = currentAttachments.filter((att) => att.type === "file");

      if (currentAttachments.length === 0 && messageContent) {
        const textData = {
          content: messageContent,
          type: "text" as const,
          replyTo: currentReplyTo,
        };
        onSendMessage(textData);
      } else if (mediaFiles.length > 0) {
        const mediaFormData = new FormData();
        const firstMediaType = mediaFiles[0].type;
        mediaFormData.append("type", firstMediaType);

        if (messageContent) {
          mediaFormData.append("content", messageContent);
        }

        if (currentReplyTo) {
          mediaFormData.append("replyTo", currentReplyTo);
        }

        mediaFiles.forEach((att) => {
          mediaFormData.append("files", {
            uri: att.uri,
            type: att.mimeType || "application/octet-stream",
            name: att.name,
          } as any);
        });

        onSendMessage(mediaFormData);

        if (documentFiles.length > 0) {
          const docFormData = new FormData();
          docFormData.append("type", "file");

          if (messageContent) {
            docFormData.append("content", messageContent);
          }

          documentFiles.forEach((att) => {
            docFormData.append("files", {
              uri: att.uri,
              type: att.mimeType || "application/octet-stream",
              name: att.name,
            } as any);
          });

          onSendMessage(docFormData);
        }
      } else if (documentFiles.length > 0) {
        const docFormData = new FormData();
        docFormData.append("type", "file");

        if (messageContent) {
          docFormData.append("content", messageContent);
        }

        if (currentReplyTo) {
          docFormData.append("replyTo", currentReplyTo);
        }

        documentFiles.forEach((att) => {
          docFormData.append("files", {
            uri: att.uri,
            type: att.mimeType || "application/octet-stream",
            name: att.name,
          } as any);
        });

        onSendMessage(docFormData);
      }
      
      isSendingRef.current = false;

      // ✅ Background emotion analysis AFTER send
      if (messageContent && aiReady && conversationId) {
        saveEmotionInBackground(messageContent, conversationId);
      }

    } catch (error: any) {
      console.error("Send error:", error);
      setUploadingFiles(false);
      setEncryptionProgress(null);
      isSendingRef.current = false;
      Alert.alert(t('error'), error.message || t('message.failed'));
    }
  };

  // ✅ NEW: Background emotion save (non-blocking)
  const saveEmotionInBackground = async (text: string, convId: string) => {
    setTimeout(async () => {
      try {
        console.log('🔍 Background: Analyzing sent message...');
        const analysis = await analyzeTextMessage(text);
        
        const token = await getToken();
        await axios.post(
          `${API_URL}/api/emotion/save`,
          {
            conversationId: convId,
            textAnalyzed: text,
            emotionScores: analysis.scores,
            dominantEmotion: analysis.emotion,
            confidenceScore: analysis.confidence,
            context: 'message',
            isToxic: analysis.isToxic,
            toxicityScore: analysis.toxicityScore,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('✅ Background: Emotion saved');
      } catch (error) {
        console.error('❌ Background: Failed to save emotion:', error);
      }
    }, 0);
  };

  const handleImagePicker = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        t('message.attachment.permissionRequired'),
        t('message.attachment.mediaPermission')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newAttachments = result.assets.map(
        (asset, index) =>
          ({
            id: `${Date.now()}-${index}`,
            uri: asset.uri,
            type: asset.type === "video" ? "video" : "image",
            name:
              asset.fileName ||
              `${asset.type}-${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
            mimeType: asset.type === "video" ? "video/mp4" : "image/jpeg",
          }) as AttachmentPreview
      );

      setAttachments([...attachments, ...newAttachments]);
    }
  };

  const handleFilePicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled) {
        const newAttachments = result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          uri: asset.uri,
          type: "file" as const,
          name: asset.name,
          mimeType: asset.mimeType || "application/octet-stream",
          size: asset.size,
        }));

        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      Alert.alert(t('error'), t('message.attachment.pickFailed'));
    }
  };

  const handleCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        t('message.attachment.permissionRequired'),
        t('message.attachment.cameraPermission')
      );
      return;
    }

    Alert.alert(t('message.attachment.camera'), t('message.attachment.camera'), [
      {
        text: t('message.attachment.takePhoto'),
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
          });

          if (!result.canceled) {
            const photo: AttachmentPreview = {
              id: `${Date.now()}`,
              uri: result.assets[0].uri,
              type: "image",
              name: `photo-${Date.now()}.jpg`,
              mimeType: "image/jpeg",
            };
            setAttachments([...attachments, photo]);
          }
        },
      },
      {
        text: t('message.attachment.recordVideo'),
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.8,
            videoMaxDuration: 60,
          });

          if (!result.canceled) {
            const video: AttachmentPreview = {
              id: `${Date.now()}`,
              uri: result.assets[0].uri,
              type: "video",
              name: `video-${Date.now()}.mp4`,
              mimeType: "video/mp4",
            };
            setAttachments([...attachments, video]);
          }
        },
      },
      {
        text: t('cancel'),
        style: "cancel",
      },
    ]);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t('message.attachment.permissionRequired'),
          t('message.attachment.micPermission')
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error: any) {
      console.error("Recording error:", error);
      Alert.alert(
        t('message.attachment.recordingError'),
        error?.message || t('message.attachment.recordingFailed')
      );
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const uri = recording.getURI();

      if (uri) {
        const attachment: AttachmentPreview = {
          id: `${Date.now()}`,
          uri,
          type: "audio",
          name: `voice-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
        };
        setAttachments([...attachments, attachment]);
      }

      setRecording(null);
    } catch (error: any) {
      console.error("Stop recording error:", error);
      Alert.alert(t('error'), t('message.attachment.recordingFailed'));
      setRecording(null);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const renderAttachmentPreview = ({ item }: { item: AttachmentPreview }) => (
    <View style={styles.attachmentContainer}>
      {item.type === "image" && (
        <Image
          source={{ uri: item.uri }}
          style={styles.attachmentImage}
          resizeMode="cover"
        />
      )}
      {item.type === "video" && (
        <View
          style={[
            styles.attachmentBox,
            isDark ? styles.bgGrayDark : styles.bgGrayLight,
          ]}
        >
          <Ionicons
            name="videocam"
            size={30}
            color={isDark ? "#fff" : "#666"}
          />
        </View>
      )}
      {item.type === "audio" && (
        <View
          style={[
            styles.attachmentBox,
            isDark ? styles.bgBlueDark : styles.bgBlueLight,
          ]}
        >
          <Ionicons name="mic" size={30} color="#3b82f6" />
        </View>
      )}
      {item.type === "file" && (
        <View
          style={[
            styles.attachmentBox,
            isDark ? styles.bgGrayDark : styles.bgGray200,
            styles.attachmentFileBox,
          ]}
        >
          <Ionicons
            name="document"
            size={30}
            color={isDark ? "#fff" : "#666"}
          />
          <Text
            style={[
              styles.fileName,
              isDark ? styles.textGray300 : styles.textGray600,
            ]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={() => removeAttachment(item.id)}
        style={styles.removeButton}
      >
        <Ionicons name="close" size={16} color="white" />
      </TouchableOpacity>
    </View>
  );

  const getProgressText = () => {
    if (!encryptionProgress) {
      return t('message.encryption.encryptingFiles');
    }

    const { phase, percentage } = encryptionProgress;
    
    if (totalFiles > 1) {
      return `${t('message.encryption.encrypting')} ${currentFileIndex}/${totalFiles}: ${percentage.toFixed(0)}%`;
    }

    switch (phase) {
      case 'reading':
        return `${t('message.encryption.reading')} ${percentage.toFixed(0)}%`;
      case 'encrypting':
        return `${t('message.encryption.encrypting')}: ${percentage.toFixed(0)}%`;
      case 'finalizing':
        return t('message.encryption.finalizing');
      default:
        return `${percentage.toFixed(0)}%`;
    }
  };

  const renderEmotionIndicator = () => {
    if (!emotionAnalysis || !message.trim()) return null;

    const emotionEmojis = {
      joy: '😊',
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      surprise: '😮',
      neutral: '😐',
    };

    const emotionColors = {
      joy: '#10B981',
      sadness: '#3B82F6',
      anger: '#EF4444',
      fear: '#8B5CF6',
      surprise: '#F59E0B',
      neutral: '#6B7280',
    };

    return (
      <View style={styles.emotionIndicator}>
        <Text style={{ fontSize: 16 }}>
          {emotionEmojis[emotionAnalysis.emotion]}
        </Text>
        <Text 
          style={[
            styles.emotionText,
            { color: emotionColors[emotionAnalysis.emotion] }
          ]}
        >
          {t(`emotions.${emotionAnalysis.emotion}`)} 
          {emotionAnalysis.isToxic && ' ⚠️'}
        </Text>
        <Text style={[styles.emotionConfidence, isDark && styles.textGray400]}>
          {(emotionAnalysis.confidence * 100).toFixed(0)}%
        </Text>
      </View>
    );
  };

  const isSendDisabled = uploadingFiles || analyzingImage || disabled || (!message.trim() && attachments.length === 0);

  return (
    <View
      style={[
        styles.container,
        isDark ? styles.borderDark : styles.borderLight,
      ]}
    >
      {replyTo && (
        <View
          style={[
            styles.replyContainer,
            isDark ? styles.bgGray800 : styles.bgGray100,
          ]}
        >
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>
              {t('message.reply.replyingTo', { name: replyTo.sender?.full_name })}
            </Text>
            <Text
              style={[
                styles.replyText,
                isDark ? styles.textGray300 : styles.textGray700,
              ]}
              numberOfLines={1}
            >
              {replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {attachments.length > 0 && (
        <View style={styles.attachmentsPreview}>
          <FlatList
            data={attachments}
            renderItem={renderAttachmentPreview}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {uploadingFiles && (
        <View style={styles.uploadingContainer}>
          <View style={styles.progressHeader}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={[styles.uploadingText, isDark && styles.textWhite]}>
              {getProgressText()}
            </Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${encryptionProgress?.percentage || 0}%` }
                ]} 
              />
            </View>
          </View>
          
          {encryptionProgress && encryptionProgress.totalBytes > 0 && (
            <Text style={[styles.progressDetail, isDark && styles.textGray400]}>
              {(encryptionProgress.bytesProcessed / 1024 / 1024).toFixed(1)} / {(encryptionProgress.totalBytes / 1024 / 1024).toFixed(1)} MB
            </Text>
          )}
        </View>
      )}

      {analyzingImage && (
        <View style={styles.uploadingContainer}>
          <View style={styles.progressHeader}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={[styles.uploadingText, isDark && styles.textWhite]}>
              {t('message.ai.checkingImage')}
            </Text>
          </View>
        </View>
      )}

      {renderEmotionIndicator()}

      <View style={styles.inputRow}>
        <TouchableOpacity 
          onPress={handleCamera} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled || analyzingImage}
        >
          <Ionicons 
            name="camera" 
            size={24} 
            color={(uploadingFiles || disabled || analyzingImage) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleImagePicker} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled || analyzingImage}
        >
          <Ionicons 
            name="image" 
            size={24} 
            color={(uploadingFiles || disabled || analyzingImage) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleFilePicker} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled || analyzingImage}
        >
          <Ionicons 
            name="attach" 
            size={24} 
            color={(uploadingFiles || disabled || analyzingImage) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setShowGiphyPicker(true)} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled || analyzingImage}
        >
          <Ionicons 
            name="happy-outline" 
            size={24} 
            color={(uploadingFiles || disabled || analyzingImage) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TextInput
          value={message}
          onChangeText={handleTyping}
          placeholder={t('message.input.placeholder')}
          placeholderTextColor={isDark ? "#999" : "#666"}
          multiline
          maxLength={5000}
          editable={!uploadingFiles && !disabled && !analyzingImage}
          style={[
            styles.textInput,
            isDark ? styles.inputDark : styles.inputLight,
          ]}
        />

        {!message.trim() && attachments.length === 0 ? (
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={[
              styles.actionButton,
              isRecording ? styles.bgRed : styles.bgOrange,
            ]}
            disabled={uploadingFiles || disabled || analyzingImage}
          >
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={20}
              color="white"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSend}
            style={[
              styles.actionButton,
              styles.bgOrange,
              isSendDisabled && styles.disabledButton,
            ]}
            disabled={isSendDisabled}
          >
            {uploadingFiles || analyzingImage ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {isRecording && (
        <View
          style={[
            styles.recordingIndicator,
            isDark ? styles.bgRedDark : styles.bgRedLight,
          ]}
        >
          <View style={styles.recordingDot} />
          <Text
            style={[
              styles.recordingText,
              isDark ? styles.textRed400 : styles.textRed600,
            ]}
          >
            {t('message.input.recording')}
          </Text>
        </View>
      )}

      <GiphyPicker
        visible={showGiphyPicker}
        onClose={() => setShowGiphyPicker(false)}
        onSelect={handleGiphySelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
  },
  borderLight: {
    borderTopColor: "#e5e7eb",
  },
  borderDark: {
    borderTopColor: "#374151",
  },
  replyContainer: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bgGray100: {
    backgroundColor: "#f3f4f6",
  },
  bgGray800: {
    backgroundColor: "#1f2937",
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  replyText: {
    fontSize: 14,
  },
  textGray300: {
    color: "#d1d5db",
  },
  textGray400: {
    color: "#9ca3af",
  },
  textGray700: {
    color: "#374151",
  },
  attachmentsPreview: {
    marginBottom: 8,
  },
  attachmentContainer: {
    marginRight: 8,
    position: "relative",
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  attachmentBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bgGrayLight: {
    backgroundColor: "#d1d5db",
  },
  bgGrayDark: {
    backgroundColor: "#374151",
  },
  bgBlueLight: {
    backgroundColor: "#dbeafe",
  },
  bgBlueDark: {
    backgroundColor: "#1e3a8a",
  },
  bgGray200: {
    backgroundColor: "#e5e7eb",
  },
  attachmentFileBox: {
    padding: 8,
  },
  fileName: {
    fontSize: 12,
    marginTop: 4,
  },
  textGray600: {
    color: "#4b5563",
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  textWhite: {
    color: '#ffffff',
  },
  progressBarContainer: {
    marginBottom: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  progressDetail: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },
  emotionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  emotionText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  emotionConfidence: {
    fontSize: 11,
    marginLeft: 6,
    color: '#9ca3af',
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  iconButton: {
    marginRight: 8,
    padding: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 96,
  },
  inputLight: {
    backgroundColor: "#ffffff",
    color: "#000000",
    borderColor: "#d1d5db",
  },
  inputDark: {
    backgroundColor: "#1f2937",
    color: "#ffffff",
    borderColor: "#4b5563",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bgOrange: {
    backgroundColor: "#f97316",
  },
  bgRed: {
    backgroundColor: "#ef4444",
  },
  disabledButton: {
    opacity: 0.5,
  },
  recordingIndicator: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  bgRedLight: {
    backgroundColor: "#fef2f2",
  },
  bgRedDark: {
    backgroundColor: "rgba(127, 29, 29, 0.2)",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
  },
  textRed600: {
    color: "#dc2626",
  },
  textRed400: {
    color: "#f87171",
  },
});

export default MessageInput;