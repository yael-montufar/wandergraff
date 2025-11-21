import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// Raw query helper to bypass prepared statements for critical operations
export async function withRawQuery<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create a completely isolated client for raw queries
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const uniqueId = `raw_${timestamp}_${randomId}`;
  
  const separator = connectionString.includes('?') ? '&' : '?';
  const rawConnectionString = `${connectionString}${separator}application_name=wandergraff_raw_${uniqueId}&prepared_statements=false`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: rawConnectionString,
      },
    },
  });

  try {
    await prisma.$connect();
    return await callback(prisma);
  } catch (error) {
    console.error("Raw query operation failed:", error);
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect raw query client:", disconnectError);
    }
  }
}

// CRITICAL: Use raw queries only to completely bypass prepared statements
export async function withRawPrisma<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Force a completely unique connection that bypasses all Prisma caching
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const processId = process.pid || Math.floor(Math.random() * 10000);
  const uniqueId = `${timestamp}_${randomId}_${processId}`;
  
  // Use direct connection with no prepared statement support
  const separator = connectionString.includes('?') ? '&' : '?';
  const rawConnectionString = `${connectionString}${separator}application_name=wandergraff_raw_${uniqueId}&statement_timeout=30000&lock_timeout=30000`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: rawConnectionString,
      },
    },
    log: ['error'],
  });

  try {
    await prisma.$connect();
    return await callback(prisma);
  } catch (error) {
    console.error("Raw database operation failed:", error);
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect raw Prisma client:", disconnectError);
    }
  }
}

// Legacy withPrisma - now just calls withRawPrisma
export async function withPrisma<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  return withRawPrisma(callback);
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

// Helper for user profile queries using direct PostgreSQL
export async function getUserProfileData(userId: string) {
  return await withDirectPG(async (client) => {
    const query = `
      SELECT 
        "avatarUrl", 
        "bio", 
        "role", 
        "artistName", 
        "artistWebsite", 
        "artistEmail", 
        "artistInstagram", 
        "artistTwitter", 
        "artistBio"
      FROM "User" 
      WHERE "id" = $1
    `;
    
    const result = await client.query(query, [userId]);
    return result.rows[0] || null;
  });
}

// Helper for user settings queries using direct PostgreSQL
export async function getUserSettingsData(userId: string) {
  return await withDirectPG(async (client) => {
    const query = `
      SELECT 
        "id", 
        "name", 
        "email", 
        "bio", 
        "avatarUrl"
      FROM "User" 
      WHERE "id" = $1
    `;
    
    const result = await client.query(query, [userId]);
    return result.rows[0] || null;
  });
}

// Helper for root loader user profile using direct PostgreSQL
export async function getRootUserProfile(userId: string) {
  return await withDirectPG(async (client) => {
    const query = `
      SELECT 
        "avatarUrl", 
        "role"
      FROM "User" 
      WHERE "id" = $1
    `;
    
    const result = await client.query(query, [userId]);
    return result.rows[0] || null;
  });
}

// Direct PostgreSQL connection helper - completely bypasses Prisma
export async function withDirectPG<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create a completely isolated PostgreSQL connection
  const pool = new Pool({
    connectionString,
    max: 1, // Single connection
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  
  try {
    return await callback(client);
  } catch (error) {
    console.error("Direct PostgreSQL operation failed:", error);
    throw error;
  } finally {
    try {
      client.release();
      await pool.end();
    } catch (cleanupError) {
      console.error("Failed to cleanup PostgreSQL connection:", cleanupError);
    }
  }
}

// Helper for recent artworks using direct PostgreSQL
export async function getRecentArtworksRaw(limit: number = 20) {
  return await withDirectPG(async (client) => {
    const query = `
      SELECT 
        a."id",
        a."title",
        a."description",
        a."latitude",
        a."longitude",
        a."address",
        a."yearCreated",
        a."claimStatus",
        a."createdAt",
        a."artistId",
        u."name" as "createdByName",
        artist."name" as "artistName",
        artist."artistName" as "artistDisplayName",
        p."photoUrl" as "firstPhotoUrl",
        (SELECT COUNT(*) FROM "Photo" WHERE "artworkId" = a."id") as "photoCount"
      FROM "Artwork" a
      LEFT JOIN "User" u ON a."createdById" = u."id"
      LEFT JOIN "User" artist ON a."artistId" = artist."id"
      LEFT JOIN LATERAL (
        SELECT "photoUrl" 
        FROM "Photo" 
        WHERE "artworkId" = a."id" 
        ORDER BY "uploadedAt" DESC 
        LIMIT 1
      ) p ON true
      ORDER BY a."createdAt" DESC
      LIMIT $1
    `;
    
    const result = await client.query(query, [limit]);
    
    // Transform the results to match the expected structure
    const transformedArtworks = result.rows.map((artwork: any) => ({
      ...artwork,
      artist: artwork.artistName ? { 
        name: artwork.artistDisplayName || artwork.artistName 
      } : null,
      photos: artwork.firstPhotoUrl ? [{ photoUrl: artwork.firstPhotoUrl }] : []
    }));
    
    return transformedArtworks;
  });
}
