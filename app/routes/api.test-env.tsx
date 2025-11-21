import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  return new Response(JSON.stringify({
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseAnonKey?.length || 0,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + "..." : "missing",
    keyPreview: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + "..." : "missing"
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
};
