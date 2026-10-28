
import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const parsedUrl = new URL(databaseUrl);

if (parsedUrl.protocol !== "mysql:") {
  throw new Error("DATABASE_URL must use the mysql:// protocol.");
}

const databaseName = decodeURIComponent(
  parsedUrl.pathname.replace(/^\/+/, ""),
);

if (databaseName !== "letsdate") {
  throw new Error(
    "The LetsDate backend may connect only to the letsdate database.",
  );
}

if (!parsedUrl.hostname || !parsedUrl.username || !databaseName) {
  throw new Error("DATABASE_URL is missing required connection details.");
}

const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port || 3306),
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: databaseName,
  connectionLimit: 5,
  connectTimeout: 5000,
  acquireTimeout: 10000,
});

export const prisma = new PrismaClient({ adapter });
