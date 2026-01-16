// hooks/message/useSocket.tsx - DEBOUNCED FIX
import { useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

interface OnlineUser {
  userId: string;
  socketId: string;
  profile: {
    _id: string;
    username: string;
    full_name: string;
    avatar?: string;
    email?: string;
  };
  lastActive: number;
  last_seen?: Date;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  isUserOnline: (userId: string) => boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

const ENABLE_DEBUG_LOGS = false; // ✅ TẮT LOG CHO PRODUCTION

export const useSocket = (): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const { user } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasAddedUserRef = useRef(false);
  const addUserTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const listenersRegistered = useRef(false);

  // ✅ FIX: Debounce state updates
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!user) return;

    const connectSocket = () => {
      const newSocket = io(
        process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:3000",
        {
          transports: ["websocket"],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        }
      );

      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on("connect", () => {
        if (ENABLE_DEBUG_LOGS) {
          console.log("✅ Socket connected:", newSocket.id);
        }
        setIsConnected(true);

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        if (addUserTimeoutRef.current) {
          clearTimeout(addUserTimeoutRef.current);
        }

        addUserTimeoutRef.current = setTimeout(() => {
          if (!hasAddedUserRef.current || newSocket.id !== socketRef.current?.id) {
            newSocket.emit("addNewUsers", {
              _id: user.id,
              username: user.username || user.fullName,
              full_name: user.fullName,
              avatar: user.imageUrl,
              email: user.primaryEmailAddress?.emailAddress,
            });

            const userRoom = `user:${user.id}`;
            newSocket.emit("joinRoom", userRoom);
            hasAddedUserRef.current = true;
          }
        }, 300);
      });

      newSocket.on("disconnect", (reason) => {
        if (ENABLE_DEBUG_LOGS) {
          console.log("❌ Socket disconnected:", reason);
        }
        setIsConnected(false);
        hasAddedUserRef.current = false;

        if (reason === "io server disconnect") {
          reconnectTimeoutRef.current = setTimeout(() => {
            newSocket.connect();
          }, 2000);
        }
      });

      if (!listenersRegistered.current) {
        let lastGetUsersTime = 0;

        // ✅ FIX: Throttle getUsers
        newSocket.on("getUsers", (users: OnlineUser[]) => {
          const now = Date.now();
          if (now - lastGetUsersTime < 1000) { // ✅ Minimum 1s between updates
            return;
          }
          lastGetUsersTime = now;

          const usersWithDates = users.map((user) => ({
            ...user,
            last_seen: user.last_seen ? new Date(user.last_seen) : undefined,
          }));

          setOnlineUsers(usersWithDates);
        });

        // ✅ FIX: Debounced batch updates
        const processPendingUpdates = () => {
          if (pendingUpdatesRef.current.size === 0) return;

          setOnlineUsers((prev) => {
            let updated = [...prev];

            pendingUpdatesRef.current.forEach((data, userId) => {
              const index = updated.findIndex((u) => u.userId === userId);
              
              if (index !== -1) {
                // Update existing user
                updated[index] = {
                  ...updated[index],
                  lastActive: new Date(data.last_seen).getTime(),
                  last_seen: new Date(data.last_seen),
                };

                // Remove if offline
                if (!data.is_online) {
                  updated = updated.filter((u) => u.userId !== userId);
                }
              }
            });

            return updated;
          });

          pendingUpdatesRef.current.clear();
        };

        // ✅ FIX: Batch userLastSeenUpdated events
        newSocket.on(
          "userLastSeenUpdated",
          (data: {
            user_id: string;
            last_seen: string | Date;
            is_online: boolean;
          }) => {
            // ✅ Accumulate updates
            pendingUpdatesRef.current.set(data.user_id, data);

            // ✅ Debounce processing
            if (updateDebounceRef.current) {
              clearTimeout(updateDebounceRef.current);
            }

            updateDebounceRef.current = setTimeout(() => {
              processPendingUpdates();
            }, 500); // ✅ Process batch every 500ms
          }
        );

        // ✅ Friend events - NO LOGS unless debug
        const friendEvents = [
          "friendRequestReceived",
          "friendRequestSent", 
          "friendRequestAccepted",
          "friendRequestDeclined",
          "friendRequestCancelled",
          "friendRemoved",
          "friendBlocked",
          "friendCountUpdated",
          "friendRequestCountUpdated",
          "friendStatusChanged",
        ];

        friendEvents.forEach((event) => {
          newSocket.on(event, (data) => {
            if (ENABLE_DEBUG_LOGS) {
              console.log(`🔔 [Socket] ${event}:`, data);
            }
          });
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket error:", error.message);
          setIsConnected(false);
        });

        newSocket.on("reconnect", (attemptNumber) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("Reconnected after", attemptNumber, "attempts");
          }
          setIsConnected(true);
          hasAddedUserRef.current = false;

          const userRoom = `user:${user.id}`;
          newSocket.emit("joinRoom", userRoom);
        });

        listenersRegistered.current = true;
      }

      // ✅ Send activity every 60s
      activityIntervalRef.current = setInterval(() => {
        if (newSocket.connected && user) {
          newSocket.emit("userActivity", {
            user_id: user.id,
          });
        }
      }, 60000);

      // ✅ Heartbeat every 30s
      const heartbeatInterval = setInterval(() => {
        if (newSocket.connected && user) {
          newSocket.emit("updateUserStatus", {
            user_id: user.id,
            status: "online",
          });
        }
      }, 30000);

      return { socket: newSocket, heartbeatInterval };
    };

    const { socket: socketInstance, heartbeatInterval } = connectSocket();

    return () => {
      if (addUserTimeoutRef.current) {
        clearTimeout(addUserTimeoutRef.current);
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }

      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }

      clearInterval(heartbeatInterval);

      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance.removeAllListeners();
      }

      pendingUpdatesRef.current.clear();
      hasAddedUserRef.current = false;
      socketRef.current = null;
      listenersRegistered.current = false;
    };
  }, [user?.id]);

  const emit = useCallback(
    (event: string, data: any) => {
      if (socket && isConnected) {
        socket.emit(event, data);
      }
    },
    [socket, isConnected]
  );

  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socket) {
        socket.on(event, callback);
      }
    },
    [socket]
  );

  const off = useCallback(
    (event: string, callback?: (...args: any[]) => void) => {
      if (socket) {
        socket.off(event, callback);
      }
    },
    [socket]
  );

  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return onlineUsers.some((u) => u.userId === userId);
    },
    [onlineUsers]
  );

  return {
    socket,
    isConnected,
    onlineUsers,
    isUserOnline,
    emit,
    on,
    off,
  };
};

export const formatLastSeen = (lastSeen: Date | string | number): string => {
  const now = Date.now();
  const time = new Date(lastSeen).getTime();
  const diffMs = now - time;

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 5) return "A few minutes ago";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(time).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
};

export const getLastSeen = (
  userId: string,
  onlineUsers: OnlineUser[]
): Date | null => {
  const user = onlineUsers.find((u) => u.userId === userId);
  return user?.last_seen || null;
};