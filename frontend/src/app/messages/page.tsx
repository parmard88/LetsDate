"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import styles from "./messages.module.css";

type Conversation = {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
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

function formatMessageTime(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      setError("");

      const response = await apiRequest<ConversationsResponse>(
        "/conversations"
      );

      setConversations(response.conversations ?? []);
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
      try {
        setError("");
        const response = await apiRequest<ConversationsResponse>(
          "/conversations"
        );
        setConversations(response.conversations ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your conversations."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchConversations().catch((err) => {
      console.error("Failed to load conversations:", err);
    });
  }, []);

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Messages</h1>
          <p>Your conversations with your matches.</p>
        </div>

        <Link href="/matches" className={styles.backLink}>
          View matches
        </Link>
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

                <p>
                  {conversation.lastMessage?.body ??
                    "You matched! Start a conversation."}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
