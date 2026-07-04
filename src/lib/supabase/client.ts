import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ用 Supabase クライアント。
 * build 安全のため、モジュールトップレベルではなく必ず関数内で生成する。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
