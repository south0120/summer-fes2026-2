import { redirect } from "next/navigation";
import { isAuthed, getAdminPath } from "@/lib/admin";
import AdminLoginForm from "./AdminLoginForm";

export const metadata = { title: "管理", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  // 既にログイン済みならダッシュボードへ
  if (isAuthed()) {
    const slug = getAdminPath();
    redirect(slug ? `/${slug}/dashboard` : "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-night-900 px-4 text-fes-ink">
      <div className="w-full max-w-sm rounded-2xl border-[3px] border-kraft-paper bg-kraft-paper p-6 shadow-paper">
        <h1 className="font-maru text-xl font-black text-fes-indigo">
          管理画面ログイン
        </h1>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/60">
          関係者専用。パスワードを入力してください。
        </p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
