import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  return new Response(JSON.stringify({
    hasDatabaseUrl: !!databaseUrl,
    urlLength: databaseUrl?.length || 0,
    urlStart: databaseUrl ? databaseUrl.substring(0, 20) + "..." : "missing",
    urlProtocol: databaseUrl ? databaseUrl.split("://")[0] : "no protocol"
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
};
