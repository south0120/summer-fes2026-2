import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * サーバー用 Supabase クライアント（Next 14 App Router / cookie ベース SSR 認証）。
 * @supabase/ssr の getAll/setAll パターンで next/headers の cookies() に接続する。
 * build 安全のため、モジュールトップレベルではなく必ず関数内で生成する。
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component からの呼び出しでは cookie を書き込めない。
            // Route Handler / Server Action では正常に書き込まれるため無視してよい。
          }
        },
      },
    },
  );
}
