import { PrismaClient } from "@prisma/client";

const clientCache = new Map();

const buildDatabaseUrl = (schema) => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Prisma.");
  }
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", schema);
  return url.toString();
};

export const getPrisma = (schema = "public") => {
  const dbUrl = buildDatabaseUrl(schema);
  if (!clientCache.has(dbUrl)) {
    clientCache.set(
      dbUrl,
      new PrismaClient({
        datasources: { db: { url: dbUrl } },
      })
    );
  }
  return clientCache.get(dbUrl);
};

export const disconnectAllPrisma = async () => {
  const clients = Array.from(clientCache.values());
  await Promise.all(clients.map((client) => client.$disconnect()));
  clientCache.clear();
};
