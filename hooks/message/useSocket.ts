// hooks/useSocket.ts - OPTIMIZED VERSION
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

// ✅ LOG CONFIG - Có thể bật/tắt log
const ENABLE_DEBUG_LOGS = true; // Set false để tắt hầu hết logs

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

  // ✅ Prevent duplicate listeners
  const listenersRegistered = useRef(false);

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
        console.log("✅ Socket connected:", newSocket.id);
        setIsConnected(true);

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        if (addUserTimeoutRef.current) {
          clearTimeout(addUserTimeoutRef.current);
        }

        addUserTimeoutRef.current = setTimeout(() => {
          if (
            !hasAddedUserRef.current ||
            newSocket.id !== socketRef.current?.id
          ) {
            if (ENABLE_DEBUG_LOGS) {
              console.log("👤 Adding user to online list...");
            }

            newSocket.emit("addNewUsers", {
              _id: user.id,
              username: user.username || user.fullName,
              full_name: user.fullName,
              avatar: user.imageUrl,
              email: user.primaryEmailAddress?.emailAddress,
            });

            const userRoom = `user:${user.id}`;
            newSocket.emit("joinRoom", userRoom);

            if (ENABLE_DEBUG_LOGS) {
              console.log("🚪 Joined personal room:", userRoom);
            }

            hasAddedUserRef.current = true;
          }
        }, 300);
      });

      newSocket.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);
        setIsConnected(false);
        hasAddedUserRef.current = false;

        if (reason === "io server disconnect") {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Attempting to reconnect...");
            newSocket.connect();
          }, 2000);
        }
      });

      // ✅ Chỉ register listeners 1 lần
      if (!listenersRegistered.current) {
        let lastUpdateTime = 0;

        newSocket.on("getUsers", (users: OnlineUser[]) => {
          const now = Date.now();
          if (now - lastUpdateTime < 500) {
            return;
          }
          lastUpdateTime = now;

          console.log("👥 Online users updated:", users.length);

          // // ✅ LOG FULL STRUCTURE của user đầu tiên
          // if (users.length > 0) {
          //   console.log(
          //     "📊 Sample user structure:",
          //     JSON.stringify(users[0], null, 2)
          //   );
          // }

          // ✅ CONVERT last_seen từ string sang Date
          const usersWithDates = users.map((user) => ({
            ...user,
            last_seen: user.last_seen ? new Date(user.last_seen) : undefined,
          }));

          setOnlineUsers(usersWithDates);
        });

        // ✅ Last seen updates - SILENT (không log)
        newSocket.on(
          "userLastSeenUpdated",
          (data: {
            user_id: string;
            last_seen: string | Date;
            is_online: boolean;
          }) => {
            // ✅ THÊM LOG ĐỂ DEBUG
            console.log("🕒 [Socket] userLastSeenUpdated received:", {
              user_id: data.user_id,
              last_seen: data.last_seen,
              is_online: data.is_online,
            });

            setOnlineUsers((prev) => {
              console.log("📋 Current onlineUsers count:", prev.length);

              const updated = prev.map((u) => {
                if (u.userId === data.user_id) {
                  console.log(
                    `✏️ Updating user ${data.user_id} last_seen:`,
                    data.last_seen
                  );
                  return {
                    ...u,
                    lastActive: new Date(data.last_seen).getTime(),
                    last_seen: new Date(data.last_seen),
                  };
                }
                return u;
              });

              // ✅ Nếu user offline, remove khỏi list
              if (!data.is_online) {
                console.log(
                  `🚫 User ${data.user_id} is offline, removing from list`
                );
                return updated.filter((u) => u.userId !== data.user_id);
              }

              console.log("📋 Online users after update:", updated.length);
              return updated;
            });
          }
        );

        // ✅ Friend events - chỉ log khi debug
        newSocket.on("friendRequestReceived", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("📬 [Socket] friendRequestReceived:", data);
          }
        });

        newSocket.on("friendRequestSent", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("📤 [Socket] friendRequestSent:", data);
          }
        });

        newSocket.on("friendRequestAccepted", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("✅ [Socket] friendRequestAccepted:", data);
          }
        });

        newSocket.on("friendRequestDeclined", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("❌ [Socket] friendRequestDeclined:", data);
          }
        });

        newSocket.on("friendRequestCancelled", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("🚫 [Socket] friendRequestCancelled:", data);
          }
        });

        newSocket.on("friendRemoved", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("👋 [Socket] friendRemoved:", data);
          }
        });

        newSocket.on("friendBlocked", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("🚫 [Socket] friendBlocked:", data);
          }
        });

        newSocket.on("friendCountUpdated", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("🔢 [Socket] friendCountUpdated:", data);
          }
        });

        newSocket.on("friendRequestCountUpdated", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("🔢 [Socket] friendRequestCountUpdated:", data);
          }
        });

        newSocket.on("friendStatusChanged", (data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("👤 [Socket] friendStatusChanged:", data);
          }
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          setIsConnected(false);
        });

        newSocket.on("reconnect", (attemptNumber) => {
          console.log("Socket reconnected after", attemptNumber, "attempts");
          setIsConnected(true);
          hasAddedUserRef.current = false;

          const userRoom = `user:${user.id}`;
          newSocket.emit("joinRoom", userRoom);

          if (ENABLE_DEBUG_LOGS) {
            console.log(
              "🚪 Re-joined personal room after reconnect:",
              userRoom
            );
          }
        });

        newSocket.on("reconnect_error", (error) => {
          console.error("Socket reconnection error:", error);
        });

        listenersRegistered.current = true;
      }

      // ✅ Send activity mỗi 60s
      activityIntervalRef.current = setInterval(() => {
        if (newSocket.connected && user) {
          newSocket.emit("userActivity", {
            user_id: user.id,
          });
        }
      }, 60000); // Every 60 seconds

      // ✅ Heartbeat mỗi 30s
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
      if (ENABLE_DEBUG_LOGS) {
        console.log("🧹 Cleaning up socket connection...");
      }

      if (addUserTimeoutRef.current) {
        clearTimeout(addUserTimeoutRef.current);
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }

      clearInterval(heartbeatInterval);

      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance.removeAllListeners();
      }

      hasAddedUserRef.current = false;
      socketRef.current = null;
      listenersRegistered.current = false;
    };
  }, [user?.id]);

  const emit = useCallback(
    (event: string, data: any) => {
      if (socket && isConnected) {
        socket.emit(event, data);
      } else {
        console.warn(`Cannot emit ${event}: socket not connected`);
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

// ✅ Helper function để format last seen
export const formatLastSeen = (lastSeen: Date | string | number): string => {
  const now = Date.now();
  const time = new Date(lastSeen).getTime();
  const diffMs = now - time;

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 5) return "Vài phút trước";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return new Date(time).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "short",
  });
};

// ✅ Helper function để get last seen từ onlineUsers
export const getLastSeen = (
  userId: string,
  onlineUsers: OnlineUser[]
): Date | null => {
  const user = onlineUsers.find((u) => u.userId === userId);
  return user?.last_seen || null;
};
