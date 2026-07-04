import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * マジックリンクのリダイレクト先。
 * `code` をセッションに交換し、成功したら投稿ページ（または next パラメータ）へ。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/posters/new";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("認証コードが見つかりませんでした。もう一度お試しください。")}`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/posters/new"}`);
}
