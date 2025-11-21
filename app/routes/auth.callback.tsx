import { type LoaderFunction, redirect } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "~/lib/useTheme";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    console.error("[CALLBACK] Auth error:", error, errorDescription);
    return redirect(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`, { replace: true });
  }

  if (code) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("[CALLBACK] Missing Supabase environment variables");
        return redirect("/auth/login?error=Server+configuration+error", { replace: true });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[CALLBACK] Error exchanging code:", error);
        return redirect(`/auth/login?error=${encodeURIComponent(error.message)}`, { replace: true });
      }

      if (!data.session) {
        console.error("[CALLBACK] No session returned");
        return redirect("/auth/login?error=No+session+returned", { replace: true });
      }

      // Create database user record
      console.log("[CALLBACK] Creating database user record");
      const user = data.session.user;
      
      try {
        const origin = new URL(request.url).origin;
        const createUserUrl = new URL("/api/auth/create-user", origin);
        
        const createUserResponse = await fetch(createUserUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
          }),
        });

        if (!createUserResponse.ok) {
          console.error("[CALLBACK] Failed to create database user:", await createUserResponse.text());
          // Continue anyway - user is authenticated in Supabase
        } else {
          console.log("[CALLBACK] Database user created successfully");
        }
      } catch (createUserError) {
        console.error("[CALLBACK] Error creating database user:", createUserError);
        // Continue anyway - user is authenticated in Supabase
      }

      // Redirect back to callback to let client-side code handle the navigation
      const response = redirect("/auth/callback", { replace: true });
      response.headers.set(
        "Set-Cookie",
        `auth-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax`
      );
      return response;
    } catch (error) {
      console.error("[CALLBACK] Unexpected error:", error);
      return redirect(
        `/auth/login?error=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`,
        { replace: true }
      );
    }
  }

  return { hasFragment: true };
};

export default function CallbackPage() {
  const navigate = useNavigate();
  const { scheme, noiseColor } = useTheme();
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    // Guard check at top of effect to prevent running twice in Strict Mode
    if (hasExecutedRef.current) {
      return;
    }
    hasExecutedRef.current = true;

    const handleHashAuth = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error("[CALLBACK] Missing Supabase environment variables");
          navigate("/auth/login?error=Server+configuration+error", { replace: true });
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[CALLBACK] Error getting session:", error);
          navigate(`/auth/login?error=${encodeURIComponent(error.message)}`, { replace: true });
          return;
        }

        if (data.session) {
          // Set the auth cookie
          document.cookie = `auth-token=${data.session.access_token}; path=/; SameSite=Lax`;

          // Create database user record if needed
          console.log("[CALLBACK] Ensuring database user record exists");
          const user = data.session.user;
          
          try {
            const createUserResponse = await fetch("/api/auth/create-user", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
              }),
            });

            if (!createUserResponse.ok) {
              console.error("[CALLBACK] Failed to create database user:", await createUserResponse.text());
              // Continue anyway - user is authenticated in Supabase
            } else {
              console.log("[CALLBACK] Database user created/updated successfully");
            }
          } catch (createUserError) {
            console.error("[CALLBACK] Error creating database user:", createUserError);
            // Continue anyway - user is authenticated in Supabase
          }

          // Get redirect URL from URL params first, then sessionStorage, default to home
          const urlParams = new URL(window.location.href).searchParams;
          let redirectTo = urlParams.get("redirectTo") || sessionStorage.getItem("auth-redirect") || "/";
          sessionStorage.removeItem("auth-redirect");

          // Use React Router's navigate with replace to handle history properly
          navigate(redirectTo, { replace: true });
        } else {
          console.error("[CALLBACK] No session found");
          navigate("/auth/login?error=No+session+found", { replace: true });
        }
      } catch (error) {
        console.error("[CALLBACK] Unexpected error:", error);
        navigate(
          `/auth/login?error=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`,
          { replace: true }
        );
      }
    };

    handleHashAuth();
  }, [navigate]);

  return (
    <div
      className="min-h-screen relative flex items-center justify-center"
      suppressHydrationWarning
      style={{
        backgroundColor: scheme.primaryBg,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' seed='2'/%3E%3CfeColorMatrix type='saturate' values='0.08'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23${noiseColor}' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundAttachment: "fixed",
      }}
    >
      <div className="text-center" style={{ color: scheme.text }} suppressHydrationWarning>
        <h1 className="text-2xl font-bold mb-2">Signing you in...</h1>
        <p>Please wait while we complete your authentication.</p>
      </div>
    </div>
  );
}
