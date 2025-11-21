import { type ActionFunction } from "react-router";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

type CreateUserPayload = {
  id: string;
  email: string;
  name: string;
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await request.json() as CreateUserPayload;

    console.log("[API] Creating user:", payload);

    const { id, email, name } = payload;

    if (!id || !email) {
      return json(
        { error: "Missing required fields: id, email" },
        { status: 400 }
      );
    }

    try {
      const { withRawPrisma } = await import("~/lib/db.server");

      // Use Supabase user ID as the primary key
      const dbUser = await withRawPrisma(async (prisma) => {
        return await prisma.user.upsert({
          where: { id },
          update: {
            email,
            name: name || email,
          },
          create: {
            id,
            email,
            name: name || email,
            role: "REGULAR_USER",
          },
        });
      });

      console.log("[API] ✓ User created/updated:", { id: dbUser.id, email: dbUser.email });
      return json({ success: true, user: { id: dbUser.id, email: dbUser.email } });
    } catch (dbError) {
      console.error("[API] ✗ Database error:", dbError);
      // Return success even if database creation fails
      // The user is still authenticated in Supabase
      return json({ 
        success: true, 
        user: { id, email },
        warning: "User authenticated but profile creation failed"
      });
    }
  } catch (error) {
    console.error("[API] ✗ Error creating user:", error);
    if (error instanceof Error) {
      console.error("[API] Error message:", error.message);
    }
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
};
