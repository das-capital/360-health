import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request: keeps the login session fresh and sends
 * signed-out visitors to /login. The real protection of the data is row-level
 * security in Supabase; this only decides which screen to show.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  // Not set up yet: only the login page (which explains what is missing) is shown.
  if (!url || !key) {
    return isLogin ? NextResponse.next({ request }) : redirectTo(request, "/login");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && !isLogin) return redirectTo(request, "/login", response);
  if (signedIn && isLogin) return redirectTo(request, "/", response);
  return response;
}

/** Redirect, carrying over any refreshed session cookies. */
function redirectTo(request: NextRequest, pathname: string, from?: NextResponse) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  from?.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Everything except Next.js internals and static files (icons, manifest).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|svg|ico|webp)$).*)"],
};
