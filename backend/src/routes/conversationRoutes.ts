
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireSession } from "../middleware/requireSession.js";
import { getPhotoUrl } from "../services/photoStorageService.js";

const router = Router();

router.use(requireSession);

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().min(1).max(30).optional(),
});

async function getAccessibleConversation(
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      match: {
        select: {
          userOneId: true,
          userTwoId: true,
        },
      },
    },
  });

  if (!conversation) {
    return { conversation: null, status: 404 as const };
  }

  const { userOneId, userTwoId } = conversation.match;

  if (userId !== userOneId && userId !== userTwoId) {
    return { conversation: null, status: 404 as const };
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

  if (block) {
    return { conversation: null, status: 404 as const };
  }

  return { conversation, status: 200 as const };
}

// GET /api/conversations
// Creates a conversation automatically for each existing, unblocked match.
router.get("/", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;

  try {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedUserId: userId }],
      },
      select: {
        blockerId: true,
        blockedUserId: true,
      },
    });

    const blockedUserIds = blocks.map((block) =>
      block.blockerId === userId ? block.blockedUserId : block.blockerId
    );

    const matches = await prisma.match.findMany({
      where: {
        AND: [
          {
            OR: [{ userOneId: userId }, { userTwoId: userId }],
          },
          {
            NOT: {
              OR: [
                { userOneId: { in: blockedUserIds } },
                { userTwoId: { in: blockedUserIds } },
              ],
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (matches.length === 0) {
      res.status(200).json({
        success: true,
        count: 0,
        conversations: [],
      });
      return;
    }

    await Promise.all(
      matches.map((match) =>
        prisma.conversation.upsert({
          where: { matchId: match.id },
          create: { matchId: match.id },
          update: {},
        })
      )
    );

    const conversations = await prisma.conversation.findMany({
      where: {
        matchId: { in: matches.map((match) => match.id) },
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        createdAt: true,
        lastMessageAt: true,
        match: {
          select: {
            userOneId: true,
            userTwoId: true,
            userOne: {
              select: {
                id: true,
                displayName: true,
                photos: {
                  where: { isPrimary: true },
                  take: 1,
                  select: {
                    storageKey: true,
                    contentType: true,
                  },
                },
              },
            },
            userTwo: {
              select: {
                id: true,
                displayName: true,
                photos: {
                  where: { isPrimary: true },
                  take: 1,
                  select: {
                    storageKey: true,
                    contentType: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
    });

    // Count unread incoming messages across all conversations in one query.
    const conversationIds = conversations.map(
      (conversation) => conversation.id
    );

    const unreadGroups = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        readAt: null,
      },
      _count: {
        _all: true,
      },
    });

    const unreadCounts = new Map(
      unreadGroups.map((group) => [
        group.conversationId,
        group._count._all,
      ])
    );

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const otherUser =
          conversation.match.userOneId === userId
            ? conversation.match.userTwo
            : conversation.match.userOne;

        const photo = otherUser.photos[0];
        const photoUrl = photo ? await getPhotoUrl(photo.storageKey) : null;

        return {
          id: conversation.id,
          createdAt: conversation.createdAt,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: unreadCounts.get(conversation.id) ?? 0,
          user: {
            id: otherUser.id,
            displayName: otherUser.displayName,
            primaryPhoto: photo
              ? {
                  url: photoUrl,
                  contentType: photo.contentType,
                }
              : null,
          },
          lastMessage: conversation.messages[0] ?? null,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: results.length,
      conversations: results,
    });
  } catch {
    console.error("Conversation list retrieval failed.");

    res.status(500).json({
      success: false,
      message: "Unable to load conversations right now.",
    });
  }
});

// PATCH /api/conversations/:conversationId/read
// Marks incoming unread messages as read for the authenticated user.
router.patch(
  "/:conversationId/read",
  async (
    req: Request<{ conversationId: string }>,
    res: Response
  ): Promise<void> => {
    const userId = res.locals.userId as string;
    const conversationId = req.params.conversationId;

    if (!conversationId || conversationId.length > 30) {
      res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
      return;
    }

    try {
      const access = await getAccessibleConversation(conversationId, userId);

      if (!access.conversation) {
        res.status(access.status).json({
          success: false,
          message: "Conversation not found or unavailable.",
        });
        return;
      }

      const readAt = new Date();

      const result = await prisma.$transaction(async (transaction) => {
        const unreadMessages = await transaction.message.findMany({
          where: {
            conversationId,
            senderId: { not: userId },
            readAt: null,
          },
          select: {
            id: true,
          },
        });

        if (unreadMessages.length === 0) {
          return {
            count: 0,
            messageIds: [] as string[],
          };
        }

        const messageIds = unreadMessages.map((message) => message.id);

        const updated = await transaction.message.updateMany({
          where: {
            id: { in: messageIds },
            conversationId,
            senderId: { not: userId },
            readAt: null,
          },
          data: {
            readAt,
          },
        });

        return {
          count: updated.count,
          messageIds:
            updated.count === messageIds.length ? messageIds : [],
        };
      });

      res.status(200).json({
        success: true,
        conversationId,
        readAt: result.count > 0 ? readAt : null,
        count: result.count,
        messageIds: result.messageIds,
      });
    } catch {
      console.error("Marking conversation messages as read failed.");

      res.status(500).json({
        success: false,
        message: "Unable to mark messages as read right now.",
      });
    }
  }
);

// GET /api/conversations/:conversationId/messages
router.get(
  "/:conversationId/messages",
  async (
    req: Request<{ conversationId: string }>,
    res: Response
  ): Promise<void> => {
    const userId = res.locals.userId as string;
    const conversationId = req.params.conversationId;

    if (!conversationId || conversationId.length > 30) {
      res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
      return;
    }

    const pagination = paginationSchema.safeParse(req.query);

    if (!pagination.success) {
      res.status(400).json({
        success: false,
        message: "Invalid message pagination parameters.",
      });
      return;
    }

    try {
      const access = await getAccessibleConversation(conversationId, userId);

      if (!access.conversation) {
        res.status(access.status).json({
          success: false,
          message: "Conversation not found or unavailable.",
        });
        return;
      }

      if (pagination.data.before) {
        const cursorMessage = await prisma.message.findFirst({
          where: {
            id: pagination.data.before,
            conversationId,
          },
          select: { id: true },
        });

        if (!cursorMessage) {
          res.status(400).json({
            success: false,
            message: "Invalid message pagination cursor.",
          });
          return;
        }
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        ...(pagination.data.before
          ? {
              cursor: { id: pagination.data.before },
              skip: 1,
            }
          : {}),
        take: pagination.data.limit + 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          body: true,
          senderId: true,
          readAt: true,
          createdAt: true,
        },
      });

      const hasMore = messages.length > pagination.data.limit;
      const page = messages.slice(0, pagination.data.limit);
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

      res.status(200).json({
        success: true,
        messages: page.reverse(),
        pagination: {
          limit: pagination.data.limit,
          hasMore,
          nextCursor,
        },
      });
    } catch {
      console.error("Message history retrieval failed.");

      res.status(500).json({
        success: false,
        message: "Unable to load messages right now.",
      });
    }
  }
);

// POST /api/conversations/:conversationId/messages
router.post(
  "/:conversationId/messages",
  async (
    req: Request<{ conversationId: string }>,
    res: Response
  ): Promise<void> => {
    const userId = res.locals.userId as string;
    const conversationId = req.params.conversationId;

    if (!conversationId || conversationId.length > 30) {
      res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
      return;
    }

    const validation = messageSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Message must contain between 1 and 2,000 characters.",
      });
      return;
    }

    try {
      const access = await getAccessibleConversation(conversationId, userId);

      if (!access.conversation) {
        res.status(access.status).json({
          success: false,
          message: "Conversation not found or unavailable.",
        });
        return;
      }

      const message = await prisma.$transaction(async (transaction) => {
        const createdMessage = await transaction.message.create({
          data: {
            conversationId,
            senderId: userId,
            body: validation.data.body,
          },
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            body: true,
            readAt: true,
            createdAt: true,
          },
        });

        await transaction.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: createdMessage.createdAt,
          },
        });

        return createdMessage;
      });

      res.status(201).json({
        success: true,
        message,
      });
    } catch {
      console.error("Message sending failed.");

      res.status(500).json({
        success: false,
        message: "Unable to send your message right now.",
      });
    }
  }
);

export default router;
