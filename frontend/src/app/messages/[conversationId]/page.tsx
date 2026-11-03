"use client";

import {
  Suspense,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import styles from "./chat.module.css";

type Message = {
  id: string;
  conversationId?: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type HistoryResponse = {
  success: boolean;
  messages: Message[];
  pagination?: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

type SendResponse = {
  success: boolean;
  message: Message;
};

type ReadResponse = {
  success: boolean;
  conversationId: string;
  readAt: string;
  count: number;
  messageIds: string[];
};

type ReadReceiptEvent = {
  conversationId: string;
  messageIds: string[];
  readAt: string;
};

type ConversationResponse = {
  success: boolean;
  count: number;
  conversations: {
    id: string;
    user: {
      id: string;
      displayName: string;
      primaryPhoto: { url: string; contentType: string } | null;
    };
  }[];
};

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChatPageContent() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [otherUserName, setOtherUserName] = useState("Conversation");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const markReadInFlightRef = useRef(false);
  const markReadAgainRef = useRef(false);
  const pendingReadReceiptsRef = useRef<ReadReceiptEvent[]>([]);

  const flushPendingReadReceipts = useCallback(() => {
    const socket = getSocket();

    if (!socket.connected || pendingReadReceiptsRef.current.length === 0) {
      return;
    }

    const pending = [...pendingReadReceiptsRef.current];
    pendingReadReceiptsRef.current = [];

    for (const receipt of pending) {
      socket.emit("message:read", receipt);
    }
  }, [pendingReadReceiptsRef]);

  const markConversationRead = useCallback(async () => {
    if (!currentUserIdRef.current) {
      return;
    }

    if (markReadInFlightRef.current) {
      markReadAgainRef.current = true;
      return;
    }

    markReadInFlightRef.current = true;

    try {
      do {
        markReadAgainRef.current = false;

        const response = await apiRequest<ReadResponse>(
          `/conversations/${conversationId}/read`,
          {
            method: "PATCH",
          }
        );

        if (response.messageIds?.length > 0 && response.readAt) {
          const messageIdSet = new Set(response.messageIds);

          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              messageIdSet.has(message.id)
                ? { ...message, readAt: response.readAt }
                : message
            )
          );

          pendingReadReceiptsRef.current.push({
            conversationId,
            messageIds: response.messageIds,
            readAt: response.readAt,
          });

          flushPendingReadReceipts();
        }
      } while (markReadAgainRef.current);
    } catch (err) {
      console.error("Unable to mark conversation as read.", err);
    } finally {
      markReadInFlightRef.current = false;
    }
  }, [conversationId, flushPendingReadReceipts]);

  const addMessage = useCallback((message: Message) => {
    setMessages((current) => {
      const existingIndex = current.findIndex((item) => item.id === message.id);

      if (existingIndex !== -1) {
        return current.map((item) =>
          item.id === message.id ? { ...item, ...message } : item
        );
      }

      return [...current, message].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  const loadChat = useCallback(async () => {
    try {
      setError("");

      const [history, conversations, auth] = await Promise.all([
        apiRequest<HistoryResponse>(
          `/conversations/${conversationId}/messages?limit=50`
        ),
        apiRequest<ConversationResponse>("/conversations"),
        apiRequest<{ success: boolean; user: { id: string } }>("/auth/me"),
      ]);

      const activeConversation = conversations.conversations.find(
        (item) => item.id === conversationId
      );

      if (!activeConversation) {
        setError("This conversation is unavailable.");
        return;
      }

      currentUserIdRef.current = auth.user.id;
      setCurrentUserId(auth.user.id);
      setOtherUserName(activeConversation.user.displayName);
      setMessages(history.messages ?? []);

      // Mark incoming messages from this conversation as read.
      await markConversationRead();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load this conversation."
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId, markConversationRead]);

  useEffect(() => {
    const load = async () => {
      await loadChat();
    };
    load();
  }, [loadChat]);

  useEffect(() => {
    if (!conversationId) return;

    const socket = getSocket();

    const joinConversation = () => {
      setSocketConnected(true);
      socket.emit("conversation:join", { conversationId });
      flushPendingReadReceipts();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleNewMessage = (message: Message) => {
      if (
        message?.conversationId === conversationId ||
        !message?.conversationId
      ) {
        addMessage(message);

        // A message arriving while this conversation is open is read
        // automatically, provided it was sent by the other participant.
        if (
          currentUserIdRef.current &&
          message.senderId !== currentUserIdRef.current
        ) {
          void markConversationRead();
        }
      }
    };

    const handleReadReceipt = (receipt: ReadReceiptEvent) => {
      if (
        receipt?.conversationId !== conversationId ||
        !Array.isArray(receipt.messageIds)
      ) {
        return;
      }

      const messageIdSet = new Set(receipt.messageIds);

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          messageIdSet.has(message.id)
            ? { ...message, readAt: receipt.readAt }
            : message
        )
      );
    };

    const handleConnectError = () => {
      setSocketConnected(false);
    };

    socket.on("connect", joinConversation);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("message:new", handleNewMessage);
    socket.on("message:read", handleReadReceipt);

    socket.connect();

    if (socket.connected) {
      joinConversation();
    }

    return () => {
      socket.off("connect", joinConversation);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("message:new", handleNewMessage);
      socket.off("message:read", handleReadReceipt);
      socket.emit("conversation:leave", { conversationId });
      socket.disconnect();
    };
  }, [
    conversationId,
    addMessage,
    markConversationRead,
    flushPendingReadReceipts,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();

    if (!body || sending || body.length > 2000) return;

    setSending(true);
    setError("");

    try {
      const response = await apiRequest<SendResponse>(
        `/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        }
      );

      addMessage(response.message);
      setDraft("");

      // The server retrieves and validates this saved message before broadcasting it.
      const socket = getSocket();

      if (socket.connected) {
        socket.emit("message:publish", {
          messageId: response.message.id,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send your message."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <main className={styles.status}>Loading conversation...</main>;
  }

  if (error && messages.length === 0) {
    return (
      <main className={styles.status}>
        <p>{error}</p>
        <Link href="/messages">Back to messages</Link>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/messages" className={styles.backLink}>
          ← Messages
        </Link>

        <div className={styles.person}>
          <h1>{otherUserName}</h1>
          <span className={socketConnected ? styles.online : styles.offline}>
            {socketConnected ? "Live connection" : "Reconnecting..."}
          </span>
        </div>
      </header>

      <section className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <p>You matched! Say hello and start the conversation.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === currentUserId;

            return (
              <div
                key={message.id}
                className={`${styles.messageRow} ${
                  isMine ? styles.mine : styles.theirs
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    isMine ? styles.myBubble : styles.theirBubble
                  }`}
                >
                  <p>{message.body}</p>

                  <div className={styles.messageMeta}>
                    <time>{formatTime(message.createdAt)}</time>

                    {isMine && message.readAt && (
                      <span className={styles.readReceipt}>Read</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.composer} onSubmit={handleSend}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message..."
          maxLength={2000}
          rows={2}
          aria-label="Message"
        />

        <button
          type="submit"
          disabled={!draft.trim() || sending || draft.trim().length > 2000}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={<main className={styles.status}>Loading conversation...</main>}
    >
      <ChatPageContent />
    </Suspense>
  );
}
