/* eslint-disable import/namespace */
// components/page/message/MessageInput.tsx - COMPLETE WITH E2EE FILES
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useFileEncryption } from "@/hooks/message/useFileEncryption"; // ✅ NEW
import { useAuth } from "@clerk/clerk-expo"; // ✅ NEW

interface AttachmentPreview {
  id: string;
  uri: string;
  type: "image" | "video" | "audio" | "file";
  name: string;
  mimeType?: string;
  size?: number;
}

interface MessageInputProps {
  conversationId?: string; // ✅ NEW
  recipientId?: string; // ✅ NEW - Pass from MessageScreen
  onSendMessage: (data: FormData | any) => void;
  replyTo?: any;
  onCancelReply?: () => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean; // ✅ NEW
}

const MessageInput: React.FC<MessageInputProps> = ({
  conversationId, // ✅ NEW
  recipientId, // ✅ NEW
  onSendMessage,
  replyTo,
  onCancelReply,
  onTyping,
  disabled = false, // ✅ NEW
}) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false); // ✅ NEW
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // ✅ NEW: File encryption hook
  const { encryptFile, isReady: encryptionReady } = useFileEncryption();
  const { getToken } = useAuth();

  // ✅ Handle typing indicator
  const handleTyping = (text: string) => {
    setMessage(text);

    if (!onTyping) return;

    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
      console.log('⌨️ Started typing');
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTyping(false);
        console.log('⌨️ Stopped typing (timeout)');
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && onTyping) {
        onTyping(false);
        console.log('⌨️ Stopped typing (unmount)');
      }
    };
  }, [onTyping]);

  // ✅ UPDATED: handleSend với E2EE file support
  const handleSend = async () => {
    if (!message.trim() && attachments.length === 0) return;

    // Stop typing indicator
    if (isTypingRef.current && onTyping) {
      isTypingRef.current = false;
      onTyping(false);
      console.log('⌨️ Stopped typing (send)');
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

     const messageContent = message.trim();
  const currentAttachments = [...attachments];
  const currentReplyTo = replyTo?._id;

  setMessage("");
  setAttachments([]);
  if (onCancelReply) {
    onCancelReply();
  }

  try {
    const shouldEncryptFiles = encryptionReady && recipientId && currentAttachments.length > 0;

    if (shouldEncryptFiles) {
      console.log('🔒 Encrypting files before sending...');
      setUploadingFiles(true);

      const encryptedFiles: any[] = [];
      const localUris: string[] = []; // ✅ NEW: Keep track of local URIs

      // Encrypt all files
      for (const att of currentAttachments) {
        try {
          console.log('🔒 Encrypting file:', att.name);

          const { encryptedBase64, metadata } = await encryptFile(
            att.uri,
            att.name,
            recipientId
          );

          encryptedFiles.push({
            encryptedBase64,
            originalFileName: att.name,
            originalFileType: att.mimeType || 'application/octet-stream',
            encryptionMetadata: {
              iv: metadata.iv,
              authTag: metadata.authTag,
              original_size: metadata.original_size,
              encrypted_size: metadata.encrypted_size,
            },
          });

          // ✅ NEW: Keep local URI for preview
          localUris.push(att.uri);

          console.log('✅ File encrypted:', att.name);
        } catch (error) {
          console.error('❌ Failed to encrypt file:', att.name, error);
          Alert.alert('Error', `Failed to encrypt ${att.name}`);
        }
      }

      setUploadingFiles(false);

      // ✅ Send message with encrypted files AND local URIs
      if (messageContent || encryptedFiles.length > 0) {
        const messageData = {
          content: messageContent || undefined,
          type: 'file' as const, // ✅ Changed to 'file' type
          encryptedFiles: encryptedFiles.length > 0 ? encryptedFiles : undefined,
          localUris: localUris, // ✅ NEW: Pass local URIs for preview
          replyTo: currentReplyTo,
        };

        console.log('📤 Sending message with encrypted files:', {
          hasContent: !!messageData.content,
          filesCount: encryptedFiles.length,
          localUrisCount: localUris.length,
        });

        onSendMessage(messageData);
      }

      return;
    }

      // ✅ FALLBACK: Non-encrypted file handling (backward compatible)
      const mediaFiles = currentAttachments.filter((att) =>
        ["image", "video", "audio"].includes(att.type)
      );
      const documentFiles = currentAttachments.filter((att) => att.type === "file");

      // Text only
      if (currentAttachments.length === 0 && messageContent) {
        const textData = {
          content: messageContent,
          type: "text" as const,
          replyTo: currentReplyTo,
        };
        onSendMessage(textData);
      }
      // Media files (non-encrypted fallback)
      else if (mediaFiles.length > 0) {
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

        // Send documents separately if exist
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
      }
      // Documents only (non-encrypted fallback)
      else if (documentFiles.length > 0) {
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
    } catch (error: any) {
      console.error("Send error:", error);
      setUploadingFiles(false);
      Alert.alert('Error', error.message || 'Failed to send message');
    }
  };

  // ✅ GIỮ NGUYÊN: All picker methods
  const handleImagePicker = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access media library is required!"
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
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const handleCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Camera permission is required!");
      return;
    }

    Alert.alert("Camera", "Choose an option", [
      {
        text: "Take Photo",
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
        text: "Record Video",
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
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Microphone permission is required!"
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
        "Recording Error",
        error?.message ||
          "Failed to start recording. Please check microphone permissions in device settings."
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
      Alert.alert("Error", "Failed to stop recording");
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

  // ✅ NEW: Disable send when uploading or disabled
  const isSendDisabled = uploadingFiles || disabled || (!message.trim() && attachments.length === 0);

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
              Replying to {replyTo.sender?.full_name}
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

      {/* ✅ NEW: Upload progress indicator */}
      {uploadingFiles && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={[styles.uploadingText, isDark && styles.textWhite]}>
            🔒 Encrypting and uploading files...
          </Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity 
          onPress={handleCamera} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled}
        >
          <Ionicons 
            name="camera" 
            size={24} 
            color={(uploadingFiles || disabled) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleImagePicker} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled}
        >
          <Ionicons 
            name="image" 
            size={24} 
            color={(uploadingFiles || disabled) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleFilePicker} 
          style={styles.iconButton}
          disabled={uploadingFiles || disabled}
        >
          <Ionicons 
            name="attach" 
            size={24} 
            color={(uploadingFiles || disabled) ? "#ccc" : (isDark ? "#fff" : "#666")} 
          />
        </TouchableOpacity>

        <TextInput
          value={message}
          onChangeText={handleTyping}
          placeholder="Type a message..."
          placeholderTextColor={isDark ? "#999" : "#666"}
          multiline
          maxLength={5000}
          editable={!uploadingFiles && !disabled}
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
            disabled={uploadingFiles || disabled}
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
            {uploadingFiles ? (
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
            Recording...
          </Text>
        </View>
      )}
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
  // ✅ NEW: Upload progress styles
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  textWhite: {
    color: '#ffffff',
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
  // ✅ NEW: Disabled button style
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