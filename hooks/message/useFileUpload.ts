// hooks/useFileUpload.ts
import { useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface FileUploadResult {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface UseFileUploadReturn {
  uploading: boolean;
  error: string | null;
  uploadFile: (fileUri: string, fileName: string, fileType: string) => Promise<FileUploadResult | null>;
  pickImage: () => Promise<FileUploadResult | null>;
  pickVideo: () => Promise<FileUploadResult | null>;
  pickDocument: () => Promise<FileUploadResult | null>;
  takePhoto: () => Promise<FileUploadResult | null>;
  takeVideo: () => Promise<FileUploadResult | null>;
  clearError: () => void;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );
  const clearError = () => setError(null);

  const uploadFile = async (
    fileUri: string, 
    fileName: string, 
    fileType: string
  ): Promise<FileUploadResult | null> => {
    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      
      // Create file object for FormData
      const fileObject = {
        uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
        name: fileName,
        type: fileType,
      } as any;

      formData.append('file', fileObject);

      const response = await fetch(`${API_BASE_URL}/api/files`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Map response to expected interface
      return {
        id: result.data.id,
        name: result.data.name,
        url: result.data.url,
        type: result.data.type,
        size: result.data.size,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('File upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permission to access media library is required');
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your media library in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to request media library permission');
      return false;
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Camera permission is required');
        Alert.alert(
          'Permission Required',
          'Please grant camera permission in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to request camera permission');
      return false;
    }
  };

  const pickImage = async (): Promise<FileUploadResult | null> => {
    try {
      setError(null);
      
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const fileType = asset.type === 'image' ? 'image/jpeg' : 'image/png';

      return await uploadFile(asset.uri, fileName, fileType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick image';
      setError(errorMessage);
      return null;
    }
  };

  const pickVideo = async (): Promise<FileUploadResult | null> => {
    try {
      setError(null);
      
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 1 minute max
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName || `video_${Date.now()}.mp4`;
      const fileType = 'video/mp4';

      return await uploadFile(asset.uri, fileName, fileType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick video';
      setError(errorMessage);
      return null;
    }
  };

  const pickDocument = async (): Promise<FileUploadResult | null> => {
    try {
      setError(null);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileName = asset.name;
      const fileType = asset.mimeType || 'application/octet-stream';

      // Check file size (10MB limit)
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return null;
      }

      return await uploadFile(asset.uri, fileName, fileType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick document';
      setError(errorMessage);
      return null;
    }
  };

  const takePhoto = async (): Promise<FileUploadResult | null> => {
    try {
      setError(null);
      
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return null;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileName = `photo_${Date.now()}.jpg`;
      const fileType = 'image/jpeg';

      return await uploadFile(asset.uri, fileName, fileType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
      setError(errorMessage);
      return null;
    }
  };

  const takeVideo = async (): Promise<FileUploadResult | null> => {
    try {
      setError(null);
      
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return null;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 1 minute max
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileName = `video_${Date.now()}.mp4`;
      const fileType = 'video/mp4';

      return await uploadFile(asset.uri, fileName, fileType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take video';
      setError(errorMessage);
      return null;
    }
  };

  return {
    uploading,
    error,
    uploadFile,
    pickImage,
    pickVideo,
    pickDocument,
    takePhoto,
    takeVideo,
    clearError,
  };
};