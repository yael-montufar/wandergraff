import { PrismaClient } from "@prisma/client";

// For serverless environments, we need to ensure each operation gets a fresh client
// to avoid prepared statement conflicts and connection pooling issues
export async function withPrisma<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  // Always create a fresh PrismaClient instance to avoid prepared statement conflicts
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Add a unique identifier to the connection to force separate prepared statement namespaces
  const uniqueId = Math.random().toString(36).substring(2, 15);
  const uniqueConnectionString = connectionString.includes('?') 
    ? `${connectionString}&application_name=wandergraff_${uniqueId}`
    : `${connectionString}?application_name=wandergraff_${uniqueId}`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: uniqueConnectionString,
      },
    },
  });

  try {
    // Ensure the client is connected
    await prisma.$connect();
    return await callback(prisma);
  } catch (error) {
    console.error("Database operation failed:", error);
    throw error;
  } finally {
    // Always disconnect to prevent connection leaks
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma client:", disconnectError);
    }
  }
}

// Export prismaClient for direct use where withPrisma is not suitable (e.g., migrations)
export async function prismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });
}
