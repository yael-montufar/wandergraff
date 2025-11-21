# Database & Auth Management Scripts

This directory contains utility scripts for managing users across Supabase Auth and your database.

## Prerequisites

Make sure you have the required environment variables set:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (admin access)
- `DATABASE_URL` - Your PostgreSQL database connection string

## Scripts

### `sync-users.ts`
Syncs users from Supabase Auth to your database. Creates database records for any users that exist in Auth but not in the database.

**Usage:**
```bash
# Local environment
npx tsx scripts/sync-users.ts

# Staging environment (run locally with staging env vars)
vercel env pull .env.staging --environment=preview
npx tsx scripts/sync-users.ts
```

**What it does:**
- ✅ Fetches all users from Supabase Auth
- ✅ Fetches all users from your database
- ✅ Creates database records for missing users
- ✅ Safe to run multiple times (idempotent)

### `delete-all-users.ts`
**⚠️ DESTRUCTIVE** - Deletes ALL users from both Supabase Auth and your database.

**Usage:**
```bash
# Local environment
npx tsx scripts/delete-all-users.ts

# Staging environment (run locally with staging env vars)
vercel env pull .env.staging --environment=preview
npx tsx scripts/delete-all-users.ts
```

**What it does:**
- ❌ Deletes ALL users from Supabase Auth
- ❌ Deletes ALL users from your database
- ⚠️ Cannot be undone!
- 🛡️ Has a safety check to prevent running on production URLs

**When to use:**
- Starting fresh in a staging/development environment
- Fixing sync issues between Auth and database
- Testing user flows from scratch

## Running in Different Environments

### Local Development
```bash
npx tsx scripts/sync-users.ts
```

### Staging (from your local machine)
```bash
# Pull staging environment variables
vercel env pull .env.staging --environment=preview

# Load the env vars and run the script
source .env.staging  # or use dotenv
npx tsx scripts/sync-users.ts
```

### Production
For production, consider:
1. Creating a protected API endpoint instead of running scripts locally
2. Using a scheduled job for periodic syncing
3. Having robust error handling and notifications

## Safety Tips

1. **Always backup first** - Especially for production
2. **Test in staging** - Run scripts in staging before production
3. **Review the code** - Understand what each script does before running
4. **Check environment** - Make sure you're targeting the right environment
5. **Monitor logs** - Watch for errors during execution

## Troubleshooting

**"Missing environment variables" error:**
- Make sure you've set or loaded the required env vars
- For Vercel environments, use `vercel env pull`

**"Permission denied" errors:**
- Ensure your `SUPABASE_SERVICE_ROLE_KEY` has admin permissions
- Check that your database user has DELETE/INSERT permissions

**Users still mismatched:**
- Check that you're looking at the same environment in both places
- Run `sync-users.ts` to create missing database records
- Check application logs for failed user creation attempts

