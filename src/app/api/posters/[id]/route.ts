import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 自分の投稿ポスター / 屋台を 1 件削除する。
 * - ログイン必須。
 * - 自分（user_id 一致）の投稿のみ削除できる（RLS でも保証されるが、
 *   ここでも所有者チェックして 403 を明示的に返す）。
 * - いいねは posters(id) の on delete cascade で自動的に消える。
 * - DB 行を先に消し、Storage の画像は best-effort で後片付けする
 *   （迷子ファイルは無害。POST 側の掃除方針に合わせる）。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = String(params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "投稿 ID が不正です。" }, { status: 400 });
  }

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  // 対象の投稿を取得（画像パスと所有者の確認用）
  const { data: row, error: fetchError } = await supabase
    .from("posters")
    .select("image_path, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("posters delete fetch error:", fetchError.message);
    return NextResponse.json(
      { error: "削除に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json({ error: "投稿が見つかりません。" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json(
      { error: "この投稿を削除する権限がありません。" },
      { status: 403 },
    );
  }

  // DB 行を削除（表示の正本。いいねはカスケードで自動削除される）
  const { error: deleteError } = await supabase
    .from("posters")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("posters delete error:", deleteError.message);
    return NextResponse.json(
      { error: "削除に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }

  // Storage の画像を後片付け（失敗しても致命的ではないので握りつぶす）
  if (typeof row.image_path === "string" && row.image_path) {
    const { error: removeError } = await supabase.storage
      .from("posters")
      .remove([row.image_path]);
    if (removeError) {
      console.error("posters storage remove error:", removeError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
