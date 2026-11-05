import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { prisma } from "../config/database.js";
import {
  getSessionCookieName,
  getUserIdFromSessionToken,
} from "../services/sessionService.js";

const conversationIdSchema = z.string().min(1).max(30);
const messageIdSchema = z.string().min(1).max(30);

type Acknowledgement = (result: { success: boolean; message: string }) => void;

type AuthenticatedSocket = Socket & {
  data: {
    userId: string;
  };
};

function getCookieValue(
  cookieHeader: string | undefined,
  cookieName: string
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name === cookieName) {
      return cookie.slice(separatorIndex + 1).trim();
    }
  }

  return undefined;
}

async function canAccessConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      match: {
        select: {
          userOneId: true,
          userTwoId: true,
        },
      },
    },
  });

  if (!conversation) {
    return false;
  }

  const { userOneId, userTwoId } = conversation.match;

  if (userId !== userOneId && userId !== userTwoId) {
    return false;
  }

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userOneId, blockedUserId: userTwoId },
        { blockerId: userTwoId, blockedUserId: userOneId },
      ],
    },
    select: { id: true },
  });

  return !block;
}

export function createSocketServer(
  httpServer: HttpServer,
  frontendUrl: string
): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Authenticate every socket using the existing database session.
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const rawToken = getCookieValue(cookieHeader, getSessionCookieName());

      const userId = await getUserIdFromSessionToken(rawToken);

      if (!userId) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    const userId = authenticatedSocket.data.userId;

    // Every authenticated connection joins its own private user room.
    void socket.join(`user:${userId}`);

    console.log("Authenticated Socket.IO client connected.");

    socket.on(
      "conversation:join",
      async (payload: unknown, acknowledge?: Acknowledgement) => {
        try {
          const parsed = z
            .object({ conversationId: conversationIdSchema })
            .safeParse(payload);

          if (!parsed.success) {
            acknowledge?.({
              success: false,
              message: "Invalid conversation ID.",
            });
            return;
          }

          const { conversationId } = parsed.data;

          // The socket belongs to its private user room as well.
          if (socket.rooms.size >= 12) {
            acknowledge?.({
              success: false,
              message: "Too many active conversation rooms.",
            });
            return;
          }

          const allowed = await canAccessConversation(conversationId, userId);

          if (!allowed) {
            acknowledge?.({
              success: false,
              message: "Conversation not found or unavailable.",
            });
            return;
          }

          await socket.join(`conversation:${conversationId}`);

          acknowledge?.({
            success: true,
              message: "Joined conversation.",
            });
        } catch {
          acknowledge?.({
            success: false,
            message: "Unable to join this conversation.",
          });
        }
      }
    );

    socket.on(
      "conversation:leave",
      (payload: unknown, acknowledge?: Acknowledgement) => {
        const parsed = z
          .object({ conversationId: conversationIdSchema })
          .safeParse(payload);

        if (!parsed.success) {
          acknowledge?.({
            success: false,
            message: "Invalid conversation ID.",
          });
          return;
        }

        void socket.leave(`conversation:${parsed.data.conversationId}`);

        acknowledge?.({
          success: true,
          message: "Left conversation.",
        });
      }
    );

    // The client can publish only the ID of a message already saved by REST.
    // The server fetches and verifies the database record before broadcasting.
    socket.on(
      "message:publish",
      async (payload: unknown, acknowledge?: Acknowledgement) => {
        try {
          const parsed = z
            .object({ messageId: messageIdSchema })
            .safeParse(payload);

          if (!parsed.success) {
            acknowledge?.({
              success: false,
              message: "Invalid message ID.",
            });
            return;
          }

          const message = await prisma.message.findUnique({
            where: { id: parsed.data.messageId },
            select: {
              id: true,
              conversationId: true,
              senderId: true,
              body: true,
              readAt: true,
              createdAt: true,
              conversation: {
                select: {
                  match: {
                    select: {
                      userOneId: true,
                      userTwoId: true,
                    },
                  },
                },
              },
            },
          });

          if (!message || message.senderId !== userId) {
            acknowledge?.({
              success: false,
              message: "Message not found or unavailable.",
            });
            return;
          }

          const allowed = await canAccessConversation(
            message.conversationId,
            userId
          );

          if (!allowed) {
            acknowledge?.({
              success: false,
              message: "Conversation not found or unavailable.",
            });
            return;
          }

          const conversationRoom = `conversation:${message.conversationId}`;

          if (!socket.rooms.has(conversationRoom)) {
            acknowledge?.({
              success: false,
              message: "Join the conversation before publishing.",
            });
            return;
          }

          const messagePayload = {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            body: message.body,
            readAt: message.readAt,
            createdAt: message.createdAt,
          };

          // Keep the existing open-chat broadcast.
          io.to(conversationRoom).emit("message:new", messagePayload);

          // Also notify both participants' private rooms.
          // This updates inboxes even when neither user has this chat open.
          io.to(`user:${message.conversation.match.userOneId}`).emit(
            "message:new",
            messagePayload
          );
          io.to(`user:${message.conversation.match.userTwoId}`).emit(
            "message:new",
            messagePayload
          );

          acknowledge?.({
            success: true,
            message: "Message delivered.",
          });
        } catch {
          acknowledge?.({
            success: false,
            message: "Unable to publish this message.",
          });
        }
      }
    );

    // Broadcast read receipts only for messages already marked read in the DB.
    socket.on(
      "message:read",
      async (payload: unknown, acknowledge?: Acknowledgement) => {
        try {
          const parsed = z
            .object({
              conversationId: conversationIdSchema,
              messageIds: z
                .array(messageIdSchema)
                .min(1)
                .max(100)
                .refine(
                  (ids) => new Set(ids).size === ids.length,
                  "Duplicate message IDs are not allowed."
                ),
            })
            .safeParse(payload);

          if (!parsed.success) {
            acknowledge?.({
              success: false,
              message: "Invalid read receipt request.",
            });
            return;
          }

          const { conversationId, messageIds } = parsed.data;

          const allowed = await canAccessConversation(conversationId, userId);

          if (!allowed) {
            acknowledge?.({
              success: false,
              message: "Conversation not found or unavailable.",
            });
            return;
          }

          const messages = await prisma.message.findMany({
            where: {
              id: { in: messageIds },
              conversationId,
              senderId: { not: userId },
              readAt: { not: null },
            },
            select: {
              id: true,
              senderId: true,
              readAt: true,
            },
          });

          if (messages.length === 0) {
            acknowledge?.({
              success: true,
              message: "No verified read receipts to publish.",
            });
            return;
          }

          // Group by original sender and read timestamp.
          // The recipient cannot claim that their own messages were read.
          const receiptGroups = new Map<
            string,
            { senderId: string; readAt: Date; messageIds: string[] }
          >();

          for (const message of messages) {
            if (!message.readAt) {
              continue;
            }

            const timestamp = message.readAt.toISOString();
            const key = `${message.senderId}:${timestamp}`;

            const existing = receiptGroups.get(key);

            if (existing) {
              existing.messageIds.push(message.id);
            } else {
              receiptGroups.set(key, {
                senderId: message.senderId,
                readAt: message.readAt,
                messageIds: [message.id],
              });
            }
          }

          for (const group of receiptGroups.values()) {
            const receiptPayload = {
              conversationId,
              messageIds: group.messageIds,
              readAt: group.readAt,
            };

            // Notify the original sender so their chat can show "Read".
            io.to(`user:${group.senderId}`).emit(
              "message:read",
              receiptPayload
            );

            // Notify the reader's other sessions so their inbox can update.
            io.to(`user:${userId}`).emit("message:read", receiptPayload);
          }

          acknowledge?.({
            success: true,
            message: "Read receipts delivered.",
          });
        } catch {
          acknowledge?.({
            success: false,
            message: "Unable to publish read receipts.",
          });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("Socket.IO client disconnected.");
    });
  });

  return io;
}