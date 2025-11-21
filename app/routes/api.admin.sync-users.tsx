/**
 * TEMPORARY Admin endpoint to sync users from Supabase Auth to database
 * 
 * To use:
 * 1. Set ADMIN_SECRET in your Vercel environment variables
 * 2. Visit: https://your-staging-url.vercel.app/api/admin/sync-users?secret=YOUR_SECRET
 * 3. Delete this file after running once
 */

import type { LoaderFunction } from "react-router";
import { createClient } from "@supabase/supabase-js";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export const loader: LoaderFunction = async ({ request }) => {
  // Check admin secret
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const adminSecret = process.env.ADMIN_SECRET || "change-me-in-vercel";

  if (secret !== adminSecret) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = url.searchParams.get("action") || "sync"; // 'sync' or 'delete'

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return json({ error: "Missing Supabase environment variables" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { withRawPrisma } = await import("~/lib/db.server");

    // Get all users from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      return json({ error: "Failed to fetch auth users", details: authError }, { status: 500 });
    }

    const authUsers = authData.users;

    if (action === "delete") {
      // DELETE ALL USERS
      const results = {
        authDeleted: 0,
        authErrors: [] as string[],
        dbDeleted: 0,
      };

      // Delete from Auth
      for (const user of authUsers) {
        try {
          const { error } = await supabase.auth.admin.deleteUser(user.id);
          if (error) {
            results.authErrors.push(`${user.email}: ${error.message}`);
          } else {
            results.authDeleted++;
          }
        } catch (error) {
          results.authErrors.push(`${user.email}: ${error}`);
        }
      }

      // Delete from database
      const deleteResult = await withRawPrisma(async (prisma) => {
        return await prisma.user.deleteMany({});
      });
      results.dbDeleted = deleteResult.count;

      return json({
        action: "delete",
        success: true,
        results,
      });
    } else {
      // SYNC USERS
      const dbUsers = await withRawPrisma(async (prisma) => {
        return await prisma.user.findMany({
        select: { id: true, email: true },
        });
      });

      const dbUserIds = new Set(dbUsers.map((u) => u.id));
      const missingUsers = authUsers.filter((authUser) => !dbUserIds.has(authUser.id));

      if (missingUsers.length === 0) {
        return json({
          action: "sync",
          success: true,
          message: "All users already synced",
          stats: {
            authUsers: authUsers.length,
            dbUsers: dbUsers.length,
            created: 0,
          },
        });
      }

      const created = [];
      const errors = [];

      for (const authUser of missingUsers) {
        const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "User";

        try {
          await withRawPrisma(async (prisma) => {
            return await prisma.user.create({
            data: {
              id: authUser.id,
              email: authUser.email!,
              name: name,
              role: "REGULAR_USER",
            },
            });
          });
          created.push(authUser.email);
        } catch (error) {
          errors.push({
            email: authUser.email,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return json({
        action: "sync",
        success: true,
        stats: {
          authUsers: authUsers.length,
          dbUsersBefore: dbUsers.length,
          dbUsersAfter: dbUsers.length + created.length,
          created: created.length,
        },
        created,
        errors,
      });
    }
  } catch (error) {
    console.error("Admin sync error:", error);
    return json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};

