import type { RequestHandler } from "express";
import {
  getSessionCookieName,
  getUserIdFromSessionToken,
} from "../services/sessionService.js";

export const requireSession: RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  try {
    const rawToken = req.cookies?.[getSessionCookieName()];
    const userId = await getUserIdFromSessionToken(rawToken);

    if (!userId) {
      res.clearCookie(getSessionCookieName(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please sign in again.",
      });

      return;
    }

    res.locals.userId = userId;
    next();
  } catch (error: unknown) {
    next(error);
  }
};
