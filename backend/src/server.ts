import "dotenv/config";

import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { prisma } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import photoRoutes from "./routes/photoRoutes.js";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

const environmentResult = environmentSchema.safeParse(process.env);

if (!environmentResult.success) {
  console.error("Invalid environment configuration.");
  console.error(environmentResult.error.flatten().fieldErrors);
  process.exit(1);
}

const env = environmentResult.data;
const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
  })
);

app.use(express.json({ limit: "20kb" }));

app.use(
  express.urlencoded({
    extended: false,
    limit: "20kb",
  })
);

app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LetsDate API is running.",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "Database connection is healthy.",
    });
  } catch {
    console.error("Database health check failed.");

    res.status(503).json({
      success: false,
      message: "Database service is temporarily unavailable.",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/profile/photos", photoRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "The requested resource was not found.",
  });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
    });
    return;
  }

  console.error("Unexpected server error.");

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
};

app.use(errorHandler);

const server = app.listen(env.PORT, "127.0.0.1", () => {
  console.log("==================================");
  console.log("LetsDate API started successfully");
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Port: ${env.PORT}`);
  console.log(`Health: http://localhost:${env.PORT}/api/health`);
  console.log(`Database health: http://localhost:${env.PORT}/api/health/db`);
  console.log(`Registration: http://localhost:${env.PORT}/api/auth/register`);
  console.log(`Profile: http://localhost:${env.PORT}/api/profile`);
  console.log("==================================");
});

let shuttingDown = false;

const shutdown = (signal: string): void => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully.`);

  server.close((error) => {
    if (error) {
      console.error("HTTP server shutdown failed.");
      process.exitCode = 1;
    }

    void prisma.$disconnect().catch(() => {
      console.error("Database connection shutdown failed.");
      process.exitCode = 1;
    });
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
