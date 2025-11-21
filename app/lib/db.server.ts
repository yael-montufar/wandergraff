// Prisma client initialization - serverless-friendly
// Creates new instances to avoid prepared statement conflicts in Vercel

export async function prismaClient() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    
    // Create a new instance each time for serverless compatibility
    // This prevents prepared statement conflicts in concurrent executions
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
    
    return prisma;
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error);
    throw error;
  }
}

// Helper function to execute database operations with proper cleanup
export async function withPrisma<T>(
  operation: (prisma: any) => Promise<T>
): Promise<T> {
  const prisma = await prismaClient();
  try {
    return await operation(prisma);
  } finally {
    // Properly disconnect the client to prevent connection leaks
    await prisma.$disconnect();
  }
}
