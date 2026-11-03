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
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;

      callback(null, origin === frontendUrl);
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

    console.log("Authenticated Socket.IO client connected.");

    // Join only after the server verifies conversation membership.
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

          if (socket.rooms.size >= 11) {
            acknowledge?.({
              success: false,
              message: "Too many active conversation rooms.",
            });
            return;
          }

          const allowed = await canAccessConversation(
            conversationId,
            authenticatedSocket.data.userId
          );

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
              createdAt: true,
            },
          });

          if (
            !message ||
            message.senderId !== authenticatedSocket.data.userId
          ) {
            acknowledge?.({
              success: false,
              message: "Message not found or unavailable.",
            });
            return;
          }

          const allowed = await canAccessConversation(
            message.conversationId,
            authenticatedSocket.data.userId
          );

          if (!allowed) {
            acknowledge?.({
              success: false,
              message: "Conversation not found or unavailable.",
            });
            return;
          }

          const room = `conversation:${message.conversationId}`;

          if (!socket.rooms.has(room)) {
            acknowledge?.({
              success: false,
              message: "Join the conversation before publishing.",
            });
            return;
          }

          io.to(room).emit("message:new", message);

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

    socket.on("disconnect", () => {
      console.log("Socket.IO client disconnected.");
    });
  });

  return io;
}
