import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/admin";

/**
 * 自分の投稿ポスター / 屋台を 1 件「非表示」にする（論理削除・ソフトデリート）。
 * - ログイン必須。自分（user_id 一致）の投稿のみ対象。
 * - 物理削除はしない。`deleted_at` に時刻をセットして表示から外すだけ。
 *   DB の行・Storage の画像・いいねはすべて残るので、管理画面から復活できる。
 * - 更新は service_role クライアント（RLS バイパス）で行い、所有者チェックは
 *   ここ（コード）で厳密に担保する。
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

  const admin = getAdminSupabase();

  // 対象の投稿を取得（所有者の確認用）
  const { data: row, error: fetchError } = await admin
    .from("posters")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("posters soft-delete fetch error:", fetchError.message);
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

  // 論理削除: deleted_at をセット（既に非表示なら何もしない）。所有者条件も二重に付ける。
  const { error: updateError } = await admin
    .from("posters")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("posters soft-delete error:", updateError.message);
    return NextResponse.json(
      { error: "削除に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
