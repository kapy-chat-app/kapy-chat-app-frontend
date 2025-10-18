// app/call/[id].tsx - FIX Agora Configuration
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useColorScheme,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  VideoSourceType,
} from 'react-native-agora';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export default function VideoCallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { getToken, userId } = useAuth();
  const { 
    id: callId, 
    channelName, 
    conversationId,
    callType = 'video'
  } = useLocalSearchParams<{
    id: string;
    channelName: string;
    conversationId: string;
    callType?: 'video' | 'audio';
  }>();

  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  // ⭐ Request Permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ];
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const cameraGranted = granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;
        const audioGranted = granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;
        
        if (!cameraGranted || !audioGranted) {
          Alert.alert('Permissions Required', 'Camera and microphone permissions are required for video calls');
          return false;
        }
        
        console.log('✅ Permissions granted');
        return true;
      } catch (err) {
        console.error('❌ Permission error:', err);
        return false;
      }
    }
    return true;
  };

  // ⭐ Initialize Socket Connection
  useEffect(() => {
    if (!userId || !conversationId) return;

    console.log('📞 Initializing socket for call screen');
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('📞 Socket connected in call screen:', socket.id);
      
      const personalRoom = `user:${userId}`;
      socket.emit('join', personalRoom);
      console.log(`📞 Joined personal room in call screen: ${personalRoom}`);
    });

    socket.on('callAnswered', (data: any) => {
      console.log('📞 Call answered event received:', data);
    });

    socket.on('callEnded', (data: any) => {
      console.log('📞 Call ended event received:', data);
      Alert.alert('Call Ended', 'The call has been ended', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    });

    socket.on('callRejected', (data: any) => {
      console.log('📞 Call rejected event received:', data);
      Alert.alert('Call Rejected', 'The call was rejected', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    });

    socketRef.current = socket;

    return () => {
      console.log('📞 Cleaning up socket in call screen');
      socket.disconnect();
    };
  }, [userId, conversationId]);

  // Initialize Agora Engine
  useEffect(() => {
    const init = async () => {
      try {
        // ⭐ Request permissions first
        const hasPermissions = await requestPermissions();
        if (!hasPermissions) {
          Alert.alert('Error', 'Permissions not granted');
          router.back();
          return;
        }

        // Get Agora token
        const authToken = await getToken();
        const response = await axios.post(
          `${API_URL}/api/agora/token`,
          {
            channelName,
            role: 'publisher',
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        const { token, appId, uid } = response.data;

        if (!appId) {
          throw new Error('Agora App ID not available');
        }

        console.log('🎥 Initializing Agora with appId:', appId);
        console.log('🎥 Channel:', channelName);
        console.log('🎥 UID:', uid);

        // Create Agora Engine
        const engine = createAgoraRtcEngine();
        agoraEngineRef.current = engine;

        // Initialize engine
        engine.initialize({
          appId: appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        // Register event handlers
        engine.registerEventHandler({
          onJoinChannelSuccess: (connection, elapsed) => {
            console.log('✅ Join channel success:', connection.channelId);
            setJoined(true);
          },
          onUserJoined: (connection, remoteUid, elapsed) => {
            console.log('👤 Remote user joined:', remoteUid);
            setRemoteUid(remoteUid);
          },
          onUserOffline: (connection, remoteUid, reason) => {
            console.log('👤 Remote user offline:', remoteUid, 'reason:', reason);
            if (remoteUid === remoteUid) {
              setRemoteUid(null);
            }
          },
          onError: (err, msg) => {
            console.error('❌ Agora Error:', err, msg);
          },
          // ⭐ Add more event handlers for debugging
          onRemoteVideoStateChanged: (connection, remoteUid, state, reason, elapsed) => {
            console.log('📹 Remote video state changed:', { remoteUid, state, reason });
          },
          onRemoteAudioStateChanged: (connection, remoteUid, state, reason, elapsed) => {
            console.log('🎤 Remote audio state changed:', { remoteUid, state, reason });
          },
        });

        // ⭐ Enable audio first
        await engine.enableAudio();
        console.log('🎤 Audio enabled');

        // ⭐ Enable video for video calls
        if (callType === 'video') {
          await engine.enableVideo();
          console.log('📹 Video enabled');
          
          // ⭐ Start preview
          await engine.startPreview();
          console.log('📹 Preview started');
        }

        // ⭐ Set channel profile
        await engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

        // ⭐ Set client role as broadcaster
        await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        console.log('👤 Client role set to broadcaster');

        // ⭐ Enable speaker
        await engine.setEnableSpeakerphone(true);
        console.log('🔊 Speaker enabled');

        // ⭐ Set audio profile for better quality
        await engine.setAudioProfile(1, 1); // Speech standard, mono
        console.log('🎵 Audio profile set');

        // ⭐ Join channel
        console.log('🔗 Joining Agora channel...');
        const result = await engine.joinChannel(token, channelName, uid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: callType === 'video',
        });
        
        console.log('🔗 Join channel result:', result);

      } catch (error: any) {
        console.error('❌ Error initializing Agora:', error);
        Alert.alert('Error', 'Failed to initialize call: ' + (error.message || 'Unknown error'));
        router.back();
      }
    };

    init();

    return () => {
      const engine = agoraEngineRef.current;
      if (engine) {
        console.log('🧹 Cleaning up Agora engine');
        engine.leaveChannel();
        engine.release();
      }
    };
  }, [channelName, callType]);

  // Call duration timer
  useEffect(() => {
    if (!joined) return;

    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [joined]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    try {
      const engine = agoraEngineRef.current;
      if (engine) {
        await engine.leaveChannel();
      }

      const authToken = await getToken();
      await axios.post(
        `${API_URL}/api/calls/${callId}/end`,
        { duration: callDuration },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      console.log('📞 Call ended');
      router.back();
    } catch (error) {
      console.error('❌ Error ending call:', error);
      router.back();
    }
  };

  const toggleMute = () => {
    const engine = agoraEngineRef.current;
    if (engine) {
      engine.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
      console.log('🎤 Mute toggled:', !isMuted);
    }
  };

  const toggleVideo = () => {
    const engine = agoraEngineRef.current;
    if (engine && callType === 'video') {
      engine.muteLocalVideoStream(!isVideoOff);
      setIsVideoOff(!isVideoOff);
      console.log('📹 Video toggled:', !isVideoOff);
    }
  };

  const toggleSpeaker = () => {
    const engine = agoraEngineRef.current;
    if (engine) {
      engine.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
      console.log('🔊 Speaker toggled:', !isSpeakerOn);
    }
  };

  const switchCamera = () => {
    const engine = agoraEngineRef.current;
    if (engine && callType === 'video') {
      engine.switchCamera();
      console.log('📷 Camera switched');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Remote Video or Audio Call UI */}
      {callType === 'video' ? (
        <View style={styles.remoteVideoContainer}>
          {remoteUid ? (
            <>
              <RtcSurfaceView
                style={styles.remoteVideo}
                canvas={{
                  uid: remoteUid,
                  sourceType: VideoSourceType.VideoSourceRemote,
                }}
              />
              <Text style={styles.remoteUidText}>Remote UID: {remoteUid}</Text>
            </>
          ) : (
            <View style={styles.waitingContainer}>
              <Ionicons name="person-circle-outline" size={100} color="#666" />
              <Text style={styles.waitingText}>Waiting for others to join...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.audioCallContainer}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-circle" size={150} color="#f97316" />
          </View>
          <Text style={styles.audioStatusText}>
            {remoteUid ? 'Connected' : 'Calling...'}
          </Text>
        </View>
      )}

      {/* Local Video (Picture in Picture) */}
      {callType === 'video' && joined && !isVideoOff && (
        <View style={styles.localVideoContainer}>
          <RtcSurfaceView
            style={styles.localVideo}
            canvas={{
              uid: 0,
              sourceType: VideoSourceType.VideoSourceCamera,
            }}
          />
        </View>
      )}

      {/* Call Info */}
      <View style={styles.topBar}>
        <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
        <Text style={styles.statusText}>
          {joined ? (remoteUid ? 'Connected' : 'Ringing...') : 'Connecting...'}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity
            style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            onPress={toggleVideo}
          >
            <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {callType === 'video' && (
          <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlButton, !isSpeakerOn && styles.controlButtonActive]}
          onPress={toggleSpeaker}
        >
          <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideoContainer: {
    flex: 1,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  remoteUidText: {
    position: 'absolute',
    top: 10,
    left: 10,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 5,
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  avatarPlaceholder: {
    marginBottom: 30,
  },
  audioStatusText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  waitingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f97316',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 16,
  },
  durationText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusText: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#f97316',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
  },
});