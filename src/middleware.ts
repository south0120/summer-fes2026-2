import { NextResponse, type NextRequest } from "next/server";

/**
 * 管理画面の隠しURL rewrite。
 *
 * - 実ルートは /admin 配下だが、公開リポジトリにパスを残さないため
 *   env `ADMIN_PATH` のslug配下だけを内部的に /admin へ rewrite する。
 *   （URL バーには slug のまま残る＝隠しURLを保つ）
 * - /admin への「直接」アクセスは 404（slug 経由でしか入れない）。
 * - ADMIN_PATH 未設定なら管理画面は到達不能（安全側のデフォルト）。
 *
 * 認証（cookie 検証）は node ランタイム側（/admin のページ・server action）で行う。
 * middleware は edge なので、ここでは path の付け替えだけに徹する。
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 内部ルートへの直接アクセスは隠す（404）
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return new NextResponse(null, { status: 404 });
  }

  const slug = process.env.ADMIN_PATH?.trim();
  if (slug) {
    if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin" + pathname.slice(slug.length + 1);
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // 静的アセット以外の全リクエストで実行（slug が動的なため広めに）
  matcher: ["/((?!_next/static|_next/image|favicon.ico|art/|.*\\.[^/]+$).*)"],
};
