import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const viteSupabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL;
  const viteSupabaseAnonKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  
  return new Response(JSON.stringify({
    DATABASE_URL: {
      exists: !!databaseUrl,
      length: databaseUrl?.length || 0,
      preview: databaseUrl ? databaseUrl.substring(0, 30) + "..." : "missing",
      protocol: databaseUrl ? databaseUrl.split("://")[0] : "no protocol"
    },
    SUPABASE_URL: {
      exists: !!supabaseUrl,
      length: supabaseUrl?.length || 0,
      preview: supabaseUrl ? supabaseUrl.substring(0, 30) + "..." : "missing",
      protocol: supabaseUrl ? supabaseUrl.split("://")[0] : "no protocol"
    },
    SUPABASE_ANON_KEY: {
      exists: !!supabaseAnonKey,
      length: supabaseAnonKey?.length || 0,
      preview: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + "..." : "missing"
    },
    VITE_PUBLIC_SUPABASE_URL: {
      exists: !!viteSupabaseUrl,
      length: viteSupabaseUrl?.length || 0,
      preview: viteSupabaseUrl ? viteSupabaseUrl.substring(0, 30) + "..." : "missing",
      protocol: viteSupabaseUrl ? viteSupabaseUrl.split("://")[0] : "no protocol"
    },
    VITE_PUBLIC_SUPABASE_ANON_KEY: {
      exists: !!viteSupabaseAnonKey,
      length: viteSupabaseAnonKey?.length || 0,
      preview: viteSupabaseAnonKey ? viteSupabaseAnonKey.substring(0, 20) + "..." : "missing"
    }
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
};
