import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  try {
    const { prismaClient } = await import("~/lib/db.server");
    const prisma = await prismaClient();
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    return new Response(JSON.stringify({
      success: true,
      message: "Database connection successful",
      result: result
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown"
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
};
