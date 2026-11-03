"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import styles from "./messages.module.css";

type Message = {
  id: string;
  conversationId: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt?: string | null;
};

type ReadReceiptEvent = {
  conversationId: string;
  messageIds: string[];
  readAt: string;
};

type Conversation = {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  user: {
    id: string;
    displayName: string;
    primaryPhoto: {
      url: string;
      contentType: string;
    } | null;
  };
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  } | null;
};

type ConversationsResponse = {
  success: boolean;
  count: number;
  conversations: Conversation[];
};

type AuthResponse = {
  success?: boolean;
  user?: {
    id: string;
  };
};

function formatMessageTime(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function sortConversations(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.lastMessageAt ?? a.createdAt).getTime();
    const bTime = new Date(b.lastMessageAt ?? b.createdAt).getTime();

    return bTime - aTime;
  });
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUserIdRef = useRef<string | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  const loadConversations = useCallback(async () => {
    try {
      setError("");

      const [conversationResponse, authResponse] = await Promise.all([
        apiRequest<ConversationsResponse>("/conversations"),
        apiRequest<AuthResponse>("/auth/me"),
      ]);

      const userId = authResponse.user?.id ?? null;
      currentUserIdRef.current = userId;

      const loadedConversations = (
        conversationResponse.conversations ?? []
      ).map((conversation) => ({
        ...conversation,
        unreadCount: conversation.unreadCount ?? 0,
      }));

      setConversations(sortConversations(loadedConversations));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your conversations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      await loadConversations();
    };

    fetchConversations();

    const socket = getSocket();

    const handleNewMessage = (message: Message) => {
      if (
        !message ||
        !message.id ||
        !message.conversationId ||
        !message.senderId
      ) {
        return;
      }

      // Prevent the same message being counted more than once.
      if (processedMessageIdsRef.current.has(message.id)) {
        return;
      }

      processedMessageIdsRef.current.add(message.id);

      // Keep the deduplication set from growing indefinitely.
      if (processedMessageIdsRef.current.size > 300) {
        const oldestId = processedMessageIdsRef.current.values().next().value;

        if (oldestId) {
          processedMessageIdsRef.current.delete(oldestId);
        }
      }

      setConversations((previousConversations) => {
        const conversationExists = previousConversations.some(
          (conversation) => conversation.id === message.conversationId
        );

        if (!conversationExists) {
          return previousConversations;
        }

        const currentUserId = currentUserIdRef.current;

        const updatedConversations = previousConversations.map(
          (conversation) => {
            if (conversation.id !== message.conversationId) {
              return conversation;
            }

            const isIncomingMessage =
              currentUserId !== null && message.senderId !== currentUserId;

            return {
              ...conversation,
              lastMessageAt: message.createdAt,
              lastMessage: {
                id: message.id,
                body: message.body,
                senderId: message.senderId,
                createdAt: message.createdAt,
              },
              unreadCount:
                conversation.unreadCount + (isIncomingMessage ? 1 : 0),
            };
          }
        );

        return sortConversations(updatedConversations);
      });
    };

    const handleReadReceipt = (receipt: ReadReceiptEvent) => {
      if (!receipt?.conversationId) {
        return;
      }

      // Reconcile the unread count with the database.
      // This works for both the reader and the original sender.
      void loadConversations();
    };

    const handleReconnect = () => {
      void loadConversations();
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:read", handleReadReceipt);
    socket.on("connect", handleReconnect);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:read", handleReadReceipt);
      socket.off("connect", handleReconnect);
    };
  }, [loadConversations]);

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Messages</h1>
          <p>Your conversations with your matches.</p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/" className={styles.backLink}>
            Home
          </Link>

          <Link href="/matches" className={styles.backLink}>
            View matches
          </Link>
        </div>
      </div>

      {loading && <p className={styles.status}>Loading conversations...</p>}

      {!loading && error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => void loadConversations()}>Try again</button>
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className={styles.empty}>
          <h2>No conversations yet</h2>
          <p>
            When you match with someone, your conversation will appear here.
          </p>
          <Link href="/discovery" className={styles.discoverLink}>
            Discover people
          </Link>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <div className={styles.list}>
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/messages/${conversation.id}`}
              className={styles.conversation}
            >
              <div className={styles.avatar}>
                {conversation.user.primaryPhoto?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={conversation.user.primaryPhoto.url}
                    alt={conversation.user.displayName}
                  />
                ) : (
                  <span>
                    {conversation.user.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className={styles.details}>
                <div className={styles.nameRow}>
                  <h2>{conversation.user.displayName}</h2>

                  <time>
                    {formatMessageTime(
                      conversation.lastMessage?.createdAt ??
                        conversation.lastMessageAt
                    )}
                  </time>
                </div>

                <div className={styles.previewRow}>
                  <p>
                    {conversation.lastMessage?.body ??
                      "You matched! Start a conversation."}
                  </p>

                  {conversation.unreadCount > 0 && (
                    <span className={styles.unreadBadge}>
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
