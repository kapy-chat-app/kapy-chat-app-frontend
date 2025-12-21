// hooks/useNotifications.ts
import { useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocket } from "./useSocket";

export interface NotificationSender {
  _id: string;
  clerkId: string;
  full_name: string;
  username: string;
  avatar?: {
    url: string;
    name: string;
    type: string;
  };
}

export interface Notification {
  _id: string;
  recipient: string;
  sender?: NotificationSender;
  type: "message" | "friend_request" | "call" | "group" | "system";
  title: string;
  content: string;
  data?: any;
  is_read: boolean;
  is_delivered: boolean;
  delivery_method: "in_app" | "push" | "email";
  read_at?: Date;
  delivered_at?: Date;
  created_at: Date;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  hasMore: boolean;
  refreshNotifications: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const { socket, on, off } = useSocket();
  const { user } = useUser();
  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );
  const fetchNotifications = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/api/notifications?page=${pageNum}&limit=20`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch notifications");
        }

        const newNotifications = result.data.notifications || [];
        const pagination = result.data.pagination;

        if (append) {
          setNotifications((prev) => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }

        setHasMore(pagination?.hasNext || false);

        // Update unread count
        const unread = newNotifications.filter(
          (notification: Notification) => !notification.is_read
        );
        if (!append) {
          setUnreadCount(unread.length);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch notifications";
        setError(errorMessage);
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const markAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      try {
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/api/notifications/${notificationId}/read`,
          {
            method: "PUT",
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setNotifications((prev) =>
            prev.map((notification) =>
              notification._id === notificationId
                ? { ...notification, is_read: true, read_at: new Date() }
                : notification
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to mark notification as read";
        setError(errorMessage);
        console.error("Error marking notification as read:", err);
      }
    },
    []
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/notifications/read-al`, {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            is_read: true,
            read_at: new Date(),
          }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read";
      setError(errorMessage);
      console.error("Error marking all notifications as read:", err);
    }
  }, []);

  const deleteNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      try {
        setError(null);

        const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setNotifications((prev) => {
            const notification = prev.find((n) => n._id === notificationId);
            const filtered = prev.filter((n) => n._id !== notificationId);

            if (notification && !notification.is_read) {
              setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
            }

            return filtered;
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete notification";
        setError(errorMessage);
        console.error("Error deleting notification:", err);
      }
    },
    []
  );

  const loadMoreNotifications = useCallback(async (): Promise<void> => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    await fetchNotifications(nextPage, true);
  }, [hasMore, loading, page, fetchNotifications]);

  const refreshNotifications = useCallback(async (): Promise<void> => {
    setPage(1);
    setHasMore(true);
    await fetchNotifications(1, false);
  }, [fetchNotifications]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    const handleNotificationRead = (data: any) => {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === data.notificationId
            ? { ...notification, is_read: true, read_at: new Date(data.readAt) }
            : notification
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleNotificationDeleted = (data: any) => {
      setNotifications((prev) => {
        const notification = prev.find((n) => n._id === data.notificationId);
        const filtered = prev.filter((n) => n._id !== data.notificationId);

        if (notification && !notification.is_read) {
          setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
        }

        return filtered;
      });
    };

    on("newNotification", handleNewNotification);
    on("notificationRead", handleNotificationRead);
    on("notificationDeleted", handleNotificationDeleted);

    return () => {
      off("newNotification", handleNewNotification);
      off("notificationRead", handleNotificationRead);
      off("notificationDeleted", handleNotificationDeleted);
    };
  }, [socket, user, on, off]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications: () => fetchNotifications(1, false),
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMoreNotifications,
    hasMore,
    refreshNotifications,
  };
};
