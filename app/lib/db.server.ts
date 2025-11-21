import { PrismaClient } from "@prisma/client";

// In development, we can reuse the PrismaClient instance
// In production (serverless), we create a new instance per request
// to avoid connection issues with connection poolers.
let prisma: PrismaClient | undefined;

declare global {
  // eslint-disable-next-line no-var
  var __db__: PrismaClient | undefined;
}

function getPrismaClient() {
  if (process.env.NODE_ENV === "production") {
    return new PrismaClient();
  }
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  return global.__db__;
}

export async function withPrisma<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  try {
    return await callback(prisma);
  } finally {
    // In production, disconnect after each request to avoid connection leaks.
    // In development, we keep the connection open for HMR.
    if (process.env.NODE_ENV === "production") {
      await prisma.$disconnect();
    }
  }
}

// Export prismaClient for direct use where withPrisma is not suitable (e.g., migrations)
export async function prismaClient() {
  return getPrismaClient();
}
