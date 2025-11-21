import { PrismaClient } from "@prisma/client";

// For serverless environments, we need to ensure each operation gets a fresh client
// to avoid prepared statement conflicts and connection pooling issues
export async function withPrisma<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  // Always create a fresh PrismaClient instance to avoid prepared statement conflicts
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create multiple layers of uniqueness to prevent prepared statement conflicts
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const processId = process.pid || Math.floor(Math.random() * 10000);
  const uniqueId = `${timestamp}_${randomId}_${processId}`;
  
  // Add unique parameters to force completely separate connections
  const separator = connectionString.includes('?') ? '&' : '?';
  const uniqueConnectionString = `${connectionString}${separator}application_name=wandergraff_${uniqueId}&connect_timeout=10&pool_timeout=10`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: uniqueConnectionString,
      },
    },
    // Force Prisma to not cache prepared statements
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  try {
    // Ensure the client is connected with a timeout
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    
    // Add a small random delay to prevent concurrent prepared statement conflicts
    const delay = Math.floor(Math.random() * 50) + 10; // 10-60ms random delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Execute the callback
    const result = await callback(prisma);
    
    return result;
  } catch (error) {
    console.error("Database operation failed:", error);
    
    // If it's a prepared statement error, retry once with a longer delay
    if (error instanceof Error && error.message.includes('prepared statement')) {
      console.log("Retrying database operation due to prepared statement conflict...");
      try {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // 100-300ms delay
        const retryResult = await callback(prisma);
        return retryResult;
      } catch (retryError) {
        console.error("Retry also failed:", retryError);
        throw retryError;
      }
    }
    
    throw error;
  } finally {
    // Always disconnect to prevent connection leaks
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma client:", disconnectError);
      // Don't throw here as it might mask the original error
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
