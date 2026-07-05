import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * マジックリンクのリダイレクト先。
 * `code` をセッションに交換し、成功したら投稿ページ（または next パラメータ）へ。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // 既定の遷移先はトップ（ログイン状態で会場へ）。ポスター/屋台の投稿導線からログインした
  // 場合のみ ?next=/posters/new 等が付与され、その画面に戻る。
  const next = searchParams.get("next") ?? "/";

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

  // 初回ログイン時に profiles 行を作成する（表示名の正本）。
  // ユーザーネームは登録フォームで user_metadata.username に載せてある。
  // 既に行があれば触らない（＝マイページで変えた名前を上書きしない）。
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) {
        const metaName = user.user_metadata?.username;
        const username =
          (typeof metaName === "string" && metaName.trim() !== ""
            ? metaName.trim()
            : user.email?.split("@")[0] || "ゲスト").slice(0, 20);
        await supabase.from("profiles").insert({ user_id: user.id, username });
      }
    }
  } catch {
    // profiles 未整備でもログイン自体は成立させる（表示側はフォールバックあり）
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
}
