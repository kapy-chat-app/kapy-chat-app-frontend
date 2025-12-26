// components/page/message/MessageInput.tsx - FINAL FIX
// ✅ Fixed useEncryption return format
// ✅ Fixed typing indicator
// ✅ TEXT MESSAGES NOW WORK WITH E2EE

import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useOnDeviceAI } from "@/hooks/ai/useOnDeviceAI";
import { useChunkedFileEncryption } from "@/hooks/message/useChunkedFileEncryption";
import { useEncryption } from "@/hooks/message/useEncryption";
import type { RichMediaDTO } from "@/hooks/message/useGiphy";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { GiphyPicker } from "./GiphyPicker";

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

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

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

  const [uploadProgress, setUploadProgress] = useState<{
    phase: "thumbnail" | "encrypting" | "uploading" | "finalizing";
    percentage: number;
    chunksEncrypted: number;
    chunksUploaded: number;
    totalChunks: number;
    currentFile: number;
    totalFiles: number;
  } | null>(null);

  const [emotionAnalysis, setEmotionAnalysis] = useState<any>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const isSendingRef = useRef(false);

  const { encryptAndUploadFile, isReady: encryptionReady } =
    useChunkedFileEncryption();

  const { encryptMessage, isInitialized: encryptionInitialized } =
    useEncryption();

  const { getToken } = useAuth();

  const {
    isReady: aiReady,
    analyzeTextMessage,
    checkImageToxicity,
  } = useOnDeviceAI();

  // ============================================
  // ✅ FIXED: Typing indicator logic
  // ============================================
  const handleTyping = (text: string) => {
    setMessage(text);

    if (!onTyping) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (text.length > 0) {
      if (!isTypingRef.current) {
        console.log("⌨️ [INPUT] User started typing");
        isTypingRef.current = true;
        onTyping(true);
      }

      typingTimeoutRef.current = setTimeout(() => {
        console.log("⌨️ [INPUT] User stopped typing (2s timeout)");
        isTypingRef.current = false;
        onTyping(false);
      }, 2000);
    } else {
      if (isTypingRef.current) {
        console.log("⌨️ [INPUT] User cleared text - stop typing");
        isTypingRef.current = false;
        onTyping(false);
      }
    }

    analyzeWhileTyping(text);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && onTyping) {
        console.log("🧹 [INPUT] Cleanup - stop typing");
        onTyping(false);
      }
    };
  }, [onTyping]);

  const analyzeWhileTyping = useCallback(
    debounce(async (text: string) => {
      if (!aiReady || text.trim().length < 10) {
        setEmotionAnalysis(null);
        return;
      }

      try {
        const analysis = await analyzeTextMessage(text);
        setEmotionAnalysis(analysis);
      } catch (error) {
        console.error("❌ [AI] Analysis error:", error);
      }
    }, 2000),
    [aiReady, analyzeTextMessage]
  );

  const checkImagesBeforeSend = async (
    attachments: AttachmentPreview[]
  ): Promise<boolean> => {
    const images = attachments.filter((att) => att.type === "image");

    if (images.length === 0 || !aiReady) {
      return true;
    }

    try {
      console.log(`🖼️ [AI] Checking ${images.length} images for toxicity...`);
      setAnalyzingImage(true);

      for (const img of images) {
        const toxicityCheck = await checkImageToxicity(img.uri);

        if (toxicityCheck.isToxic) {
          console.log(`⚠️ [AI] Image "${img.name}" is TOXIC - BLOCKING`);

          Alert.alert(
            "⚠️ " + t("message.ai.imageToxicTitle"),
            t("message.ai.imageToxicMessage", {
              categories: toxicityCheck.categories.join(", "),
            }),
            [{ text: t("ok") }]
          );

          setAnalyzingImage(false);
          return false;
        }
      }

      console.log("✅ [AI] All images are safe");
      setAnalyzingImage(false);
      return true;
    } catch (error) {
      console.error("❌ [AI] Image check error:", error);
      setAnalyzingImage(false);
      return true;
    }
  };

  const handleGiphySelect = async (
    richMedia: RichMediaDTO,
    type: "gif" | "sticker"
  ) => {
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
      Alert.alert(t("error"), error.message || `Failed to send ${type}`);
    }
  };

  // ============================================
  // ✅ HANDLE SEND - COMPLETE FIXED VERSION
  // ============================================
  const handleSend = async () => {
    if (!message.trim() && attachments.length === 0) return;

    if (isSendingRef.current || uploadingFiles || analyzingImage) {
      console.log("⏭️ Already processing, skipping...");
      return;
    }

    if (isTypingRef.current && onTyping) {
      console.log("⌨️ [SEND] Stopping typing indicator");
      isTypingRef.current = false;
      onTyping(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const messageContent = message.trim();
    const currentAttachments = [...attachments];
    const currentReplyTo = replyTo?._id;

    const imagesAreSafe = await checkImagesBeforeSend(currentAttachments);
    if (!imagesAreSafe) {
      console.log("🚫 [AI] Images contain toxic content - BLOCKED!");
      return;
    }

    let emotionData: any = null;
    if (messageContent && aiReady) {
      try {
        const analysis = await analyzeTextMessage(messageContent);
        emotionData = analysis;
      } catch (error) {
        console.error("❌ [AI] Text analysis failed:", error);
      }
    }

    setMessage("");
    setAttachments([]);
    setEmotionAnalysis(null);
    if (onCancelReply) {
      onCancelReply();
    }

    try {
      isSendingRef.current = true;
      setUploadingFiles(true);

      const shouldEncryptFiles =
        encryptionReady && recipientId && currentAttachments.length > 0;

     if (shouldEncryptFiles) {
  console.log("🚀 [SEND] Starting STREAMING encrypt + upload...");

  const firstAttachment = currentAttachments[0];
  let messageType: "image" | "video" | "audio" | "file" = "file";

  if (firstAttachment.type === "image") messageType = "image";
  else if (firstAttachment.type === "video") messageType = "video";
  else if (firstAttachment.type === "audio") messageType = "audio";

  const localUris = currentAttachments.map((att) => att.uri);
  const tempId = `temp_${Date.now()}_${Math.random()}`;

  // ✅ STEP 1: Create optimistic message
  onSendMessage({
    tempId,
    type: messageType,
    content: messageContent || undefined,
    localUris: localUris,
    replyTo: currentReplyTo,
    isOptimistic: true,
  });

  console.log("✅ [SEND] Optimistic message created locally");

  const encryptedFiles: any[] = [];
  const totalFiles = currentAttachments.length;
  let nativeAlreadyCreatedMessage = false;  // ✅ ADD FLAG

  // ✅ STEP 2: Encrypt all files
  for (let i = 0; i < currentAttachments.length; i++) {
    const att = currentAttachments[i];

    console.log(`🔒 [ENCRYPT] File ${i + 1}/${totalFiles}: ${att.name}`);

    const result = await encryptAndUploadFile(
      att.uri,
      att.name,
      conversationId!,
      recipientId,
      {
        onProgress: (progress) => {
          setUploadProgress({
            phase: progress.phase,
            percentage: progress.percentage,
            chunksEncrypted: progress.chunksEncrypted || 0,
            chunksUploaded: progress.chunksUploaded || 0,
            totalChunks: progress.totalChunks || 1,
            currentFile: i + 1,
            totalFiles,
          });
        },
      }
    );

    // ✅ Check if native already created message
    if (result.skipMessageCreation) {
      nativeAlreadyCreatedMessage = true;
      console.log("✅ [SEND] Native already created message, will skip duplicate");
    }

    encryptedFiles.push({
      encryptedFileId: result.fileId,
      messageId: result.messageId,  // ✅ Keep messageId from native
      isLargeFile: true,
      originalFileName: att.name,
      originalFileType: att.mimeType || getMimeType(att.name),
      encryptionMetadata: {
        iv: result.masterIv,
        authTag: result.masterAuthTag,
        original_size: result.originalSize,
        encrypted_size: result.encryptedSize,
        chunks: result.chunks,
        totalChunks: result.totalChunks,
        fileId: result.fileId,
      },
    });

    console.log(`✅ [UPLOAD] File uploaded: ${att.name}`);
  }

  setUploadProgress(null);

  // ✅ CRITICAL: Check flag before sending
  if (nativeAlreadyCreatedMessage) {
    console.log("✅ [SEND] Message already created by native - SKIPPING duplicate send");
    console.log(`   Message ID: ${encryptedFiles[0]?.messageId}`);
    
    // Just cleanup UI
    setUploadingFiles(false);
    isSendingRef.current = false;

    if (messageContent && conversationId && emotionData) {
      saveEmotionInBackground(messageContent, conversationId, emotionData);
    }

    return;  // ✅ EXIT EARLY - Don't call onSendMessage again!
  }

  // ❌ This code ONLY runs if native didn't create message (fallback/old flow)
  console.log("📤 [SEND] Sending encrypted files to server:", {
    fileCount: encryptedFiles.length,
    type: messageType,
    hasContent: !!messageContent,
  });

  onSendMessage({
    content: messageContent || undefined,
    type: messageType,
    encryptedFiles: encryptedFiles,
    replyTo: currentReplyTo,
    tempId: tempId,
  });

  console.log("✅ [SEND] Message sent with streaming encrypted files");
  setUploadingFiles(false);
  isSendingRef.current = false;

  if (messageContent && conversationId && emotionData) {
    saveEmotionInBackground(messageContent, conversationId, emotionData);
  }

  return;
}

      if (currentAttachments.length === 0 && messageContent) {
        if (encryptionInitialized && recipientId) {
          try {
            console.log("🔐 [SEND] Encrypting text message...");

            const encrypted = await encryptMessage(recipientId, messageContent);

            console.log("🔐 [SEND] Encryption result:", {
              hasEncryptedContent: !!encrypted.encryptedContent,
              hasMetadata: !!encrypted.encryptionMetadata,
              encryptedContentType: typeof encrypted.encryptedContent,
            });

            // ✅ CRITICAL: Pass as OBJECT with all fields
            const textData = {
              content: messageContent,
              encryptedContent: encrypted.encryptedContent, // ✅ This is JSON string from useEncryption
              encryptionMetadata: encrypted.encryptionMetadata,
              type: "text" as const,
              replyTo: currentReplyTo,
            };

            console.log("📤 [SEND] Calling onSendMessage with textData:", {
              hasEncryptedContent: !!textData.encryptedContent,
              hasMetadata: !!textData.encryptionMetadata,
              type: textData.type,
              encryptedContentPreview:
                typeof textData.encryptedContent === "string"
                  ? textData.encryptedContent.substring(0, 50)
                  : "NOT A STRING!",
            });

            onSendMessage(textData); // ✅ Pass object

            console.log("✅ [SEND] Encrypted text message sent");
          } catch (error: any) {
            console.error("❌ [SEND] Text encryption failed:", error);
            Alert.alert(t("error"), `Failed to encrypt: ${error.message}`);
            setUploadingFiles(false);
            isSendingRef.current = false;
            return;
          }
        } else {
          console.error("❌ [SEND] Encryption not ready:", {
            encryptionInitialized,
            hasRecipientId: !!recipientId,
          });
          Alert.alert(t("error"), "Encryption not ready. Please wait...");
          setUploadingFiles(false);
          isSendingRef.current = false;
          return;
        }

        setUploadingFiles(false);
        isSendingRef.current = false;

        if (messageContent && conversationId && emotionData) {
          saveEmotionInBackground(messageContent, conversationId, emotionData);
        }

        return; // ✅ CRITICAL: Return here to prevent FormData creation
      }
      // ✅ Handle non-encrypted attachments
      else if (currentAttachments.length > 0) {
        const mediaFiles = currentAttachments.filter((att) =>
          ["image", "video", "audio"].includes(att.type)
        );
        const documentFiles = currentAttachments.filter(
          (att) => att.type === "file"
        );

        if (mediaFiles.length > 0) {
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
        }

        if (documentFiles.length > 0) {
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
      }

      setUploadingFiles(false);
      isSendingRef.current = false;

      if (messageContent && conversationId && emotionData) {
        saveEmotionInBackground(messageContent, conversationId, emotionData);
      }
    } catch (error: any) {
      console.error("❌ [SEND] Error:", error);
      setUploadingFiles(false);
      setUploadProgress(null);
      isSendingRef.current = false;
      Alert.alert(t("error"), error.message || t("message.failed"));
    }
  };

  const saveEmotionInBackground = async (
    text: string,
    convId: string,
    analysis?: any
  ) => {
    setTimeout(async () => {
      try {
        console.log("🔍 [Background] Saving emotion to backend...");

        let emotionData = analysis;

        if (!emotionData) {
          emotionData = await analyzeTextMessage(text);
        }

        const token = await getToken();
        const toxicityScore = Math.max(0, emotionData.toxicityScore || 0);

        await axios.post(
          `${API_URL}/api/emotion/save`,
          {
            conversationId: convId,
            textAnalyzed: text,
            emotionScores: emotionData.scores,
            dominantEmotion: emotionData.emotion,
            confidenceScore: emotionData.confidence,
            context: "message",
            isToxic: emotionData.isToxic || false,
            toxicityScore: toxicityScore,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("✅ [Background] Emotion saved to backend");
      } catch (error) {
        console.error("❌ [Background] Failed to save emotion:", error);
      }
    }, 0);
  };

  const handleImagePicker = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        t("message.attachment.permissionRequired"),
        t("message.attachment.mediaPermission")
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
      Alert.alert(t("error"), t("message.attachment.pickFailed"));
    }
  };

  const handleCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        t("message.attachment.permissionRequired"),
        t("message.attachment.cameraPermission")
      );
      return;
    }

    Alert.alert(
      t("message.attachment.camera"),
      t("message.attachment.camera"),
      [
        {
          text: t("message.attachment.takePhoto"),
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
          text: t("message.attachment.recordVideo"),
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
          text: t("cancel"),
          style: "cancel",
        },
      ]
    );
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("message.attachment.permissionRequired"),
          t("message.attachment.micPermission")
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
        t("message.attachment.recordingError"),
        error?.message || t("message.attachment.recordingFailed")
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
      Alert.alert(t("error"), t("message.attachment.recordingFailed"));
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

  const renderUploadProgress = () => {
    if (!uploadProgress) return null;

    const {
      phase,
      percentage,
      chunksEncrypted,
      chunksUploaded,
      totalChunks,
      currentFile,
      totalFiles,
    } = uploadProgress;

    let statusText = "";
    let statusIcon = "";

    switch (phase) {
      case "thumbnail":
        statusText = t("message.encryption.generatingThumbnail");
        statusIcon = "🖼️";
        break;
      case "encrypting":
        statusText = `${t("message.encryption.encrypting")}: ${chunksEncrypted}/${totalChunks} chunks`;
        statusIcon = "🔒";
        break;
      case "uploading":
        statusText = `${t("message.encryption.uploading")}: ${chunksUploaded}/${totalChunks} chunks`;
        statusIcon = "📤";
        break;
      case "finalizing":
        statusText = t("message.encryption.finalizing");
        statusIcon = "✅";
        break;
    }

    if (totalFiles > 1) {
      statusText = `${statusIcon} File ${currentFile}/${totalFiles}: ${statusText}`;
    } else {
      statusText = `${statusIcon} ${statusText}`;
    }

    return (
      <View style={styles.uploadingContainer}>
        <View style={styles.progressHeader}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={[styles.uploadingText, isDark && styles.textWhite]}>
            {statusText}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[styles.progressBarFill, { width: `${percentage}%` }]}
            />
          </View>
          <Text style={styles.progressDetail}>{percentage.toFixed(0)}%</Text>
        </View>
      </View>
    );
  };

  const renderEmotionIndicator = () => {
    if (!emotionAnalysis || !message.trim()) return null;

    const emotionEmojis = {
      joy: "😊",
      sadness: "😢",
      anger: "😠",
      fear: "😨",
      surprise: "😮",
      love: "❤️",
    };

    const emotionColors = {
      joy: "#10B981",
      sadness: "#3B82F6",
      anger: "#EF4444",
      fear: "#8B5CF6",
      surprise: "#F59E0B",
      love: "#EC4899",
    };

    return (
      <View style={styles.emotionIndicator}>
        <Text style={{ fontSize: 16 }}>
          {emotionEmojis[emotionAnalysis.emotion]}
        </Text>
        <Text
          style={[
            styles.emotionText,
            { color: emotionColors[emotionAnalysis.emotion] },
          ]}
        >
          {t(`emotions.${emotionAnalysis.emotion}`)}
        </Text>
        <Text style={[styles.emotionConfidence, isDark && styles.textGray400]}>
          {(emotionAnalysis.confidence * 100).toFixed(0)}%
        </Text>
      </View>
    );
  };

  const isSendDisabled =
    uploadingFiles ||
    analyzingImage ||
    disabled ||
    (!message.trim() && attachments.length === 0);

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
              {t("message.reply.replyingTo", {
                name: replyTo.sender?.full_name,
              })}
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

      {analyzingImage && (
        <View style={styles.uploadingContainer}>
          <View style={styles.progressHeader}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={[styles.uploadingText, isDark && styles.textWhite]}>
              {t("message.ai.checkingImage")}
            </Text>
          </View>
        </View>
      )}

      {renderUploadProgress()}
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
            color={
              uploadingFiles || disabled || analyzingImage
                ? "#ccc"
                : isDark
                  ? "#fff"
                  : "#666"
            }
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
            color={
              uploadingFiles || disabled || analyzingImage
                ? "#ccc"
                : isDark
                  ? "#fff"
                  : "#666"
            }
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
            color={
              uploadingFiles || disabled || analyzingImage
                ? "#ccc"
                : isDark
                  ? "#fff"
                  : "#666"
            }
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
            color={
              uploadingFiles || disabled || analyzingImage
                ? "#ccc"
                : isDark
                  ? "#fff"
                  : "#666"
            }
          />
        </TouchableOpacity>

        <TextInput
          value={message}
          onChangeText={handleTyping}
          placeholder={t("message.input.placeholder")}
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
            {t("message.input.recording")}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  textWhite: {
    color: "#ffffff",
  },
  progressBarContainer: {
    marginBottom: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#f97316",
    borderRadius: 3,
  },
  progressDetail: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 4,
  },
  emotionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  emotionText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  emotionConfidence: {
    fontSize: 11,
    marginLeft: 6,
    color: "#9ca3af",
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
