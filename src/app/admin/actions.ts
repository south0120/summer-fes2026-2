"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  verifyPassword,
  isAdminConfigured,
  isAuthed,
  startSession,
  endSession,
  getAdminPath,
  getAdminSupabase,
} from "@/lib/admin";

function adminBase(): string {
  const slug = getAdminPath();
  return slug ? `/${slug}` : "/";
}

export type LoginState = { error?: string };

/** ログイン: パスワード照合 → 成功でセッション発行しダッシュボードへ。 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAdminConfigured()) {
    return { error: "管理者パスワードが未設定です（Vercelのenvに設定してください）。" };
  }
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    // 総当り抑止のため失敗時は少し待たせる＋汎用メッセージ
    await new Promise((r) => setTimeout(r, 600));
    return { error: "パスワードが違います。" };
  }
  startSession();
  redirect(`${adminBase()}/dashboard`);
}

/** ログアウト。 */
export async function logout(): Promise<void> {
  endSession();
  redirect(adminBase());
}

/** 投稿（ポスター/屋台）を削除。認証必須・service_role で RLS バイパス。 */
export async function deletePost(formData: FormData): Promise<void> {
  if (!isAuthed()) {
    throw new Error("認証が必要です。");
  }
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("削除対象がありません。");

  const supabase = getAdminSupabase();

  // 画像パスを取得してから Storage → DB 行の順で消す
  const { data: row } = await supabase
    .from("posters")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (row?.image_path) {
    // 画像削除は失敗しても DB 行削除は続行（孤児画像より表示を優先）
    await supabase.storage.from("posters").remove([row.image_path]);
  }

  const { error } = await supabase.from("posters").delete().eq("id", id);
  if (error) throw new Error("削除に失敗しました: " + error.message);

  // いいね(likes)は posters への外部キーが on delete cascade なので自動で消える
  revalidatePath(`${adminBase()}/dashboard`);
}
