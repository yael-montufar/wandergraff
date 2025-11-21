import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import { useAuthSync } from "./lib/useAuthSync";
import { useAuthStateValidation } from "./lib/useAuthStateValidation";

export const loader: Route.LoaderFunction = async ({ request }) => {
  const { getAuthTokenFromCookie, getUserFromToken } = await import("./lib/auth.server");
  const { getRootUserProfile } = await import("./lib/db.server");

  const cookieHeader = request.headers.get("cookie");
  const token = getAuthTokenFromCookie(cookieHeader);
  const user = getUserFromToken(token);

  let userWithProfile = user;

  // If user is authenticated, fetch their profile including avatar and role
  if (user) {
    try {
      console.log("[ROOT] Attempting to fetch user profile for:", user.id);
      
      const profile = await getRootUserProfile(user.id);

      if (profile) {
        console.log("[ROOT] User profile found in database");
        userWithProfile = {
          ...user,
          avatarUrl: profile.avatarUrl,
          role: profile.role,
        };
      } else {
        // User exists in Supabase but not in our database yet
        // This can happen during the signup flow
        console.log("[ROOT] User not found in database, using basic profile");
        userWithProfile = {
          ...user,
          avatarUrl: null,
          role: "REGULAR_USER",
        };
      }
    } catch (error) {
      console.error("[ROOT] Error fetching user profile:", error);
      console.error("[ROOT] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined
      });
      // Continue with basic user info if profile fetch fails
      userWithProfile = {
        ...user,
        avatarUrl: null,
        role: "REGULAR_USER",
      };
    }
  }

  return { user: userWithProfile };
};

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bebas+Neue:wght@400;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useAuthSync();
  useAuthStateValidation();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
