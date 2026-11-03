"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { disconnectSocket, getSocket } from "@/lib/socket";

type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

type CurrentUserResponse = {
  success: boolean;
  user: AuthUser;
};

type LogoutResponse = {
  success: boolean;
  message: string;
};

type Conversation = {
  id: string;
  unreadCount: number;
};

type ConversationsResponse = {
  success: boolean;
  count: number;
  conversations: Conversation[];
};

type IncomingMessageEvent = {
  id: string;
  conversationId: string;
  senderId: string;
};

type ReadReceiptEvent = {
  conversationId: string;
  messageIds: string[];
  readAt: string;
};

export default function AuthNavigation() {
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    let socketCleanup: (() => void) | undefined;

    async function initializeNavigation() {
      try {
        const response = await apiRequest<CurrentUserResponse>("/auth/me");

        if (!active) return;

        setUser(response.user);

        const loadUnreadCount = async () => {
          try {
            const conversationsResponse =
              await apiRequest<ConversationsResponse>("/conversations");

            if (!active) return;

            const total = (conversationsResponse.conversations ?? []).reduce(
              (sum, conversation) => sum + (conversation.unreadCount ?? 0),
              0
            );

            setUnreadCount(total);
          } catch {
            // Keep the navigation available if unread counts cannot load.
          }
        };

        await loadUnreadCount();

        if (!active) return;

        const socket = getSocket();
        const processedMessageIds = new Set<string>();

        const handleNewMessage = (message: IncomingMessageEvent) => {
          if (
            !message?.id ||
            !message.senderId ||
            message.senderId === response.user.id ||
            processedMessageIds.has(message.id)
          ) {
            return;
          }

          processedMessageIds.add(message.id);

          if (processedMessageIds.size > 300) {
            const oldestId = processedMessageIds.values().next().value;

            if (oldestId) {
              processedMessageIds.delete(oldestId);
            }
          }

          setUnreadCount((current) => current + 1);
        };

        const handleReadReceipt = (receipt: ReadReceiptEvent) => {
          if (receipt?.conversationId) {
            void loadUnreadCount();
          }
        };

        const handleReconnect = () => {
          void loadUnreadCount();
        };

        socket.on("message:new", handleNewMessage);
        socket.on("message:read", handleReadReceipt);
        socket.on("connect", handleReconnect);

        if (!socket.connected) {
          socket.connect();
        }

        socketCleanup = () => {
          socket.off("message:new", handleNewMessage);
          socket.off("message:read", handleReadReceipt);
          socket.off("connect", handleReconnect);
        };
      } catch {
        if (active) {
          setUser(null);
          setUnreadCount(0);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initializeNavigation();

    return () => {
      active = false;
      socketCleanup?.();
    };
  }, []);

  async function handleLogout() {
    setError("");
    setLoggingOut(true);

    try {
      await apiRequest<LogoutResponse>("/auth/logout", {
        method: "POST",
      });

      disconnectSocket();
      setUnreadCount(0);
      setUser(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function navigationClass(href: string): string {
    return isActive(href) ? "login-link nav-link-active" : "login-link";
  }

  if (loading) {
    return <div className="nav-actions" aria-label="Loading account" />;
  }

  if (!user) {
    return (
      <div className="nav-actions">
        <Link href="/login" className="login-link">
          Log in
        </Link>

        <Link href="/register" className="button button-small">
          Join LetsDate <span aria-hidden="true">↗</span>
        </Link>

        {error && (
          <span className="auth-nav-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="nav-actions">
      <Link
        href="/discovery"
        className={navigationClass("/discovery")}
        aria-current={isActive("/discovery") ? "page" : undefined}
      >
        Discover
      </Link>

      <Link
        href="/matches"
        className={navigationClass("/matches")}
        aria-current={isActive("/matches") ? "page" : undefined}
      >
        Matches
      </Link>

      <Link
        href="/messages"
        className={`${navigationClass("/messages")} messages-nav-link`}
        aria-current={isActive("/messages") ? "page" : undefined}
      >
        Messages
        {unreadCount > 0 && (
          <span
            className="nav-unread-badge"
            aria-label={`${unreadCount} unread messages`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      <Link
        href="/profile"
        className={navigationClass("/profile")}
        aria-current={isActive("/profile") ? "page" : undefined}
      >
        My Profile
      </Link>

      <button
        type="button"
        className="button button-small"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Logging out..." : "Log out"}
      </button>

      {error && (
        <span className="auth-nav-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
