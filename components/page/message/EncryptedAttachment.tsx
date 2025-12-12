/* eslint-disable import/namespace */
// components/page/message/EncryptedAttachment.tsx - NEW FILE
import { useFileEncryption } from "@/hooks/message/useFileEncryption";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  fileId: string;
  fileName: string;
  fileType: string;
  isEncrypted: boolean;
  encryptionMetadata?: {
    iv: string;
    auth_tag: string;
    original_size: number;
  };
  senderClerkId: string;
}

export const EncryptedAttachment: React.FC<Props> = ({
  fileId,
  fileName,
  fileType,
  isEncrypted,
  encryptionMetadata,
  senderClerkId,
}) => {
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { decryptFile, isReady } = useFileEncryption();
  const { getToken } = useAuth();

  useEffect(() => {
    if (isEncrypted && encryptionMetadata && isReady) {
      handleDecryptFile();
    }
  }, [isEncrypted, encryptionMetadata, isReady]);

  const handleDecryptFile = async () => {
    try {
      setLoading(true);
      console.log("🔓 Decrypting attachment:", fileName);

      // 1. Get signed URL
      const token = await getToken();
      const API_URL = process.env.EXPO_PUBLIC_API_URL;

      const signedUrlResponse = await fetch(
        `${API_URL}/api/files/signed-url/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const signedResult = await signedUrlResponse.json();
      if (!signedResult.success) {
        throw new Error(signedResult.error);
      }

      console.log("✅ Got signed URL");

      // 2. Download encrypted file
      const fileResponse = await fetch(signedResult.signedUrl);
      const arrayBuffer = await fileResponse.arrayBuffer();
      const encryptedBase64 = Buffer.from(arrayBuffer).toString("base64");

      // 3. Decrypt file
      const localUri = await decryptFile(
        encryptedBase64,
        encryptionMetadata!.iv,
        encryptionMetadata!.auth_tag,
        senderClerkId
      );

      setDecryptedUri(localUri);
      console.log("✅ File decrypted:", localUri);
    } catch (error) {
      console.error("❌ Failed to decrypt file:", error);
      Alert.alert("Error", "Failed to decrypt file");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!decryptedUri) return;

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(decryptedUri);
      } else {
        Alert.alert("Success", "File ready in cache");
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  if (loading) {
    return (
      <View className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <ActivityIndicator size="small" color="#F97316" />
        <Text className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          🔓 Decrypting...
        </Text>
      </View>
    );
  }

  if (fileType.startsWith("image/") && decryptedUri) {
    return (
      <TouchableOpacity onPress={handleDownload}>
        <Image
          source={{ uri: decryptedUri }}
          className="w-64 h-64 rounded-lg"
          resizeMode="cover"
        />
        {isEncrypted && (
          <View className="absolute top-2 right-2 bg-green-500 rounded-full px-2 py-1">
            <Text className="text-white text-xs font-bold">🔒</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleDownload}
      className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex-row items-center"
    >
      <Ionicons name="document" size={24} color="#666" />
      <View className="ml-3 flex-1">
        <Text className="text-gray-900 dark:text-white font-medium">
          {fileName}
        </Text>
        {isEncrypted && (
          <Text className="text-green-600 dark:text-green-400 text-xs mt-1">
            🔒 Encrypted
          </Text>
        )}
      </View>
      <Ionicons name="download" size={20} color="#666" />
    </TouchableOpacity>
  );
};
