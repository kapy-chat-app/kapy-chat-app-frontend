// components/page/call/PiPCallOverlay.tsx
// 🎬 Picture-in-Picture floating call window (like Messenger)
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from "react-native";
import { RtcSurfaceView, VideoSourceType, RenderModeType } from "react-native-agora";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PIP_WIDTH = 120;
const PIP_HEIGHT = 160;

interface PiPCallOverlayProps {
  visible: boolean;
  localUid: number;
  remoteUid?: number;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  onExpand: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export default function PiPCallOverlay({
  visible,
  localUid,
  remoteUid,
  isMuted,
  isVideoOff,
  callDuration,
  onExpand,
  onEndCall,
  onToggleMute,
  onToggleVideo,
}: PiPCallOverlayProps) {
  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - PIP_WIDTH - 16,
      y: 100,
    })
  ).current;

  const [showControls, setShowControls] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        setShowControls(true);
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        // Snap to edges
        let finalX = (pan.x as any)._value;
        let finalY = (pan.y as any)._value;

        // Snap to left or right edge
        if (finalX < SCREEN_WIDTH / 2) {
          finalX = 16;
        } else {
          finalX = SCREEN_WIDTH - PIP_WIDTH - 16;
        }

        // Keep within screen bounds
        finalY = Math.max(
          60,
          Math.min(finalY, SCREEN_HEIGHT - PIP_HEIGHT - 100)
        );

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
        }).start();

        // Hide controls after 2s
        setTimeout(() => setShowControls(false), 2000);
      },
    })
  ).current;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Main video */}
      <View style={styles.videoContainer}>
        {remoteUid && !isVideoOff ? (
          <RtcSurfaceView
            style={styles.video}
            canvas={{
              uid: remoteUid,
              sourceType: VideoSourceType.VideoSourceRemote,
              renderMode: RenderModeType.RenderModeFit,
            }}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
        )}

        {/* Local preview (small) */}
        {!isVideoOff && (
          <View style={styles.localPreview}>
            <RtcSurfaceView
              style={styles.localVideo}
              canvas={{
                uid: 0,
                sourceType: VideoSourceType.VideoSourceCamera,
                renderMode: RenderModeType.RenderModeFit,
              }}
            />
          </View>
        )}

        {/* Duration */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
        </View>

        {/* Expand button */}
        <TouchableOpacity style={styles.expandButton} onPress={onExpand}>
          <Ionicons name="expand" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Controls overlay */}
      {showControls && (
        <View style={styles.controlsOverlay}>
          <TouchableOpacity
            style={[styles.miniButton, isMuted && styles.miniButtonActive]}
            onPress={onToggleMute}
          >
            <Ionicons
              name={isMuted ? "mic-off" : "mic"}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.miniButton, isVideoOff && styles.miniButtonActive]}
            onPress={onToggleVideo}
          >
            <Ionicons
              name={isVideoOff ? "videocam-off" : "videocam"}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.miniButton, styles.endCallButton]}
            onPress={onEndCall}
          >
            <Ionicons name="call" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    zIndex: 9999,
    elevation: 10,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#f97316",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  video: {
    flex: 1,
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  localPreview: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 40,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#fff",
  },
  localVideo: {
    flex: 1,
  },
  durationBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  expandButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 6,
    borderRadius: 12,
  },
  controlsOverlay: {
    position: "absolute",
    bottom: -40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  miniButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  miniButtonActive: {
    backgroundColor: "#f97316",
  },
  endCallButton: {
    backgroundColor: "#ef4444",
  },
});