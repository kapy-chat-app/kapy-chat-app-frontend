// app/call/[id].tsx - FIXED: Remote Video Stream Display Issues
import {useCallRecording} from "@/hooks/call/useCallRecording";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  VideoSourceType,
  RenderModeType,
  VideoMirrorModeType,
} from "react-native-agora";
import { SafeAreaView } from "react-native-safe-area-context";
import io, { Socket } from "socket.io-client";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:3000";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Participant {
  uid: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  isScreenSharing?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

export default function VideoCallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { getToken, userId } = useAuth();
  const {
    id: callId,
    channelName,
    conversationId,
    callType = "video",
    conversationType = "private",
  } = useLocalSearchParams<{
    id: string;
    channelName: string;
    conversationId: string;
    callType?: "video" | "audio";
    conversationType?: "private" | "group";
  }>();

  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isEndingRef = useRef(false);
  const cameraRef = useRef<any>(null);
  const remoteVideoSetupRef = useRef<Set<number>>(new Set()); // Track setup attempts

  // Call states
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [mainParticipant, setMainParticipant] = useState<Participant | null>(
    null
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [myUid, setMyUid] = useState<number>(0);
  const [isEmotionAnalyzing, setIsEmotionAnalyzing] = useState(false);

  // Call ending overlay states
  const [showEndingOverlay, setShowEndingOverlay] = useState(false);
  const [endingMessage, setEndingMessage] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isGroupCall = conversationType === "group";

  // ⭐ RECORDING HOOK - Engine will be passed to functions when called
  const {
    recordingState,
    startRecording,
    stopRecording,
    captureVideoFrame,
    uploadRecordings,
    cleanupRecordings,
  } = useCallRecording({
    callId: callId || "",
    userId: userId || "",
    callType: (callType as "audio" | "video") || "video",
    onRecordingComplete: async (data: any) => {
      console.log("📝 Recording complete, preparing for emotion analysis...");

      let videoFrameUri = data.videoUri;
      
      // Try to capture video frame if in video call
      if (callType === "video") {
        videoFrameUri = await captureVideoFrame();
      }

      try {
        setIsEmotionAnalyzing(true);
        const result = await uploadRecordings(
          data.audioUri,
          videoFrameUri,
          data.duration
        );

        // Show emotion analysis result
        if (result?.emotion) {
          Alert.alert(
            "Emotion Analysis Complete",
            `Detected emotion: ${result.emotion} (${(result.score * 100).toFixed(0)}% confidence)`,
            [{ text: "OK" }]
          );
        }

        await cleanupRecordings();
      } catch (error) {
        console.error("Failed to analyze emotion:", error);
        Alert.alert(
          "Emotion Analysis Failed",
          "Could not analyze call emotion"
        );
      } finally {
        setIsEmotionAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error("Recording error:", error);
      Alert.alert("Recording Error", error.message);
    },
  });

  // ⭐ HANDLE RECORDING TOGGLE - Pass engine when calling
  const handleRecordingToggle = async () => {
    const engine = agoraEngineRef.current;
    
    if (!engine) {
      Alert.alert("Error", "Call not initialized yet");
      return;
    }

    try {
      if (recordingState.isRecording) {
        await stopRecording(engine);
      } else {
        await startRecording(engine);
      }
    } catch (error) {
      console.error("❌ Recording toggle failed:", error);
    }
  };

  // Request Permissions
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const cameraGranted =
          granted["android.permission.CAMERA"] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const audioGranted =
          granted["android.permission.RECORD_AUDIO"] ===
          PermissionsAndroid.RESULTS.GRANTED;

        if (!cameraGranted || !audioGranted) {
          Alert.alert(
            "Permissions Required",
            "Camera and microphone permissions are required for video calls"
          );
          return false;
        }

        return true;
      } catch (err) {
        console.error("❌ Permission error:", err);
        return false;
      }
    }
    return true;
  };

  // Show ending overlay with fade animation
  const showEndingScreen = (message: string) => {
    setEndingMessage(message);
    setShowEndingOverlay(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Cleanup and leave function with overlay
  const cleanupAndLeave = async (
    showMessage: boolean = false,
    message?: string
  ) => {
    if (isEndingRef.current) {
      console.log("🚫 Already ending call, skipping...");
      return;
    }

    isEndingRef.current = true;
    console.log("🔚 Cleaning up and leaving call...");

    try {
      const engine = agoraEngineRef.current;
      
      // ⭐ Stop recording if active
      if (recordingState.isRecording && engine) {
        await stopRecording(engine);
      }

      if (engine) {
        if (isScreenSharing) {
          await stopScreenShare();
        }
        await engine.leaveChannel();
      }

      if (socketRef.current) {
        socketRef.current.emit("leaveCallRoom", { callId });
        socketRef.current.disconnect();
      }
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }

    if (showMessage && message) {
      showEndingScreen(message);

      setTimeout(() => {
        router.back();
      }, 1500);
    } else {
      router.back();
    }
  };

  // ⭐ CRITICAL FIX: Setup remote video - DO NOT use setupRemoteVideo()
  // Just unmute the remote video stream and let RtcSurfaceView handle rendering
  const setupRemoteVideoStream = async (remoteUid: number) => {
    const engine = agoraEngineRef.current;
    
    if (!engine || callType !== "video") {
      return;
    }

    // Check if already setup
    if (remoteVideoSetupRef.current.has(remoteUid)) {
      console.log("⚠️ Remote video already setup for uid:", remoteUid);
      return;
    }

    try {
      console.log(`🔧 Setting up remote video for uid: ${remoteUid}`);

      // ⭐ KEY FIX: Only unmute the stream - DO NOT call setupRemoteVideo
      // The RtcSurfaceView component will handle the actual rendering
      engine.muteRemoteVideoStream(remoteUid, false);
      console.log("✅ Remote video stream unmuted for uid:", remoteUid);

      // Mark as setup
      remoteVideoSetupRef.current.add(remoteUid);

    } catch (error) {
      console.error("❌ Failed to setup remote video:", error);
    }
  };

  // Initialize Socket Connection
  useEffect(() => {
    if (!userId || !conversationId) return;

    console.log("📞 Initializing socket for call screen");

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    socket.on("connect", () => {
      console.log("📞 Socket connected in call screen:", socket.id);

      const personalRoom = `user:${userId}`;
      socket.emit("join", personalRoom);

      socket.emit("joinCallRoom", { callId, conversationId });
    });

    socket.on(
      "userJoinedCall",
      (data: {
        userId: string;
        userName: string;
        userAvatar?: string;
        uid: number;
      }) => {
        console.log("👤 User joined call:", data);
      }
    );

    socket.on("userLeftCall", (data: { userId: string; uid: number }) => {
      console.log("👤 User left call:", data);

      // Remove from setup tracking
      remoteVideoSetupRef.current.delete(data.uid);

      if (!isGroupCall && participants.length === 1) {
        console.log("🔚 Other participant left 1-1 call, ending...");
        cleanupAndLeave(true, "Call ended");
        return;
      }

      setParticipants((prev) => prev.filter((p) => p.uid !== data.uid));
      if (mainParticipant?.uid === data.uid) {
        setMainParticipant(null);
      }
    });

    socket.on(
      "participantMuteStatusChanged",
      (data: { uid: number; isMuted: boolean }) => {
        console.log("🎤 Participant mute status changed:", data);
        setParticipants((prev) =>
          prev.map((p) =>
            p.uid === data.uid ? { ...p, isMuted: data.isMuted } : p
          )
        );
      }
    );

    socket.on(
      "participantVideoStatusChanged",
      (data: { uid: number; isVideoOff: boolean }) => {
        console.log("📹 Participant video status changed:", data);
        setParticipants((prev) =>
          prev.map((p) =>
            p.uid === data.uid ? { ...p, isVideoOff: data.isVideoOff } : p
          )
        );
      }
    );

    socket.on(
      "screenShareStarted",
      (data: { userId: string; uid: number; userName: string }) => {
        console.log("🖥️ Screen share started by:", data.userName);

        setParticipants((prev) =>
          prev.map((p) =>
            p.uid === data.uid ? { ...p, isScreenSharing: true } : p
          )
        );

        const screenSharingParticipant = participants.find(
          (p) => p.uid === data.uid
        );
        if (screenSharingParticipant) {
          setMainParticipant({
            ...screenSharingParticipant,
            isScreenSharing: true,
          });
        }
      }
    );

    socket.on("screenShareStopped", (data: { userId: string; uid: number }) => {
      console.log("🖥️ Screen share stopped by:", data.userId);

      setParticipants((prev) =>
        prev.map((p) =>
          p.uid === data.uid ? { ...p, isScreenSharing: false } : p
        )
      );

      if (
        mainParticipant?.uid === data.uid &&
        mainParticipant?.isScreenSharing
      ) {
        setMainParticipant(null);
      }
    });

    socket.on("callEnded", (data: any) => {
      console.log("📞 Call ended event received:", data);

      const endedByMe = data.ended_by === userId;

      if (endedByMe) {
        console.log("✅ I ended the call, just leave");
        cleanupAndLeave(false);
      } else {
        console.log("🔚 Call ended by another participant");
        cleanupAndLeave(true, "Call ended");
      }
    });

    socket.on("callRejected", (data: any) => {
      console.log("📞 Call rejected event received:", data);

      if (data.rejection_type === "full") {
        const rejectedByMe = data.rejected_by === userId;

        if (rejectedByMe) {
          console.log("✅ I rejected the call");
          cleanupAndLeave(false);
        } else {
          console.log("🔚 Call rejected by another participant");
          cleanupAndLeave(true, "Call ended");
        }
      }
    });

    // ⭐ EMOTION ANALYSIS SOCKET LISTENERS
    socket.on("requestCallRecording", async (data: any) => {
      if (data.call_id === callId) {
        console.log("📨 Server requested call recording for emotion analysis");

        const engine = agoraEngineRef.current;
        if (!engine) {
          console.error("❌ Agora engine not available");
          return;
        }

        const recordingData = await stopRecording(engine);

        if (recordingData) {
          let videoFrameUri = recordingData.videoUri;
          
          // Try to capture video frame if in video call
          if (callType === "video") {
            videoFrameUri = await captureVideoFrame();
          }

          try {
            setIsEmotionAnalyzing(true);
            await uploadRecordings(
              recordingData.audioUri,
              videoFrameUri,
              recordingData.duration
            );
            await cleanupRecordings();
          } catch (error) {
            console.error("Failed to process recording:", error);
          } finally {
            setIsEmotionAnalyzing(false);
          }
        }
      }
    });

    socket.on("callEmotionAnalyzed", (data: any) => {
      if (data.call_id === callId) {
        console.log("🎭 Emotion analysis complete:", data.emotion);

        Alert.alert(
          "Emotion Analysis",
          `Your emotion during the call: ${data.emotion} (${(data.score * 100).toFixed(0)}% confidence)`,
          [{ text: "OK" }]
        );
      }
    });

    socketRef.current = socket;

    return () => {
      console.log("📞 Cleaning up socket in call screen");
      if (!isEndingRef.current) {
        socket.emit("leaveCallRoom", { callId });
        socket.disconnect();
      }
    };
  }, [userId, conversationId, callId, isGroupCall, participants.length]);

  // Fetch participant info from server
  const fetchParticipantInfo = async (uid: number) => {
    try {
      const token = await getToken();
      const response = await axios.get(
        `${API_URL}/api/calls/${callId}/participant/${uid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("❌ Error fetching participant info:", error);
      return null;
    }
  };

  // Initialize Agora Engine
  useEffect(() => {
    const init = async () => {
      try {
        const hasPermissions = await requestPermissions();
        if (!hasPermissions) {
          Alert.alert("Error", "Permissions not granted");
          router.back();
          return;
        }

        const authToken = await getToken();
        const response = await axios.post(
          `${API_URL}/api/agora/token`,
          {
            channelName,
            role: "publisher",
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        const { token, appId, uid } = response.data;
        setMyUid(uid);

        if (!appId) {
          throw new Error("Agora App ID not available");
        }

        console.log("🎥 Initializing Agora with appId:", appId);

        const engine = createAgoraRtcEngine();
        agoraEngineRef.current = engine;

        engine.initialize({
          appId: appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        engine.registerEventHandler({
          onJoinChannelSuccess: (connection, elapsed) => {
            console.log("✅ Join channel success:", connection.channelId);
            setJoined(true);

            // ⭐ START RECORDING - Pass engine reference
            startRecording(engine).catch((err) =>
              console.error("Failed to start recording:", err)
            );
          },
          onUserJoined: async (connection, remoteUid, elapsed) => {
            console.log("👤 Remote user joined:", remoteUid);

            const participantInfo = await fetchParticipantInfo(remoteUid);

            const newParticipant: Participant = {
              uid: remoteUid,
              userId: participantInfo?.userId || `user_${remoteUid}`,
              userName: participantInfo?.userName || `User ${remoteUid}`,
              userAvatar: participantInfo?.userAvatar,
              isMuted: false,
              isVideoOff: false, // ⭐ IMPORTANT: Default to false, will update via event handler
              isScreenSharing: false,
            };

            console.log("✅ New participant created:", newParticipant);

            setParticipants((prev) => {
              if (prev.find((p) => p.uid === remoteUid)) {
                console.log("⚠️ Participant already exists, skipping add");
                return prev;
              }
              console.log("➕ Adding participant to list");
              return [...prev, newParticipant];
            });

            // ⭐ Set as main participant if no one is selected
            setMainParticipant((currentMain) => {
              if (!currentMain) {
                console.log("🎯 Setting as MAIN participant (was null)");
                return newParticipant;
              }
              console.log("ℹ️ Main participant already set, keeping current");
              return currentMain;
            });

            // ⭐ FIXED: Setup remote video with improved function
            if (callType === "video") {
              // Add small delay to ensure user is fully joined
              setTimeout(() => {
                setupRemoteVideoStream(remoteUid);
              }, 500);
            }
          },
          onUserOffline: (connection, remoteUid, reason) => {
            console.log(
              "👤 Remote user offline:",
              remoteUid,
              "reason:",
              reason
            );

            // Clean up tracking
            remoteVideoSetupRef.current.delete(remoteUid);

            if (!isGroupCall) {
              console.log("🔚 Other participant went offline in 1-1 call");
              cleanupAndLeave(true, "Call ended");
              return;
            }

            setParticipants((prev) => prev.filter((p) => p.uid !== remoteUid));

            if (mainParticipant?.uid === remoteUid) {
              setMainParticipant(null);
            }
          },
          onRemoteVideoStateChanged: (
            connection,
            remoteUid,
            state,
            reason,
            elapsed
          ) => {
            console.log("📹 Remote video state changed:", {
              remoteUid,
              state,
              reason,
              elapsed,
            });

            // ⭐ FIXED: Handle video state changes properly
            // state: 0=Stopped, 1=Starting, 2=Decoding, 3=Frozen, 4=Failed
            if (state === 2) {
              // Decoding = video is playing
              console.log("✅ Remote video is now decoding for uid:", remoteUid);
              
              // If not setup yet, try to setup
              if (!remoteVideoSetupRef.current.has(remoteUid) && callType === "video") {
                setupRemoteVideoStream(remoteUid);
              }
            } else if (state === 0) {
              // Stopped
              console.log("⚠️ Remote video stopped for uid:", remoteUid);
            } else if (state === 4) {
              // Failed - try to re-setup
              console.log("❌ Remote video failed for uid:", remoteUid);
              remoteVideoSetupRef.current.delete(remoteUid);
              setTimeout(() => {
                setupRemoteVideoStream(remoteUid);
              }, 1000);
            }

            // ⭐ CRITICAL FIX: Only set isVideoOff if truly stopped, not during starting/decoding
            const isVideoOff = state === 0;
            
            console.log(`📹 Setting isVideoOff=${isVideoOff} for uid:${remoteUid}, state:${state}`);
            
            setParticipants((prev) =>
              prev.map((p) =>
                p.uid === remoteUid ? { ...p, isVideoOff } : p
              )
            );

            setMainParticipant((prev) => {
              if (prev?.uid === remoteUid) {
                console.log(`📹 Updating mainParticipant isVideoOff=${isVideoOff}`);
                return { ...prev, isVideoOff };
              }
              return prev;
            });
          },
          onRemoteAudioStateChanged: (
            connection,
            remoteUid,
            state,
            reason,
            elapsed
          ) => {
            console.log("🎤 Remote audio state changed:", {
              remoteUid,
              state,
              reason,
            });

            const isMuted = state === 0 || state === 4;
            
            setParticipants((prev) =>
              prev.map((p) =>
                p.uid === remoteUid ? { ...p, isMuted } : p
              )
            );

            setMainParticipant((prev) => {
              if (prev?.uid === remoteUid) {
                return { ...prev, isMuted };
              }
              return prev;
            });
          },
          // ⭐ FIXED: Monitor video subscription state
          onVideoSubscribeStateChanged: (
            channelId,
            uid,
            oldState,
            newState,
            elapseSinceLastState
          ) => {
            console.log("📹 Video subscribe state changed:", {
              uid,
              oldState,
              newState,
              elapsed: elapseSinceLastState,
            });
            
            if (newState === 3) {
              // Successfully subscribed
              console.log("✅ Successfully subscribed to remote video:", uid);
            } else if (newState === 1) {
              // Not subscribed
              console.log("⚠️ Not subscribed to remote video:", uid);
              // Try to setup if not already
              if (!remoteVideoSetupRef.current.has(uid) && callType === "video") {
                setTimeout(() => {
                  setupRemoteVideoStream(uid);
                }, 500);
              }
            } else if (newState === 2) {
              // Subscribing
              console.log("🔄 Subscribing to remote video:", uid);
            }
          },
          // ⭐ Monitor remote video stats
          onRemoteVideoStats: (connection, stats) => {
            if (stats.receivedBitrate > 0) {
              console.log("📊 Remote video stats:", {
                uid: stats.uid,
                receivedBitrate: stats.receivedBitrate,
                decoderOutputFrameRate: stats.decoderOutputFrameRate,
                rendererOutputFrameRate: stats.rendererOutputFrameRate,
                width: stats.width,
                height: stats.height,
              });
            }
          },
          // ⭐ FIXED: Add first remote video decoded callback
          onFirstRemoteVideoDecoded: (connection, remoteUid, width, height, elapsed) => {
            console.log("🎬 First remote video frame decoded:", {
              remoteUid,
              width,
              height,
              elapsed,
            });
          },
        });

        // ⭐ FIXED: Set video encoder configuration for better quality
        if (callType === "video") {
          await engine.setVideoEncoderConfiguration({
            dimensions: {
              width: 640,
              height: 480,
            },
            frameRate: 15,
            bitrate: 800,
          });
        }

        await engine.enableAudio();

        if (callType === "video") {
          await engine.enableVideo();
          await engine.startPreview();
        }

        await engine.setChannelProfile(
          ChannelProfileType.ChannelProfileCommunication
        );
        await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        await engine.setEnableSpeakerphone(true);
        await engine.setAudioProfile(1, 1);

        // ⭐ FIXED: Join with proper media options
        await engine.joinChannel(token, channelName, uid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: callType === "video",
          autoSubscribeAudio: true,
          autoSubscribeVideo: true, // Always auto-subscribe
        });

        // ⭐ FIXED: Update channel media options explicitly
        if (callType === "video") {
          await engine.updateChannelMediaOptions({
            publishCameraTrack: true,
            publishMicrophoneTrack: true,
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
          });
        }

        console.log("✅ Agora engine initialized and joined channel");
      } catch (error: any) {
        console.error("❌ Error initializing Agora:", error);
        Alert.alert(
          "Error",
          "Failed to initialize call: " + (error.message || "Unknown error")
        );
        router.back();
      }
    };

    init();

    return () => {
      if (!isEndingRef.current) {
        const engine = agoraEngineRef.current;
        if (engine) {
          if (isScreenSharing) {
            stopScreenShare();
          }
          engine.leaveChannel();
          engine.release();
        }
      }
      // Clear tracking
      remoteVideoSetupRef.current.clear();
    };
  }, [channelName, callType]);

  // Call duration timer
  useEffect(() => {
    if (!joined) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [joined]);

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return;

    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [showControls]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start Screen Share
  const startScreenShare = async () => {
    try {
      const engine = agoraEngineRef.current;
      if (!engine) return;

      await engine.startScreenCapture({
        captureAudio: false,
        captureVideo: true,
      });

      await engine.updateChannelMediaOptions({
        publishCameraTrack: false,
        publishScreenTrack: true,
        publishScreenCaptureAudio: false,
        publishScreenCaptureVideo: true,
      });

      setIsScreenSharing(true);

      if (socketRef.current && userId) {
        socketRef.current.emit("startScreenShare", {
          callId,
          conversationId,
          userId,
          uid: myUid,
          userName: "You",
        });
      }
    } catch (error) {
      console.error("❌ Error starting screen share:", error);
      Alert.alert("Error", "Failed to start screen sharing");
    }
  };

  // Stop Screen Share
  const stopScreenShare = async () => {
    try {
      const engine = agoraEngineRef.current;
      if (!engine) return;

      await engine.stopScreenCapture();

      await engine.updateChannelMediaOptions({
        publishCameraTrack: true,
        publishScreenTrack: false,
        publishScreenCaptureAudio: false,
        publishScreenCaptureVideo: false,
      });

      setIsScreenSharing(false);

      if (socketRef.current && userId) {
        socketRef.current.emit("stopScreenShare", {
          callId,
          conversationId,
          userId,
          uid: myUid,
        });
      }
    } catch (error) {
      console.error("❌ Error stopping screen share:", error);
    }
  };

  // Toggle Mute
  const toggleMute = async () => {
    try {
      const engine = agoraEngineRef.current;
      if (!engine) return;

      await engine.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);

      if (socketRef.current) {
        socketRef.current.emit("toggleMute", {
          callId,
          conversationId,
          uid: myUid,
          isMuted: !isMuted,
        });
      }
    } catch (error) {
      console.error("❌ Error toggling mute:", error);
    }
  };

  // Toggle Video
  const toggleVideo = async () => {
    try {
      const engine = agoraEngineRef.current;
      if (!engine) return;

      await engine.muteLocalVideoStream(!isVideoOff);
      setIsVideoOff(!isVideoOff);

      if (socketRef.current) {
        socketRef.current.emit("toggleVideo", {
          callId,
          conversationId,
          uid: myUid,
          isVideoOff: !isVideoOff,
        });
      }
    } catch (error) {
      console.error("❌ Error toggling video:", error);
    }
  };

  // Toggle Speaker
  const toggleSpeaker = async () => {
    try {
      const engine = agoraEngineRef.current;
      if (!engine) return;

      await engine.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
    } catch (error) {
      console.error("❌ Error toggling speaker:", error);
    }
  };

  // End Call
  const endCall = async () => {
    try {
      const authToken = await getToken();
      await axios.post(
        `${API_URL}/api/calls/${callId}/end`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      cleanupAndLeave(false);
    } catch (error) {
      console.error("❌ Error ending call:", error);
      cleanupAndLeave(false);
    }
  };

  // Render participant thumbnail
  const renderParticipantThumbnail = ({
    item,
  }: {
    item: Participant;
  }) => {
    const isSelected = mainParticipant?.uid === item.uid;

    return (
      <TouchableOpacity
        style={[
          styles.thumbnailContainer,
          isSelected && styles.thumbnailSelected,
        ]}
        onPress={() => {
          console.log("👆 Selected participant:", item);
          setMainParticipant(item);
        }}
      >
        {callType === "audio" || item.isVideoOff ? (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="person" size={40} color="#9ca3af" />
          </View>
        ) : (
          <RtcSurfaceView
            style={styles.thumbnail}
            canvas={{
              uid: item.uid,
              sourceType: item.isScreenSharing
                ? VideoSourceType.VideoSourceScreen
                : VideoSourceType.VideoSourceRemote,
              renderMode: RenderModeType.RenderModeHidden,
            }}
            zOrderMediaOverlay={false}
          />
        )}

        {item.isMuted && (
          <View style={styles.mutedBadge}>
            <Ionicons name="mic-off" size={12} color="#fff" />
          </View>
        )}

        {item.isScreenSharing && (
          <View style={styles.screenSharingBadge}>
            <Ionicons name="desktop" size={12} color="#fff" />
          </View>
        )}

        <View style={styles.thumbnailOverlay}>
          <Text style={styles.thumbnailName} numberOfLines={1}>
            {item.userName}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      >
        {/* Main video area */}
        {mainParticipant ? (
          <View style={styles.mainVideoContainer}>
            {/* ⭐ DEBUG INFO - Remove this in production */}
            {__DEV__ && (
              <View style={{
                position: 'absolute',
                top: 100,
                left: 10,
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: 10,
                borderRadius: 8,
                zIndex: 999,
              }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>
                  Main UID: {mainParticipant.uid}
                </Text>
                <Text style={{ color: '#fff', fontSize: 10 }}>
                  isVideoOff: {mainParticipant.isVideoOff ? 'TRUE ❌' : 'FALSE ✅'}
                </Text>
                <Text style={{ color: '#fff', fontSize: 10 }}>
                  isScreenSharing: {mainParticipant.isScreenSharing ? 'YES' : 'NO'}
                </Text>
                <Text style={{ color: '#fff', fontSize: 10 }}>
                  Name: {mainParticipant.userName}
                </Text>
              </View>
            )}
            
            {callType === "audio" || mainParticipant.isVideoOff ? (
              <View style={styles.audioModeContainer}>
                <Ionicons name="person" size={80} color="#9ca3af" />
                <Text style={styles.audioStatusText}>
                  {mainParticipant.userName}
                </Text>
                <Text style={[styles.audioStatusText, { fontSize: 14, marginTop: 8 }]}>
                  {mainParticipant.isVideoOff ? "Video is off" : "Audio only"}
                </Text>
              </View>
            ) : (
              <>
                {console.log('🎬 Rendering main RtcSurfaceView:', {
                  uid: mainParticipant.uid,
                  sourceType: mainParticipant.isScreenSharing ? 'Screen' : 'Remote',
                  isVideoOff: mainParticipant.isVideoOff,
                })}
                <RtcSurfaceView
                  style={styles.mainVideo}
                  canvas={{
                    uid: mainParticipant.uid,
                    sourceType: mainParticipant.isScreenSharing
                      ? VideoSourceType.VideoSourceScreen
                      : VideoSourceType.VideoSourceRemote,
                    renderMode: RenderModeType.RenderModeFit,
                    mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
                  }}
                  zOrderMediaOverlay={false}
                />
              </>
            )}
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Ionicons name="videocam" size={64} color="#666" />
            <Text style={styles.waitingText}>
              {participants.length === 0
                ? "Waiting for others to join..."
                : "Select a participant to view"}
            </Text>
          </View>
        )}

        {/* Local video preview - REMOVED, now shown in thumbnails */}

        {/* Audio-only mode */}
        {callType === "audio" && (
          <View style={styles.audioModeContainer}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={100} color="#9ca3af" />
            </View>
            <Text style={styles.audioStatusText}>Audio Call</Text>
          </View>
        )}

        {/* Participants thumbnails - Show all EXCEPT mainParticipant */}
        {participants.length > 0 && (
          <View style={styles.thumbnailsWrapper}>
            <FlatList
              data={[
                // Add local user as first thumbnail (if not in audio-only and video is on)
                ...(callType === "video" && !isVideoOff ? [{
                  uid: myUid,
                  userId: userId || '',
                  userName: 'You',
                  isMuted: isMuted,
                  isVideoOff: isVideoOff,
                  isScreenSharing: isScreenSharing,
                  isLocal: true,
                }] : []),
                // Add other participants except mainParticipant
                ...participants.filter(p => p.uid !== mainParticipant?.uid)
              ]}
              renderItem={({ item }) => {
                const isSelected = mainParticipant?.uid === item.uid;
                const isLocal = (item as any).isLocal;

                return (
                  <TouchableOpacity
                    style={[
                      styles.thumbnailContainer,
                      isSelected && styles.thumbnailSelected,
                    ]}
                    onPress={() => {
                      if (!isLocal) {
                        console.log("👆 Selected participant:", item);
                        setMainParticipant(item);
                      }
                    }}
                  >
                    {callType === "audio" || item.isVideoOff ? (
                      <View style={styles.thumbnailPlaceholder}>
                        <Ionicons name="person" size={40} color="#9ca3af" />
                      </View>
                    ) : (
                      <RtcSurfaceView
                        style={styles.thumbnail}
                        canvas={{
                          uid: isLocal ? 0 : item.uid,
                          sourceType: isLocal 
                            ? VideoSourceType.VideoSourceCamera
                            : (item.isScreenSharing
                              ? VideoSourceType.VideoSourceScreen
                              : VideoSourceType.VideoSourceRemote),
                          renderMode: RenderModeType.RenderModeHidden,
                          mirrorMode: isLocal ? VideoMirrorModeType.VideoMirrorModeEnabled : VideoMirrorModeType.VideoMirrorModeDisabled,
                        }}
                        zOrderMediaOverlay={isLocal}
                      />
                    )}

                    {item.isMuted && (
                      <View style={styles.mutedBadge}>
                        <Ionicons name="mic-off" size={12} color="#fff" />
                      </View>
                    )}

                    {item.isScreenSharing && (
                      <View style={styles.screenSharingBadge}>
                        <Ionicons name="desktop" size={12} color="#fff" />
                      </View>
                    )}

                    <View style={styles.thumbnailOverlay}>
                      <Text style={styles.thumbnailName} numberOfLines={1}>
                        {item.userName}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => `${item.uid}-${(item as any).isLocal ? 'local' : 'remote'}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailsContainer}
            />
          </View>
        )}

        {/* ⭐ RECORDING INDICATOR */}
        {recordingState.isRecording && (
          <View style={[styles.recordingIndicator, { top: Platform.OS === "ios" ? 60 : 70 }]}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              REC {formatDuration(recordingState.recordingDuration)}
            </Text>
          </View>
        )}

        {/* ⭐ EMOTION ANALYZING INDICATOR */}
        {isEmotionAnalyzing && (
          <View style={[styles.analyzingIndicator, { top: Platform.OS === "ios" ? 60 : 70 }]}>
            <Text style={styles.analyzingText}>🎭 Analyzing emotion...</Text>
          </View>
        )}

        {/* Top bar */}
        {showControls && (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.participantsButton}
              onPress={() => setShowParticipantsList(true)}
            >
              <Ionicons name="people" size={20} color="#fff" />
              <Text style={styles.participantsCount}>
                {participants.length + 1}
              </Text>
            </TouchableOpacity>

            <View style={styles.callInfo}>
              {isScreenSharing && (
                <View style={styles.sharingIndicator}>
                  <Ionicons name="desktop" size={16} color="#10b981" />
                  <Text style={styles.sharingText}>Sharing</Text>
                </View>
              )}
              {!isScreenSharing && (
                <>
                  <Text style={styles.durationText}>
                    {formatDuration(callDuration)}
                  </Text>
                  <Text style={styles.statusText}>
                    {joined ? "Connected" : "Connecting..."}
                  </Text>
                </>
              )}
            </View>

            <View style={{ width: 80 }} />
          </View>
        )}

        {/* Bottom controls */}
        {showControls && (
          <View style={styles.controlsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.controlsContainer}
            >
              {/* Mute button */}
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  isMuted && styles.controlButtonActive,
                ]}
                onPress={toggleMute}
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {/* Video button */}
              {callType === "video" && (
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    isVideoOff && styles.controlButtonActive,
                  ]}
                  onPress={toggleVideo}
                >
                  <Ionicons
                    name={isVideoOff ? "videocam-off" : "videocam"}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}

              {/* Speaker button */}
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  !isSpeakerOn && styles.controlButtonActive,
                ]}
                onPress={toggleSpeaker}
              >
                <Ionicons
                  name={isSpeakerOn ? "volume-high" : "volume-mute"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {/* ⭐ RECORDING BUTTON */}
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  recordingState.isRecording && styles.controlButtonActive,
                ]}
                onPress={handleRecordingToggle}
                disabled={isEmotionAnalyzing}
              >
                <Ionicons
                  name={recordingState.isRecording ? "stop-circle" : "radio-button-on"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {/* Screen share button (video only) */}
              {callType === "video" && Platform.OS === "android" && (
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    isScreenSharing && styles.controlButtonActive,
                  ]}
                  onPress={isScreenSharing ? stopScreenShare : startScreenShare}
                >
                  <Ionicons
                    name={isScreenSharing ? "desktop" : "desktop-outline"}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}

              {/* End call button */}
              <TouchableOpacity
                style={[styles.controlButton, styles.endCallButton]}
                onPress={endCall}
              >
                <Ionicons name="call" size={24} color="#fff" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </TouchableOpacity>

      {/* Participants List Modal */}
      <Modal
        visible={showParticipantsList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParticipantsList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Participants ({participants.length + 1})
              </Text>
              <TouchableOpacity onPress={() => setShowParticipantsList(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.participantsList}>
              {/* Current user */}
              <View style={styles.participantItem}>
                <Ionicons
                  name="person-circle"
                  size={40}
                  color="#f97316"
                  style={styles.participantAvatar}
                />
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>You</Text>
                  <Text style={styles.participantStatus}>
                    {isMuted ? "Muted" : "Active"} •{" "}
                    {isVideoOff ? "Video Off" : "Video On"}
                  </Text>
                </View>
              </View>

              {/* Other participants */}
              {participants.map((participant) => (
                <View key={participant.uid} style={styles.participantItem}>
                  <Ionicons
                    name="person-circle"
                    size={40}
                    color="#9ca3af"
                    style={styles.participantAvatar}
                  />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {participant.userName}
                    </Text>
                    <Text style={styles.participantStatus}>
                      {participant.isMuted ? "Muted" : "Active"} •{" "}
                      {participant.isVideoOff ? "Video Off" : "Video On"}
                      {participant.isScreenSharing && " • Sharing Screen"}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Call Ending Overlay */}
      {showEndingOverlay && (
        <Animated.View style={[styles.endingOverlay, { opacity: fadeAnim }]}>
          <View style={styles.endingContent}>
            <Ionicons name="call-outline" size={64} color="#666" />
            <Text style={styles.endingText}>{endingMessage}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  mainVideoContainer: {
    flex: 1,
  },
  mainVideo: {
    flex: 1,
  },
  audioModeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  avatarPlaceholder: {
    marginBottom: 30,
  },
  audioStatusText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  waitingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  waitingText: {
    color: "#666",
    fontSize: 16,
    marginTop: 20,
  },
  thumbnailsWrapper: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    height: 140,
  },
  thumbnailsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  thumbnailContainer: {
    width: 100,
    height: 130,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailSelected: {
    borderColor: "#f97316",
    borderWidth: 3,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 6,
  },
  thumbnailName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  mutedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    padding: 4,
  },
  screenSharingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 4,
  },
  localVideoContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.12,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#f97316",
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  localVideoLabel: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 2,
    borderRadius: 4,
  },
  screenSharePreview: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  screenSharePreviewText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 10 : 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  participantsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  participantsCount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  callInfo: {
    alignItems: "center",
    flex: 1,
  },
  durationText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  statusText: {
    color: "#999",
    fontSize: 14,
    marginTop: 4,
  },
  sharingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sharingText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
  },
  controlsWrapper: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 20 : 30,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 8,
    minWidth: SCREEN_WIDTH,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: "#f97316",
  },
  endCallButton: {
    backgroundColor: "#ef4444",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#1f1f1f",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  participantsList: {
    padding: 16,
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    marginBottom: 8,
  },
  participantAvatar: {
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  participantStatus: {
    color: "#999",
    fontSize: 14,
    marginTop: 2,
  },
  endingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  endingContent: {
    alignItems: "center",
    gap: 20,
  },
  endingText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  // ⭐ RECORDING & EMOTION ANALYSIS STYLES
  recordingIndicator: {
    position: "absolute",
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 100,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF0000",
    marginRight: 6,
  },
  recordingText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  analyzingIndicator: {
    position: "absolute",
    left: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 100,
  },
  analyzingText: {
    color: "#FFF",
    fontSize: 12,
  },
});