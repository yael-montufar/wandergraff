/**
 * Script to sync Supabase Auth users to the database
 * Run with: npx tsx scripts/sync-users.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const prisma = new PrismaClient();

async function syncUsers() {
  console.log("🔄 Starting user sync...\n");

  try {
    // Get all users from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("❌ Error fetching Supabase users:", authError);
      return;
    }

    const authUsers = authData.users;
    console.log(`📊 Found ${authUsers.length} users in Supabase Auth`);

    // Get all users from database
    const dbUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    console.log(`📊 Found ${dbUsers.length} users in database\n`);

    const dbUserIds = new Set(dbUsers.map((u) => u.id));

    // Find users that exist in Auth but not in DB
    const missingUsers = authUsers.filter((authUser) => !dbUserIds.has(authUser.id));

    if (missingUsers.length === 0) {
      console.log("✅ All Supabase Auth users already exist in the database!");
      return;
    }

    console.log(`🔧 Found ${missingUsers.length} user(s) missing from database:\n`);

    // Create missing users
    for (const authUser of missingUsers) {
      const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "User";
      
      console.log(`   Creating user: ${authUser.email} (${authUser.id})`);

      try {
        await prisma.user.create({
          data: {
            id: authUser.id,
            email: authUser.email!,
            name: name,
            role: "REGULAR_USER",
          },
        });
        console.log(`   ✅ Created user: ${authUser.email}\n`);
      } catch (error) {
        console.error(`   ❌ Failed to create user ${authUser.email}:`, error);
      }
    }

    console.log("\n✅ User sync complete!");
  } catch (error) {
    console.error("❌ Error during sync:", error);
  } finally {
    await prisma.$disconnect();
  }
}

syncUsers();

