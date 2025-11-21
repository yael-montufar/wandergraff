/**
 * Script to delete ALL users from both Supabase Auth and Database
 * USE WITH CAUTION - This will permanently delete all user data!
 * Run with: npx tsx scripts/delete-all-users.ts
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

async function deleteAllUsers() {
  console.log("⚠️  WARNING: This will delete ALL users from both Supabase Auth and the database!");
  console.log("⚠️  This action CANNOT be undone!\n");
  
  // Safety check - don't run in production
  if (supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('staging')) {
    console.log("🛑 Safety check: This appears to be a production URL.");
    console.log("   If you're sure you want to continue, remove this check from the script.\n");
    return;
  }

  try {
    // Step 1: Get all users from Supabase Auth
    console.log("📊 Fetching users from Supabase Auth...");
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("❌ Error fetching Supabase users:", authError);
      return;
    }

    const authUsers = authData.users;
    console.log(`   Found ${authUsers.length} users in Supabase Auth\n`);

    // Step 2: Delete from Supabase Auth
    if (authUsers.length > 0) {
      console.log("🗑️  Deleting users from Supabase Auth...");
      for (const user of authUsers) {
        try {
          const { error } = await supabase.auth.admin.deleteUser(user.id);
          if (error) {
            console.error(`   ❌ Failed to delete user ${user.email}:`, error.message);
          } else {
            console.log(`   ✅ Deleted from Auth: ${user.email}`);
          }
        } catch (error) {
          console.error(`   ❌ Error deleting user ${user.email}:`, error);
        }
      }
      console.log();
    }

    // Step 3: Get all users from database
    console.log("📊 Fetching users from database...");
    const dbUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    console.log(`   Found ${dbUsers.length} users in database\n`);

    // Step 4: Delete from database
    if (dbUsers.length > 0) {
      console.log("🗑️  Deleting users from database...");
      const deleteResult = await prisma.user.deleteMany({});
      console.log(`   ✅ Deleted ${deleteResult.count} users from database\n`);
    }

    console.log("✅ All users have been deleted!");
    console.log("   Users can now sign up fresh with Google OAuth or email/password.\n");
    
  } catch (error) {
    console.error("❌ Error during deletion:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();

