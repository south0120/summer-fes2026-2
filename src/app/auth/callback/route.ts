import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * マジックリンクのリダイレクト先。
 *
 * 認証方式は 2 系統をサポートする:
 * 1. `token_hash` + `type`（推奨・メールテンプレートで直接付与）
 *    → verifyOtp で検証する。ブラウザ側のストレージに依存しないため、
 *      リンク送信時と別のブラウザ／デバイス（メールアプリ内ブラウザ等）で
 *      開いてもログインできる。
 * 2. `code`（旧方式・Supabase デフォルトテンプレートの ConfirmationURL 経由）
 *    → PKCE の code verifier cookie が必要なため、リンクを送ったブラウザと
 *      同じブラウザで開いたときだけ成功する。フォールバックとして残す。
 *
 * 成功したらトップ（または next パラメータ）へ。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // 既定の遷移先はトップ（ログイン状態で会場へ）。ポスター/屋台の投稿導線からログインした
  // 場合のみ ?next=/posters/new 等が付与され、その画面に戻る。
  const next = searchParams.get("next") ?? "/";

  const loginError = (message: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}${
        next !== "/" ? `&next=${encodeURIComponent(next)}` : ""
      }`,
    );

  if (!tokenHash && !code) {
    return loginError(
      "認証コードが見つかりませんでした。もう一度お試しください。",
    );
  }

  const supabase = createClient();

  if (tokenHash) {
    // 推奨フロー: token_hash をサーバーで直接検証（どのブラウザで開いてもOK）
    const { error } = await supabase.auth.verifyOtp({
      type: type ?? "email",
      token_hash: tokenHash,
    });
    if (error) {
      return loginError(
        "ログインリンクの有効期限が切れているか、すでに使用されています。お手数ですが、もう一度ログインリンクを送信してください。",
      );
    }
  } else {
    // 旧フロー: PKCE code の交換（リンクを送ったブラウザと同じブラウザでのみ成功）
    const { error } = await supabase.auth.exchangeCodeForSession(code!);
    if (error) {
      const message = error.message.includes("code verifier")
        ? "リンクを送信したときと別のブラウザで開かれたため、ログインできませんでした。もう一度ログインリンクを送信し、同じブラウザ（メールを開いたブラウザ）でお試しください。"
        : "ログインリンクの有効期限が切れているか、すでに使用されています。お手数ですが、もう一度ログインリンクを送信してください。";
      return loginError(message);
    }
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
