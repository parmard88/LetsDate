import { createHash } from "node:crypto";
import { prisma } from "../config/database.js";

const SESSION_COOKIE = "letsdate_session";

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function getUserIdFromSessionToken(
  rawToken: unknown
): Promise<string | null> {
  if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/.test(rawToken)) {
    return null;
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({
      where: { id: session.id },
    });

    return null;
  }

  return session.userId;
}
